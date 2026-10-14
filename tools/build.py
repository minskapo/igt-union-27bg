"""사측 공유본 index.html을 만듭니다.

사용:
  GATE_PASSWORD='...' python3 tools/build.py
입력: src/gdoc.html(구글 문서 HTML 내보내기), src/current-rules.html(현행 규정 원문)
출력: index.html
"""
import hashlib
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from parse_doc import parse  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")

SB_URL = "https://ujklhwddcjunrrytsmen.supabase.co"
SB_KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqa2xod2RkY2p1bnJyeXRzbWVuIiwicm9sZSI6"
          "ImFub24iLCJpYXQiOjE3OTE5NDc4MjYsImV4cCI6MjEwNzUyMzgyNn0.ygpF0dCCf0ItUKIHGIgn3AUFLnHPfj2-r2fEChryovg")

esc = lambda s: html.escape(s, quote=True)  # noqa: E731

doc = parse(os.path.join(SRC, "gdoc.html"))
# 부록 D(노사 공유 자료)는 연구소 공유본에 싣지 않습니다
doc["appx"] = [s for s in doc["appx"] if not s["key"].startswith("ap-D")]
DROP_TEXT = [" 요구안을 총인건비로 환산한 추정은 부록 D에 정리했습니다."]

# ---------- 조문 색인 ----------
ARTS = {}
for pre in ("d", "w"):
    for it in doc[pre]:
        if it["type"] == "art":
            ARTS[it["key"]] = it


def plain(h):
    return html.unescape(re.sub(r"<[^>]+>", "", h))


REF_DATA = {}
for k, a in ARTS.items():
    lines = []
    for b in a["body"]:
        if b["k"] == "p":
            lines.append(plain(b["h"]))
        else:
            lines.append("(표 생략)")
    name = ("단체협약 " if k.startswith("d-") else "임금협약 ") + a["label"] + ("" if a["label"] == a["title"] else "(" + a["title"] + ")")
    REF_DATA[k] = {"t": name, "b": lines}

# ---------- 조문 참조 연결 ----------
# 조문 번호 바로 앞의 문서 이름(「법령」, 현행 규정, 단체협약·임금협약)으로 어느 문서의 조문인지 판단합니다.
# 해설에서 문서 이름 없이 번호만 쓴 경우에는 같은 문장의 가장 가까운 문서 이름을 보되,
# 그 문서가 법령이나 현행 규정이면 확신할 수 없으므로 링크를 걸지 않습니다.
RULES = [  # (본문 표기, 정식 이름, 짧은 키)
    ("2026년 임금협약", "2026년 임금협약", "wage26"), ("2026 임금협약", "2026년 임금협약", "wage26"),
    ("26 임금협약", "2026년 임금협약", "wage26"), ("취업규칙", "취업규칙", "work"),
    ("운영실무규정", "운영실무규정", "ops"), ("고충처리규정", "고충처리규정", "griev"),
    ("회계실무규정", "회계실무규정", "acct"), ("퇴직연금규약", "퇴직연금규약", "pension"),
    ("기본협약", "기본협약", "basic"), ("정관", "정관", "charter"),
]
RULE_SLUG = {name: slug for _, name, slug in RULES}
REF_RE = re.compile(r"(<[^>]+>)|(부칙\s*)?제(\d+)조(의(\d+))?|별표\s*(\d)")
CHAIN_RE = re.compile(r"(?:\s*제\d+(?:항|호|목))*\s*(?:와|과|,|및|또는|부터|ㆍ|·|내지)\s*")
LAW_REFS = {}   # 법령 이름 -> 조문 번호 집합 (본문 수집용)


def immediate_doc(txt, part):
    """번호 바로 앞에 붙은 문서 이름을 해석합니다. 없으면 "?"를 돌려줍니다."""
    t = txt.rstrip()
    m = re.search(r"「([^」]+)」$", t)
    if m:
        return ("law", m.group(1).strip())
    if re.search(r"같은 법\s*시행령$", t):
        lw = last_law(txt)
        return ("law", lw + " 시행령") if lw else None
    if t.endswith("같은 법"):
        lw = last_law(txt)
        return ("law", lw) if lw else None
    bl = bare_law_tail(t)
    if bl:
        return ("law", bl)
    if re.search(r"(모범단체협약|모범단협|모범단협\(안\)|모범단체협약\(안\)|협약\(안\))$", t):
        return None
    for word, name, _ in RULES:
        if t.endswith(word):
            return ("rule", name)
    if t.endswith("같은 규정"):
        r = last_rule(txt)
        return ("rule", r) if r else None
    if t.endswith("이 협약"):
        return part
    if t.endswith("단체협약"):
        return "d"
    if t.endswith("임금협약"):
        return "w"
    if re.search(r"(법|령|규칙|규정|규약|고시|지침|협약)$", t):
        return None
    return "?"


# 낫표 없이 쓴 법령 이름도 알아봅니다(긴 이름부터 맞춥니다)
KNOWN_LAWS = sorted([
    "근로기준법 시행령", "근로기준법", "노동조합 및 노동관계조정법", "남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률",
    "산업안전보건법", "개인정보 보호법", "근로자참여 및 협력증진에 관한 법률", "산업재해보상보험법",
    "기간제 및 단시간근로자 보호 등에 관한 법률", "고용보험법", "국가인권위원회법", "공직선거법", "민법",
    "근로자퇴직급여 보장법", "모자보건법", "통신비밀보호법", "예비군법", "민방위기본법",
], key=len, reverse=True)
SHORT_LAWS = {"노동조합법": "노동조합 및 노동관계조정법", "남녀고용평등법": "남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률",
              "기간제법": "기간제 및 단시간근로자 보호 등에 관한 법률", "산안법": "산업안전보건법", "퇴직급여법": "근로자퇴직급여 보장법"}


def bare_law_tail(t):
    for nm in KNOWN_LAWS:
        if t.endswith(nm):
            return nm
    for sh, nm in SHORT_LAWS.items():
        if t.endswith(sh):
            return nm
    return None


def last_law(txt):
    ms = re.findall(r"「([^」]+)」", txt)
    return ms[-1].strip() if ms else None


def last_rule(txt):
    best, name = -1, None
    for word, nm, _ in RULES:
        j = txt.rfind(word)
        if j > best:
            best, name = j, nm
    return name


def sentence_doc(txt, part):
    cut = max(txt.rfind(". "), txt.rfind("다."), txt.rfind("\n"))
    sent = txt[cut + 1:] if cut >= 0 else txt
    cands = [(m.end(), "law") for m in re.finditer(r"「[^」]+」|같은 법", sent)]
    for nm in list(KNOWN_LAWS) + list(SHORT_LAWS):
        j = sent.rfind(nm)
        if j >= 0:
            cands.append((j + len(nm), "law"))
    for word, name, _ in RULES:
        j = sent.rfind(word)
        if j >= 0:
            cands.append((j + len(word), "rule"))
    for m in re.finditer(r"(?<!모범)단체협약|모범단(?:체협약|협)", sent):
        cands.append((m.end(), "d" if not m.group(0).startswith("모범") else "ext"))
    for m in re.finditer(r"임금협약", sent):
        pre = sent[:m.start()]
        cands.append((m.end(), "rule" if re.search(r"(2026년?|26)\s*$", pre) else "w"))
    for m in re.finditer(r"이 협약", sent):
        cands.append((m.end(), part))
    if not cands:
        return part
    kind = max(cands)[1]
    return kind if kind in ("d", "w") else None


def ref_key(target, m):
    if not target:
        return None
    if isinstance(target, tuple):
        kind, name = target
        if m.group(6):
            return None
        n = m.group(3) + ("의" + m.group(5) if m.group(5) else "")
        if m.group(2):
            return None
        if kind == "law":
            LAW_REFS.setdefault(name, set()).add(n)
            return "L|%s|%s" % (name, n)
        return "R|%s|%s" % (RULE_SLUG[name], n)
    if m.group(6):
        key = "%s-t%s" % (target, m.group(6))
    else:
        n = m.group(3) + ("의" + m.group(5) if m.group(5) else "")
        key = "%s-%s%s" % (target, "a" if m.group(2) else "", n)
    return key if key in ARTS else None


def link_refs(h, part, mode="text"):
    """mode="law"는 조문 원문, mode="text"는 해설과 비교 자료입니다."""
    out, pos, txt = [], 0, ""
    last_target, last_end = part, None
    in_a = False
    for m in REF_RE.finditer(h):
        out.append(h[pos:m.start()])
        txt += plain(h[pos:m.start()])
        pos = m.end()
        if m.group(1):
            tag = m.group(1)
            if tag.startswith("<a"):
                in_a = True
            elif tag.startswith("</a"):
                in_a = False
            out.append(tag)
            continue
        token = m.group(0)
        if in_a:
            out.append(token)
            txt += token
            continue
        if last_end is not None and CHAIN_RE.fullmatch(txt[last_end:]):
            target = last_target
        else:
            target = immediate_doc(txt, part)
            if target == "?":
                target = part if (mode == "law" or m.group(6)) else sentence_doc(txt, part)
        key = ref_key(target, m)
        last_target = target
        if key:
            if key.startswith("R|charter"):
                out.append('<span class="ref" tabindex="0" data-r="%s">%s</span>' % (esc(key), token))
            else:
                ext = ' target="_blank" rel="noopener"' if key.startswith("L|") else ""
                out.append('<a class="ref" href="%s" data-r="%s"%s>%s</a>' % (ref_href(key), esc(key), ext, token))
        else:
            out.append(token)
        txt += token
        last_end = len(txt)
    out.append(h[pos:])
    return "".join(out)


def ref_href(key):
    if key.startswith("L|"):
        _, name, n = key.split("|")
        return esc("https://www.law.go.kr/법령/%s/제%s조" % (name.replace(" ", ""), n.replace("의", "의")))
    if key.startswith("R|"):
        _, slug, n = key.split("|")
        return "#r-%s-%s" % (slug, n)
    return "#" + key


# ---------- 조각 렌더링 ----------
NUM_RE = re.compile(r"^[\-−+]?[\d,]+(\.\d+)?\s*(%|원|명|시간|일|건)?$")


def render_table(rows, part, cls="t"):
    if not rows:
        return ""
    head = rows[0] if rows[0] and all(c["bold"] or not c["t"] for c in rows[0]) else None
    body = rows[1:] if head else rows
    o = ['<div class="tw"><table class="%s">' % cls]
    numcol = set()
    if head and all(len(r) == len(head) for r in body):
        for j in range(len(head)):
            vals = [r[j]["t"] for r in body if r[j]["t"]]
            if vals and sum(1 for v in vals if NUM_RE.match(v)) >= max(1, len(vals) * 0.6):
                numcol.add(j)
    if head:
        o.append("<thead><tr>" + "".join('<th%s%s>%s</th>' % (' class="num"' if j in numcol else "", span(c), strip_b(c["h"])) for j, c in enumerate(head)) + "</tr></thead>")
    o.append("<tbody>")
    for r in body:
        cells = []
        for c in r:
            cl = ' class="num"' if NUM_RE.match(c["t"]) else ""
            cells.append("<td%s%s>%s</td>" % (cl, span(c), link_refs(c["h"], part)))
        o.append("<tr>" + "".join(cells) + "</tr>")
    o.append("</tbody></table></div>")
    return "".join(o)


def span(c):
    s = ""
    if c["cs"] > 1:
        s += ' colspan="%d"' % c["cs"]
    if c["rs"] > 1:
        s += ' rowspan="%d"' % c["rs"]
    return s


def strip_b(h):
    return re.sub(r"</?b>", "", h)


LV_TITLE = {
    ("법정", "초과"): "법정 기준보다 높은 수준을 요구합니다.",
    ("법정", "유지"): "법정 기준과 같은 수준입니다. 법이 정한 내용을 협약으로 확인합니다.",
    ("법정", "기준 없음"): "법령에 정한 기준이 없는 사항입니다.",
}


def badges(bs):
    out = []
    for b in bs:
        b = b.strip()
        if b.startswith("법정"):
            v = b.replace("법정", "").strip() or "유지"
            kind = {"초과": "up", "유지": "same", "기준 없음": "none"}.get(v, "same")
            out.append('<span class="lv %s" title="%s"><i>법정</i><b>%s</b></span>' % (kind, esc(LV_TITLE.get(("법정", v), "")), esc(v)))
        else:
            v = b.replace("26 임금협약", "2026 임금협약")
            if v == "신설":
                kind, t = "new", "현행 규정·협약에 없던 내용을 새로 정합니다."
            elif v == "일부신설":
                v, kind, t = "일부 신설", "new", "현행 규정·협약에 일부 없던 내용을 새로 정합니다."
            elif v.endswith("초과"):
                kind, t = "up", "현행 %s보다 높은 수준입니다." % v[:-3].strip()
            elif v.endswith("유지"):
                kind, t = "same", "현행 %s와 같은 수준입니다." % v[:-3].strip()
            else:
                kind, t = "same", ""
            out.append('<span class="lv %s" title="%s"><i>현행</i><b>%s</b></span>' % (kind, esc(t), esc(v)))
    return "".join(out)


CMP_KIND = {"현행": "cur", "현황": "cur", "요구안": "req", "법령": "law", "판례": "law", "비교": "ref",
            "유사기관": "ref", "연동": "lnk", "구조": "lnk", "개정 규정": "fix", "근거": "etc", "참고": "etc",
            "정관": "cur", "배경": "etc"}


def render_side(box, part):
    if not box:
        return ""
    secs = []
    if box["easy"]:
        o = ['<section class="easy"><span class="lb">해설</span>']
        for b in box["easy"]:
            if b["k"] == "ul":
                o += ["<p>%s</p>" % link_refs(x, part) for x in b["items"]]
            elif b["k"] == "p":
                o.append("<p>%s</p>" % link_refs(b["h"], part))
            else:
                o.append(render_table(b["rows"], part))
        o.append("</section>")
        secs.append("".join(o))
    if box["law"]:
        o = ['<section class="rel"><span class="lb">관련 법령과 판례</span>']
        for b in box["law"]:
            if b["k"] == "ul":
                o.append("<ul>" + "".join("<li>%s</li>" % link_refs(x, part) for x in b["items"]) + "</ul>")
            elif b["k"] == "p":
                o.append("<p>%s</p>" % link_refs(b["h"], part))
            else:
                o.append(render_table(b["rows"], part))
        o.append("</section>")
        secs.append("".join(o))
    if box["cmp"]:
        o = ['<section><span class="lb">현행 규정·협약과의 비교</span><dl class="cmp">']
        for c in box["cmp"]:
            if "table" in c:
                o.append('<dd class="full">%s</dd>' % render_table(c["table"], part))
            elif c["label"]:
                o.append('<dt class="k-%s">%s</dt><dd>%s</dd>' % (CMP_KIND.get(c["label"], "etc"), esc(c["label"]), link_refs(c["h"], part)))
            else:
                o.append('<dd class="full">%s</dd>' % link_refs(c["h"], part))
        o.append("</dl></section>")
        secs.append("".join(o))
    if not secs:
        return ""
    return '<div class="side">%s</div>' % "".join(secs)


def talk(key):
    return ('<div class="talk" data-talk="%s"><div class="talk-h"><b>의견</b><span data-cnt="%s"></span></div>'
            '<div class="thread" data-list="%s"></div>'
            '<form class="cf" data-form="%s"><textarea rows="1" name="b" placeholder="이 조문에 대한 의견이나 질문을 남겨 주세요." aria-label="의견 입력"></textarea>'
            '<button type="submit">의견 등록</button></form></div>') % (key, key, key, key)


def render_art(a, part):
    body = []
    for b in a["body"]:
        if b["k"] == "p":
            cls = ' class="%s"' % b["cls"] if b["cls"] else ""
            body.append("<p%s>%s</p>" % (cls, link_refs(b["h"], part, "law")))
        else:
            body.append(render_table(b["rows"], part))
    no = a["label"] if a["label"] != a["title"] else ""
    head = '<header class="ah">%s<h3>%s</h3><span class="ccount" data-cc="%s"></span><span class="lvs">%s</span></header>' % (
        '<span class="no">%s</span>' % esc(no) if no else "", esc(a["title"]), a["key"], badges((a["box"] or {}).get("badges", [])))
    search = esc(plain(" ".join(b.get("h", "") for b in a["body"])))
    return '<article class="art" id="%s" data-k="%s">%s<div class="law">%s</div>%s%s</article>' % (
        a["key"], a["key"], head, "".join(body), render_side(a["box"], part), talk(a["key"]))


def render_agreement(pre):
    items = doc[pre]
    o, toc = [], []
    cur_toc = None
    art_count = {}
    ch = None
    for it in items:
        if it["type"] == "chapter":
            ch = it["key"]
            art_count[ch] = 0
        elif it["type"] == "art" and ch:
            art_count[ch] += 1
    for it in items:
        if it["type"] == "chapter":
            n = art_count.get(it["key"], 0)
            o.append('<div class="chap" id="%s"><h2>%s</h2><span class="cnt">%d개 조문</span></div>' % (it["key"], esc(it["title"]), n))
            cur_toc = {"title": it["title"], "key": it["key"], "rows": []}
            toc.append(cur_toc)
        elif it["type"] == "section":
            o.append('<h3 class="sect">%s</h3>' % esc(it["title"]))
            if cur_toc is not None:
                cur_toc["rows"].append('<div class="tc-s">%s</div>' % esc(it["title"]))
        else:
            o.append(render_art(it, pre))
            num = it["num"] if not it.get("annex") else it["num"].replace("별표 ", "표")
            if it.get("sup"):
                num = "부" + it["num"]
            row = '<a class="tc-a" href="#%s" data-go="%s"><i>%s</i><span>%s</span><b class="cc" data-tcc="%s"></b></a>' % (
                it["key"], it["key"], esc(num), esc(it["title"]), it["key"])
            if cur_toc is None:
                toc.append({"title": it["title"], "key": it["key"], "rows": None})
            else:
                cur_toc["rows"].append(row)
    t = []
    for c in toc:
        if c["rows"] is None:
            t.append('<div class="tc"><a class="tc-h" href="#%s" data-go="%s">%s</a></div>' % (c["key"], c["key"], esc(c["title"])))
        else:
            n = sum(1 for r in c["rows"] if r.startswith("<a"))
            t.append('<div class="tc"><button class="tc-h" type="button">%s<span class="n">%d</span></button><div class="tc-b">%s</div></div>' % (
                esc(c["title"]), n, "".join(c["rows"])))
    return "".join(o), "".join(t)


LEGEND = """
<div class="legend">
 <div><h3>법정 기준과 견주면</h3><ul>
  <li><span class="lv up"><i>법정</i><b>초과</b></span>법으로 정한 기준보다 높은 수준</li>
  <li><span class="lv same"><i>법정</i><b>유지</b></span>법이 정한 내용을 협약으로 확인</li>
  <li><span class="lv none"><i>법정</i><b>기준 없음</b></span>법령에 정한 기준이 없는 사항</li></ul></div>
 <div><h3>현행 규정·협약과 견주면</h3><ul>
  <li><span class="lv new"><i>현행</i><b>신설</b></span>현행 규정·협약에 없던 내용</li>
  <li><span class="lv up"><i>현행</i><b>취업규칙 초과</b></span>현행보다 높은 수준</li>
  <li><span class="lv same"><i>현행</i><b>기본협약 유지</b></span>현행과 같은 수준</li></ul></div>
</div>"""


def guide(kind):
    n_d = sum(1 for x in doc["d"] if x["type"] == "art" and x["key"] != "d-pre")
    n_w = sum(1 for x in doc["w"] if x["type"] == "art")
    if kind == "d":
        return ("""<div class="guide"><h2>2027년 단체협약(안)</h2><p class="sub">전문과 본문 151개 조, 부칙 8개 조, 별표 3개로 이루어져 있습니다.</p>
<p>조문마다 왼쪽에 요구안 원문을, 오른쪽에 해설과 관련 법령, 현행 규정·협약과의 비교를 두었습니다. 밑줄 친 조문 번호에 마우스를 올리면 그 조문의 원문이 보이고, 누르면 해당 조문으로 이동합니다.</p>
<p class="noprint">조문 아래 의견란에 질문이나 의견을 남겨 주시면 조합과 연구소가 함께 볼 수 있습니다. 의견에는 이름과 소속이 함께 표시됩니다.</p>%s</div>""" % LEGEND)
    return ("""<div class="guide"><h2>2027년 임금협약(안)</h2><p class="sub">본문 18개 조와 별표 2개로 이루어져 있습니다.</p>
<p>제도는 단체협약(안)에 두고, 2027년에 적용할 금액과 지급 방식은 임금협약(안)에 정했습니다. 조문 제목 옆의 표시는 2026년 임금협약과 견준 수준입니다.</p></div>""")


# ---------- 도입 ----------
def render_intro():
    o = ['<div class="letter"><p class="kicker">%s · 녹색전환연구소노동조합</p><h1>교섭을 시작하며</h1>' % esc(doc["date"])]
    paras = doc["intro"]
    sign_from = len(paras)
    for i, p in enumerate(paras):
        if re.match(r"^\d{4}년\s*\d{1,2}월$", p["t"]):
            sign_from = i
            break
    for p in paras[:sign_from]:
        if p["bold"]:
            o.append("<h3>%s</h3>" % strip_b(p["h"]))
        else:
            o.append("<p>%s</p>" % p["h"])
    o.append('<div class="sign">' + "".join("<p>%s</p>" % strip_b(p["h"]) for p in paras[sign_from:]) + "</div></div>")
    o.append("""<div class="toc-cards">
<button type="button" data-tab="p-d"><b>단체협약(안)</b><span>노동조건과 노사관계 전반의 제도 · 151개 조</span></button>
<button type="button" data-tab="p-w"><b>임금협약(안)</b><span>2027년 기본급, 직책수당, 복리후생 금품 · 18개 조</span></button>
<button type="button" data-tab="p-ap"><b>부록</b><span>법정 기준 대비 수준, 개정이 필요한 규정, 참고문헌</span></button>
<button type="button" data-tab="p-r"><b>현행 규정</b><span>기본협약, 2026년 임금협약, 취업규칙 등 7개 문서</span></button>
</div>""")
    o.append('<div class="letter-talk">%s</div>' % talk("intro").replace("이 조문에 대한", "교섭 전반에 대한"))
    return "".join(o)


# ---------- 부록 ----------
def render_appx():
    o, t = [], []
    for s in doc["appx"]:
        if s["level"] == 2 and s["key"] == "ap-D":
            o.append('<h2 class="ap-h2" id="%s">%s</h2>' % (s["key"], esc(s["title"])))
            for b in s["blocks"]:
                if b["k"] == "p":
                    o.append('<p class="ap-lead">%s</p>' % link_refs(b["h"], "d"))
            t.append('<div class="tc open"><a class="tc-h" href="#%s" data-go="%s">%s</a><div class="tc-b">' % (s["key"], s["key"], esc(s["title"])))
            continue
        bd = []
        first_table = True
        for b in s["blocks"]:
            if b["k"] == "p":
                cls = ' class="note"' if not first_table else ""
                bd.append("<p%s>%s</p>" % (cls, link_refs(b["h"], "d")))
            else:
                bd.append(render_table(b["rows"], "d"))
                first_table = False
        title = s["title"]
        o.append('<section class="ap" id="%s" data-k="%s"><header class="ah"><h3>%s</h3><span class="ccount" data-cc="%s"></span></header><div class="bd">%s</div>%s</section>' % (
            s["key"], s["key"], esc(title), s["key"], "".join(bd), talk(s["key"]).replace("이 조문에 대한", "이 자료에 대한")))
        if s["key"].startswith("ap-D") and len(s["key"]) > 4:
            t.append('<a class="tc-a" href="#%s" data-go="%s"><i>%s</i><span>%s</span><b class="cc" data-tcc="%s"></b></a>' % (
                s["key"], s["key"], s["key"][4:], esc(re.sub(r"^\d+\.\s*", "", title)), s["key"]))
        else:
            t.append('<div class="tc"><a class="tc-h" href="#%s" data-go="%s">%s<b class="cc" data-tcc="%s"></b></a></div>' % (
                s["key"], s["key"], esc(title), s["key"]))
    if any(s["key"] == "ap-D" for s in doc["appx"]):
        t.append("</div></div>")
    return "".join(o), "".join(t)


# ---------- 현행 규정 ----------
def current_rules():
    raw = open(os.path.join(SRC, "current-rules.html"), encoding="utf-8").read()
    raw = raw.replace("사용자가 제공한 원문에", "원문에")
    # 조합원 공유본의 껍데기(div.pane)를 벗기고 문서 묶음만 씁니다
    m = re.search(r'<div class="pane doc" id="p-r">(.*)</div>\s*$', raw, re.S)
    inner = m.group(1) if m else raw
    slug_by_id = {"r-basic": "basic", "r-wage": "wage26", "r-취업규칙": "work", "r-운영실무규정": "ops",
                  "r-고충처리규정": "griev", "r-회계실무규정": "acct", "r-퇴직연금규약": "pension"}
    name_by_slug = {v: k for k, v in RULE_SLUG.items()}
    out, pos = [], 0
    parts = re.split(r'(<div id="r-[^"]+" class="rdoc[^"]*">)', inner)
    cur = None
    for seg in parts:
        mm = re.match(r'<div id="(r-[^"]+)"', seg)
        if mm:
            cur = slug_by_id.get(mm.group(1))
            out.append(seg)
            continue
        if cur:
            def add_id(ma):
                block = ma.group(0)
                hm = re.search(r"<h5>제(\d+)조(?:의(\d+))?\s*(?:\(([^<]*)\))?</h5>", block)
                if not hm:
                    return block
                n = hm.group(1) + ("의" + hm.group(2) if hm.group(2) else "")
                key = "R|%s|%s" % (cur, n)
                if key not in REF_DATA:
                    body = [html.unescape(re.sub(r"<[^>]+>", "", x)) for x in re.findall(r"<p[^>]*>(.*?)</p>", block, re.S)]
                    title = name_by_slug[cur] + " 제%s조" % n + ("(%s)" % html.unescape(hm.group(3)) if hm.group(3) else "")
                    REF_DATA[key] = {"t": title, "b": [x for x in body if x.strip()]}
                return block.replace('<div class="ra">', '<div class="ra" id="r-%s-%s">' % (cur, n), 1)
            seg = re.sub(r'<div class="ra">.*?(?=<div class="ra">|<h4|$)', add_id, seg, flags=re.S)
        out.append(seg)
    inner = "".join(out)
    names = re.findall(r'<div id="(r-[^"]+)" class="rdoc', inner)
    titles = re.findall(r'class="rdoc[^"]*"><h3>([^<]+)</h3>', inner)
    btn = "".join('<button class="rbtn%s" type="button" data-r="%s">%s</button>' % (
        " on" if i == 0 else "", n, esc(re.sub(r"\s*\(.*\)$", "", t))) for i, (n, t) in enumerate(zip(names, titles)))
    return inner, '<div class="rbtns">%s</div>' % btn


d_html, d_toc = render_agreement("d")
w_html, w_toc = render_agreement("w")
ap_html, ap_toc = render_appx()
r_html, r_toc = current_rules()

# 법령 조문 원문(src/laws.json)과 정관 요약
LAWS_PATH = os.path.join(SRC, "laws.json")
LAWS = json.load(open(LAWS_PATH, encoding="utf-8")) if os.path.exists(LAWS_PATH) else {}
for name, arts in LAWS.items():
    for n, a in arts.items():
        REF_DATA["L|%s|%s" % (name, n)] = {"t": "「%s」 제%s조%s" % (name, n, "(%s)" % a["title"] if a.get("title") else ""),
                                            "b": a["lines"], "src": "법제처 국가법령정보센터 현행 법령"}
REF_DATA["R|charter|14"] = {"t": "정관 제14조", "b": ["이사장은 법인을 대표한다."], "src": "정관 원문이 아닌 요지입니다."}
REF_DATA["R|charter|29"] = {"t": "정관 제29조", "b": ["소장이 사무국 업무를 총괄하며, 제5항은 취업규칙의 개정에 이사회 의결을 요구한다."], "src": "정관 원문이 아닌 요지입니다."}

missing_laws = sorted("%s 제%s조" % (k, n) for k, ns in LAW_REFS.items() for n in ns if "L|%s|%s" % (k, n) not in REF_DATA)
if missing_laws:
    print("본문을 찾지 못한 법령 조문 %d개" % len(missing_laws))
    json.dump({k: sorted(v) for k, v in LAW_REFS.items()}, open(os.path.join(ROOT, "build", "law_refs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def drop_dead_refs(h):
    def f(m):
        return m.group(0) if html.unescape(m.group(1)) in REF_DATA else m.group(2)
    h = re.sub(r'<a class="ref" href="[^"]*" data-r="([^"]+)"[^>]*>([^<]*)</a>', f, h)
    return re.sub(r'<span class="ref" tabindex="0" data-r="([^"]+)">([^<]*)</span>', f, h)


d_html, w_html, ap_html, r_html = map(drop_dead_refs, (d_html, w_html, ap_html, r_html))

pw = os.environ.get("GATE_PASSWORD", "")
gate_hash = hashlib.sha256(pw.encode("utf-8")).hexdigest() if pw else ""

css = open(os.path.join(ROOT, "tools", "style.css"), encoding="utf-8").read()
js = open(os.path.join(ROOT, "tools", "app.js"), encoding="utf-8").read()
cfg = {"sbUrl": SB_URL, "sbKey": SB_KEY, "gate": gate_hash, "title": doc["title"], "date": doc["date"]}

TITLE = "2027 임금·단체교섭 요구안 해설"
page = """<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>%(title)s</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<style>%(css)s</style></head>
<body class="p-cur">
<header><div class="hin">
 <div class="brand"><b>%(title)s</b><small>녹색전환연구소노동조합이 연구소에 드리는 공유본 · %(date)s</small></div>
 <nav class="tabs" aria-label="문서">
  <button type="button" data-p="p-in" aria-selected="true">교섭을 시작하며</button>
  <button type="button" data-p="p-d" aria-selected="false">단체협약(안)</button>
  <button type="button" data-p="p-w" aria-selected="false">임금협약(안)</button>
  <button type="button" data-p="p-ap" aria-selected="false">부록</button>
  <button type="button" data-p="p-r" aria-selected="false">현행 규정</button>
 </nav>
 <div class="hact">
  <button class="hbtn opt" id="expBtn" type="button">의견 내려받기</button>
  <button class="hbtn opt" id="printBtn" type="button">인쇄</button>
  <button class="hbtn me" id="meBtn" type="button">이름 설정</button>
 </div>
</div></header>
<div class="wrap solo" id="wrap">
<aside>
 <input id="q" type="search" placeholder="낱말로 조문 찾기" aria-label="조문 찾기">
 <div class="tg" data-p="p-d">%(d_toc)s</div>
 <div class="tg" data-p="p-w">%(w_toc)s</div>
 <div class="tg" data-p="p-ap">%(ap_toc)s</div>
 <div class="tg" data-p="p-r">%(r_toc)s</div>
</aside>
<main>
 <div class="printhead"><b>%(title)s</b><span>녹색전환연구소노동조합 · 연구소 공유본 · %(date)s</span></div>
 <div class="pane pr on" id="p-in">%(intro)s</div>
 <div class="pane pr" id="p-d">%(gd)s%(d)s</div>
 <div class="pane pr" id="p-w">%(gw)s%(w)s</div>
 <div class="pane pr" id="p-ap">%(ap)s</div>
 <div class="pane" id="p-r">%(r)s</div>
</main></div>

<div class="dlg" id="meDlg" role="dialog" aria-modal="true" aria-labelledby="meT"><form class="box" id="meForm">
 <h3 id="meT">이름과 소속을 적어 주세요</h3>
 <p>남기시는 의견에 이름과 소속이 함께 표시됩니다. 이 브라우저에 저장되며 언제든 바꿀 수 있습니다.</p>
 <input id="meName" type="text" maxlength="40" placeholder="이름" autocomplete="name" required>
 <fieldset><legend>소속</legend><div class="seg">
  <label class="i"><input type="radio" name="org" value="연구소" required>연구소</label>
  <label><input type="radio" name="org" value="조합">조합</label></div></fieldset>
 <div class="err" id="meErr"></div>
 <div class="row"><button type="button" data-close>취소</button><button class="p" type="submit">저장</button></div>
</form></div>

<div class="dlg" id="prDlg" role="dialog" aria-modal="true" aria-labelledby="prT"><form class="box" id="prForm">
 <h3 id="prT">인쇄하기</h3>
 <p>목차와 버튼을 뺀 인쇄용 레이아웃으로 출력합니다. 인쇄 창에서 "PDF로 저장"을 고르면 파일로도 남길 수 있습니다.</p>
 <fieldset><legend>범위</legend><div class="seg">
  <label><input type="radio" name="scope" value="cur" checked>지금 보는 탭</label>
  <label><input type="radio" name="scope" value="all">요구안 전체</label></div></fieldset>
 <label class="chkrow"><input type="checkbox" name="cmt">남긴 의견도 함께 인쇄</label>
 <div class="row"><button type="button" data-close>취소</button><button class="p" type="submit">인쇄</button></div>
</form></div>

<div id="gate"><form class="box" id="gateForm">
 <h3>2027 임금·단체교섭<br>요구안 해설</h3>
 <p>녹색전환연구소노동조합이 연구소와 함께 보기 위해 만든 공유본입니다. 전달받은 암호를 입력해 주세요.</p>
 <input id="gateIn" type="password" placeholder="암호" autocomplete="current-password" aria-label="암호">
 <button type="submit">열기</button>
 <div class="err" id="gateErr"></div>
</form></div>
<div id="tip" role="tooltip"></div>
<div id="toast" role="status" aria-live="polite"></div>
<script>var CFG=%(cfg)s;var REF=%(ref)s;</script>
<script>%(js)s</script>
</body></html>""" % {
    "title": TITLE, "date": esc(doc["date"]), "css": css, "d_toc": d_toc, "w_toc": w_toc, "ap_toc": ap_toc, "r_toc": r_toc,
    "intro": render_intro(), "gd": guide("d"), "d": d_html, "gw": guide("w"), "w": w_html, "ap": ap_html, "r": r_html,
    "cfg": json.dumps(cfg, ensure_ascii=False), "ref": json.dumps(REF_DATA, ensure_ascii=False, separators=(",", ":")),
    "js": js,
}

for _t in DROP_TEXT:
    page = page.replace(_t, "")
assert "부록 D" not in page and "노사 공유 자료" not in page
open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(page)
print("index.html %d bytes, 단체협약 %d, 임금협약 %d, 암호 %s" % (
    len(page.encode()), sum(1 for k in ARTS if k.startswith("d-")), sum(1 for k in ARTS if k.startswith("w-")),
    "설정됨" if gate_hash else "없음(게이트 꺼짐)"))
