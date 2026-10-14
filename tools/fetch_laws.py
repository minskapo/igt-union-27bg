"""요구안이 인용한 법령 조문의 현행 원문을 법제처 국가법령정보센터에서 가져와 src/laws.json에 저장합니다.

사용: python3 tools/fetch_laws.py   (build/law_refs.json이 있어야 합니다. tools/build.py를 먼저 한 번 실행하세요.)
"""
import html
import json
import os
import re
import subprocess
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 법령 이름 -> "시행일자:법령일련번호(MST)". 2026년 10월 14일 기준 현행본입니다.
MST = {
    "근로기준법": "20261008:285279",
    "근로기준법 시행령": "20251023:270551",
    "노동조합 및 노동관계조정법": "20260310:273667",
    "남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률": "20260918:284457",
    "산업안전보건법": "20260801:283449",
    "개인정보 보호법": "20260911:283839",
    "근로자참여 및 협력증진에 관한 법률": "20221211:243063",
    "대한민국헌법": "19880225:61603",
    "산업재해보상보험법": "20260701:283459",
    "기간제 및 단시간근로자 보호 등에 관한 법률": "20210518:232201",
    "성폭력범죄의 처벌 등에 관한 특례법": "20261002:289993",
    "고용보험법": "20260918:284449",
    "국가인권위원회법": "20261002:288593",
    "공직선거법": "20261002:290229",
    "민법": "20260317:284415",
    "고용상 연령차별금지 및 고령자고용촉진에 관한 법률": "20220610:243057",
    "관공서의 공휴일에 관한 규정": "20260511:285779",
    "예비군법": "20260828:283687",
    "민방위기본법": "20250604:266645",
    "채용절차의 공정화에 관한 법률": "20200526:218301",
    "통신비밀보호법": "20261002:290003",
    "모자보건법": "20260910:286727",
    "근로자퇴직급여 보장법": "20260918:284455",
    "산업안전보건기준에 관한 규칙": "20260302:273603",
}


def fetch(spec):
    efyd, mst = spec.split(":")
    for attempt in range(6):
        r = subprocess.run(["curl", "-s", "-m", "60", "-A", "Mozilla/5.0", "-X", "POST",
                            "https://www.law.go.kr/LSW/lsInfoR.do", "-d", "lsiSeq=%s&efYd=%s&ancYnChk=0" % (mst, efyd)],
                           capture_output=True)
        if r.returncode == 0 and len(r.stdout) > 10000:
            return r.stdout.decode("utf-8", "ignore")
        time.sleep(3 + attempt * 3)
    raise RuntimeError("가져오지 못함: MST %s" % mst)


def _unused(mst):
    out = subprocess.run(["curl", "-s", "-m", "60", "-A", "Mozilla/5.0", "-X", "POST",
                          "https://www.law.go.kr/LSW/lsInfoR.do", "-d", "lsiSeq=%s&ancYnChk=0" % mst],
                         capture_output=True, check=True).stdout
    return out.decode("utf-8", "ignore")


def to_lines(block):
    block = re.sub(r'<span class="sfon">.*?</span>', "", block, flags=re.S)  # <개정 ...> 표기
    block = re.sub(r"(?i)<br\s*/?>|</p>|</div>", "\n", block)
    text = html.unescape(re.sub(r"<[^>]+>", "", block)).replace("\xa0", " ")
    lines = [re.sub(r"\s+", " ", x).strip() for x in text.split("\n")]
    return [x for x in lines if x]


def parse(page):
    arts = {}
    # 본문 조문은 <a name="J60:0"> 같은 앵커로 시작합니다. 부칙은 다른 형식이라 걸러집니다.
    marks = list(re.finditer(r'<a name="J(\d+):(\d+)"', page))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(page)
        block = page[m.start():end]
        cut = block.find('class="pty3_dep1"')  # 부칙 영역이 섞이면 잘라냅니다
        if cut > 0:
            block = block[:cut]
        lines = to_lines(block)
        if not lines:
            continue
        n = m.group(1) + ("의" + m.group(2) if m.group(2) != "0" else "")
        label = "제%s조" % m.group(1) + ("의" + m.group(2) if m.group(2) != "0" else "")
        hm = re.match(r"^%s\s*(?:\(([^)]*)\))?\s*(.*)$" % re.escape(label), lines[0])
        if not hm:
            continue
        title, rest = (hm.group(1) or "").strip(), hm.group(2).strip()
        body = ([rest] if rest else []) + lines[1:]
        while body and re.match(r"^제\d+(장|절|관)(의\d+)?\s", body[-1]):
            body.pop()  # 다음 장·절 제목이 붙어 온 경우
        arts[n] = {"title": title, "lines": body}
    return arts


def main():
    refs = json.load(open(os.path.join(ROOT, "build", "law_refs.json"), encoding="utf-8"))
    path = os.path.join(ROOT, "src", "laws.json")
    have = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    for name, nums in refs.items():
        if name not in MST:
            print("MST 없음:", name)
            continue
        need = [n for n in nums if n not in have.get(name, {})]
        if not need:
            continue
        try:
            arts = parse(fetch(MST[name]))
        except RuntimeError as e:
            print(e)
            continue
        got = have.setdefault(name, {})
        for n in need:
            if n in arts:
                got[n] = arts[n]
            else:
                print("조문 없음: %s 제%s조" % (name, n.replace("의", "조의").rstrip("조") if "의" in n else n))
        print("%s: %d/%d" % (name, sum(1 for n in need if n in arts), len(need)))
        json.dump(have, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(1)
    json.dump(have, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
