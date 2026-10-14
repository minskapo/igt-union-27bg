"""구글 문서(HTML 내보내기)를 사측 공유본 페이지용 데이터 구조로 바꿉니다.

사용: python3 tools/parse_doc.py src/gdoc.html > build/doc.json
"""
import html
import json
import re
import sys
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup, NavigableString, Tag

BOX_LABELS = ("해설", "관련 법령과 판례", "현행 규정·협약과의 비교")
CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"


def norm(s):
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


def style_of(el):
    return (el.get("style") or "") if isinstance(el, Tag) else ""


def unwrap_link(href):
    if href and href.startswith("https://www.google.com/url"):
        q = parse_qs(urlparse(href).query).get("q")
        if q:
            return q[0]
    return href


def inline(el):
    """문단 안의 span을 굵게·기울임·밑줄·취소선·링크만 남긴 HTML로 바꿉니다."""
    out = []
    for ch in el.children:
        if isinstance(ch, NavigableString):
            out.append(html.escape(str(ch).replace("\xa0", " "), quote=False))
            continue
        if not isinstance(ch, Tag):
            continue
        if ch.name == "br":
            out.append("<br>")
            continue
        if ch.name == "a":
            href = unwrap_link(ch.get("href"))
            inner = inline(ch)
            if href and href.startswith("http"):
                out.append('<a href="%s" target="_blank" rel="noopener">%s</a>' % (html.escape(href), inner))
            else:
                out.append(inner)
            continue
        if ch.name in ("sup", "sub"):
            out.append("<%s>%s</%s>" % (ch.name, inline(ch), ch.name))
            continue
        inner = inline(ch)
        if not inner:
            continue
        st = style_of(ch)
        if "font-weight:700" in st and inner.strip():
            inner = "<b>%s</b>" % inner
        if "font-style:italic" in st and inner.strip():
            inner = "<i>%s</i>" % inner
        if "text-decoration:underline" in st and inner.strip() and ch.name != "a":
            inner = "<u>%s</u>" % inner
        if "line-through" in st and inner.strip():
            inner = "<s>%s</s>" % inner
        out.append(inner)
    s = "".join(out)
    # 같은 서식이 쪼개져 이어진 경우를 합칩니다
    for t in ("b", "i", "u", "s"):
        s = s.replace("</%s><%s>" % (t, t), "")
    return s


def text(el):
    return norm(el.get_text(""))


def table_rows(tbl):
    rows = []
    for tr in tbl.find_all("tr", recursive=False) or (tbl.tbody.find_all("tr", recursive=False) if tbl.tbody else []):
        cells = []
        for td in tr.find_all("td", recursive=False):
            parts = [inline(p) for p in td.find_all(["p", "li"]) if text(p)]
            cells.append({
                "h": "<br>".join(parts),
                "t": text(td),
                "bold": all("font-weight:700" in style_of(sp) for sp in td.find_all("span") if norm(sp.get_text(""))) and bool(text(td)),
                "cs": int(td.get("colspan", 1)),
                "rs": int(td.get("rowspan", 1)),
            })
        rows.append(cells)
    return rows


def classify_para(t):
    if t and t[0] in CIRCLED:
        return "hang"
    if re.match(r"^\d+\.\s", t):
        return "ho"
    if re.match(r"^[가-하]\.\s", t):
        return "mok"
    if re.match(r"^\d+\)\s", t):
        return "mok2"
    return ""


def badge_texts(td):
    out = []
    for sp in td.find_all("span"):
        st = style_of(sp)
        t = norm(sp.get_text(""))
        if t and "background-color" in st and "#ffffff" not in st:
            out.append(t)
    return out


def parse_box(tbl):
    """조문 아래의 회색·노란 상자에서 수준 표시, 해설, 관련 법령, 현행 비교를 꺼냅니다."""
    res = {"badges": [], "easy": [], "law": [], "cmp": []}
    tds = tbl.find_all("td")
    top = [td for td in tbl.find_all("td") if td.find_parent("table") is tbl]
    cur = None
    for td in top:
        b = badge_texts(td)
        if b and not any(text(p) in BOX_LABELS for p in td.find_all("p")):
            res["badges"] = b
            continue
        for node in td.children:
            if not isinstance(node, Tag):
                continue
            if node.name == "p":
                t = text(node)
                if not t:
                    continue
                if t in BOX_LABELS:
                    cur = {"해설": "easy", "관련 법령과 판례": "law", "현행 규정·협약과의 비교": "cmp"}[t]
                    continue
                if cur == "cmp":
                    spans = [s for s in node.find_all("span") if norm(s.get_text(""))]
                    label = ""
                    if spans and "font-weight:700" in style_of(spans[0]):
                        label = norm(spans[0].get_text(""))
                        spans[0].decompose()
                    res["cmp"].append({"label": label, "h": inline(node).strip()})
                elif cur:
                    res[cur].append({"k": "p", "h": inline(node).strip()})
            elif node.name in ("ul", "ol"):
                items = [inline(li).strip() for li in node.find_all("li", recursive=False)]
                if cur == "cmp":
                    for it in items:
                        res["cmp"].append({"label": "", "h": it})
                elif cur:
                    res[cur].append({"k": "ul", "items": items})
            elif node.name == "table":
                if cur == "cmp":
                    res["cmp"].append({"label": "", "table": table_rows(node)})
                elif cur:
                    res[cur].append({"k": "table", "rows": table_rows(node)})
    return res


def is_box(tbl):
    rows = tbl.find_all("tr", recursive=False)
    if not rows:
        return False
    if any(len(r.find_all("td", recursive=False)) != 1 for r in rows):
        return False
    t = text(tbl)
    return bool(badge_texts(rows[0])) or any(lb in t[:40] for lb in BOX_LABELS)


ART_RE = re.compile(r"^(부칙\s*)?제(\d+)조(?:의(\d+))?\s*\((.+)\)$")
TBL_RE = re.compile(r"^별표\s*(\d+)\.\s*(.+)$")


def parse(path):
    soup = BeautifulSoup(open(path, encoding="utf-8").read(), "lxml")
    kids = [k for k in soup.body.children if isinstance(k, Tag)]

    def find_h1(label, start=0):
        for i in range(start, len(kids)):
            if kids[i].name == "h1" and text(kids[i]).replace(" ", "") == label.replace(" ", ""):
                return i
        raise KeyError(label)

    i_intro = find_h1("교섭을 시작하며")
    i_d = find_h1("2027년 단체협약 (안)")
    i_p2 = find_h1("제2부 2027년 임금교섭 요구안")
    i_w = find_h1("2027년 임금협약 (안)")
    i_ap = find_h1("부록")

    # 도입
    intro = []
    for k in kids[i_intro + 1:]:
        if k.name == "h1":
            break
        if k.name == "p" and text(k):
            t = text(k)
            all_bold = all("font-weight:700" in style_of(sp) for sp in k.find_all("span") if norm(sp.get_text("")))
            intro.append({"h": inline(k).strip(), "t": t, "bold": all_bold})

    def parse_agreement(start, end, pre):
        items = []  # 순서대로: chapter / section / article
        cur = None
        chapter = ""
        for k in kids[start + 1:end]:
            t = text(k)
            if k.name == "h1" or k.name == "hr":
                continue
            if k.name == "h2":
                if not t:
                    continue
                chapter = t
                if t == "전문":
                    cur = {"type": "art", "key": pre + "-pre", "num": "", "title": "전문", "label": "전문",
                           "chapter": "", "body": [], "box": None}
                    items.append(cur)
                else:
                    items.append({"type": "chapter", "title": t, "key": pre + "-c%d" % sum(1 for x in items if x["type"] == "chapter")})
                    cur = None
                continue
            if k.name == "h3":
                if not t:
                    continue
                items.append({"type": "section", "title": t})
                cur = None
                continue
            if k.name == "h4":
                if not t:
                    continue
                m = ART_RE.match(t)
                mt = TBL_RE.match(t)
                if m:
                    is_sup = bool(m.group(1)) or chapter.replace(" ", "") == "부칙"
                    n = m.group(2) + ("의" + m.group(3) if m.group(3) else "")
                    key = "%s-%s%s" % (pre, "a" if is_sup else "", n)
                    label = ("부칙 " if is_sup else "") + "제%s조" % n
                    cur = {"type": "art", "key": key, "num": n, "sup": is_sup, "title": norm(m.group(4)),
                           "label": label, "chapter": chapter, "body": [], "box": None}
                elif mt:
                    key = "%s-t%s" % (pre, mt.group(1))
                    cur = {"type": "art", "key": key, "num": "별표 " + mt.group(1), "title": norm(mt.group(2)),
                           "label": "별표 " + mt.group(1), "chapter": chapter, "body": [], "box": None, "annex": True}
                else:
                    raise ValueError("알 수 없는 소제목: " + t)
                items.append(cur)
                continue
            if cur is None:
                if t:
                    sys.stderr.write("무시한 요소(%s): %s\n" % (k.name, t[:60]))
                continue
            if k.name == "p":
                if not t:
                    continue
                cur["body"].append({"k": "p", "cls": classify_para(t), "h": inline(k).strip()})
            elif k.name == "table":
                if is_box(k):
                    box = parse_box(k)
                    if cur["box"] is None:
                        cur["box"] = box
                    else:
                        for f in ("easy", "law", "cmp"):
                            cur["box"][f].extend(box[f])
                        if box["badges"] and not cur["box"]["badges"]:
                            cur["box"]["badges"] = box["badges"]
                else:
                    cur["body"].append({"k": "table", "rows": table_rows(k)})
            elif k.name in ("ul", "ol"):
                for li in k.find_all("li", recursive=False):
                    tt = text(li)
                    cur["body"].append({"k": "p", "cls": classify_para(tt), "h": inline(li).strip()})
        return items

    d_items = parse_agreement(i_d, i_p2, "d")
    w_items = parse_agreement(i_w, i_ap, "w")

    # 부록
    appx = []
    sec = None
    for k in kids[i_ap + 1:]:
        t = text(k)
        if k.name in ("h2", "h3"):
            sec = {"level": int(k.name[1]), "title": t, "blocks": []}
            m = re.match(r"^([A-D])\.", t)
            m2 = re.match(r"^(\d+)\.", t)
            if k.name == "h2":
                sec["key"] = "ap-" + (m.group(1) if m else str(len(appx)))
                last_h2 = sec["key"]
            else:
                sec["key"] = last_h2 + (m2.group(1) if m2 else str(len(appx)))
            appx.append(sec)
            continue
        if sec is None:
            continue
        if k.name == "p" and t:
            sec["blocks"].append({"k": "p", "h": inline(k).strip()})
        elif k.name == "table":
            sec["blocks"].append({"k": "table", "rows": table_rows(k)})

    # 문서 머리
    title = text(soup.find("p", class_="title")) if soup.find("p", class_="title") else "2027년 임금·단체교섭 요구안 해설"
    date = ""
    for k in kids[:i_intro]:
        if re.match(r"^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.$", text(k)):
            date = text(k)
    return {"title": title, "date": date, "intro": intro, "d": d_items, "w": w_items, "appx": appx}


if __name__ == "__main__":
    data = parse(sys.argv[1])
    json.dump(data, sys.stdout, ensure_ascii=False, indent=1)
