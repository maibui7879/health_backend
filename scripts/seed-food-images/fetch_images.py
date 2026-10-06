"""Lấy ảnh Wikimedia cho catalog món ăn (top phổ biến, review tay).
Nguồn: lead image bài vi.wikipedia (pilicense=free) + author/license Commons.
Chạy: python scripts/seed-food-images/fetch_images.py  -> pending.csv
Review pending.csv (đúng món? ảnh rõ?) rồi chạy --emit để sinh UPDATE SQL.
"""
import csv
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
UA = {"User-Agent": "BeroHealth-seed/1.0 (food image attribution fetch)"}
VI_API = "https://vi.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"


def get(url, params, retries=4):
    qs = urllib.parse.urlencode(params)
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(f"{url}?{qs}", headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 429:
                time.sleep(10 * (i + 1))
                continue
            raise
        except OSError as e:
            # timeout/SSL/reset mạng: backoff rồi thử lại
            last = e
            time.sleep(5 * (i + 1))
            continue
    raise last


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def fetch_one(article, fallback=""):
    for title in [a for a in [article, fallback] if a]:
        data = get(VI_API, {
            "action": "query", "prop": "pageimages", "titles": title,
            "format": "json", "pithumbsize": 640, "pilicense": "free",
        })
        pages = data.get("query", {}).get("pages", {}).values()
        page = next(iter(pages), {})
        if page.get("missing") is None and page.get("thumbnail"):
            thumb = page["thumbnail"]["source"]
            file = "File:" + page["pageimage"]
            break
    else:
        return ("no-image", "", "")
    info = get(COMMONS_API, {
        "action": "query", "titles": file, "prop": "imageinfo",
        "iiprop": "user|extmetadata",
        "iiextmetadatafilter": "Artist|LicenseShortName",
        "format": "json",
    })
    ipages = info.get("query", {}).get("pages", {}).values()
    ipage = next(iter(ipages), {})
    meta = (ipage.get("imageinfo") or [{}])[0].get("extmetadata", {})
    author = strip_tags(meta.get("Artist", {}).get("value", "")) or ipage.get("user", "")
    lic = strip_tags(meta.get("LicenseShortName", {}).get("value", ""))
    credit = f"{author} ({lic})".strip() if lic else author
    return ("ok", thumb, credit[:200])


def main():
    emit = "--emit" in sys.argv
    out_name = "023-food-images-3.sql"
    for a in sys.argv:
        if a.startswith("--out="):
            out_name = a.split("=", 1)[1]
    rows = list(csv.DictReader((BASE / "dishes.csv").open(encoding="utf-8")))
    if not emit:
        done = {}
        try:
            for r in csv.DictReader((BASE / "pending.csv").open(encoding="utf-8")):
                if r["status"] == "ok" and r.get("image_url"):
                    done[r["food_name_vi"]] = r
        except FileNotFoundError:
            pass
        out = []
        for r in rows:
            if r["food_name_vi"] in done:
                print(f"{ascii(r['food_name_vi'])}: kept", flush=True)
                out.append(done[r["food_name_vi"]])
                continue
            try:
                status, url, credit = fetch_one(r["article"], r.get("fallback", ""))
            except Exception as e:  # noqa: BLE001 - ghi nhận để review
                status, url, credit = (f"error: {e}", "", "")
            out.append({**{k: r.get(k, "") for k in ("food_name_vi", "article", "fallback")}, "status": status, "image_url": url, "image_credit": credit})
            print(f"{ascii(r['food_name_vi'])}: {ascii(status)}", flush=True)
            time.sleep(2)
        with (BASE / "pending.csv").open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["food_name_vi", "article", "fallback", "status", "image_url", "image_credit"])
            w.writeheader()
            w.writerows(out)
        print(f"wrote {len(out)} rows -> pending.csv (review manually before --emit)")
        return
    pend = [r for r in csv.DictReader((BASE / "pending.csv").open(encoding="utf-8")) if r["status"] == "ok"]
    covered_path = BASE / "covered.txt"
    covered = set(covered_path.read_text(encoding="utf-8").splitlines()) if covered_path.exists() else set()
    pend = [r for r in pend if r["food_name_vi"] not in covered]
    if not pend:
        print("không có món mới, bỏ qua")
        return

    def sql_str(v):
        return "'" + v.replace("'", "''") + "'"

    header = """-- Migration: ảnh món ăn đợt 2 (Wikimedia Commons, đã review tay).
-- UPDATE theo tên canonical + AND image_url IS NULL (idempotent,
-- không đè ảnh đợt 1 hay sửa tay).

"""
    body = "\n".join(
        f"UPDATE foods SET image_url = {sql_str(r['image_url'])}, "
        f"image_credit = {sql_str(r['image_credit'])} "
        f"WHERE food_name_vi = {sql_str(r['food_name_vi'])} AND image_url IS NULL;"
        for r in pend
    ) + "\n"
    out_path = BASE.parent.parent / "src" / "database" / "migrations" / out_name
    if out_path.exists():
        print(f"{out_name} đã tồn tại, bỏ qua (immutable sau khi applied)")
        return
    out_path.write_text(header + body, encoding="utf-8")
    with covered_path.open("a", encoding="utf-8") as f:
        f.write("\n" + "\n".join(r["food_name_vi"] for r in pend))
    print(f"wrote {len(pend)} updates -> {out_name}")


if __name__ == "__main__":
    main()
