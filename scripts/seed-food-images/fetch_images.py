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
    raise last


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def fetch_one(article):
    data = get(VI_API, {
        "action": "query", "prop": "pageimages", "titles": article,
        "format": "json", "pithumbsize": 640, "pilicense": "free",
    })
    pages = data.get("query", {}).get("pages", {}).values()
    page = next(iter(pages), {})
    if page.get("missing") is not None or not page.get("thumbnail"):
        return ("no-image", "", "")
    thumb = page["thumbnail"]["source"]
    file = "File:" + page["pageimage"]
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
    rows = list(csv.DictReader((BASE / "dishes.csv").open(encoding="utf-8")))
    if not emit:
        out = []
        for r in rows:
            try:
                status, url, credit = fetch_one(r["article"])
            except Exception as e:  # noqa: BLE001 - ghi nhận để review
                status, url, credit = (f"error: {e}", "", "")
            out.append({**r, "status": status, "image_url": url, "image_credit": credit})
            print(f"{ascii(r['food_name_vi'])}: {ascii(status)}")
            time.sleep(2)
        with (BASE / "pending.csv").open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["food_name_vi", "article", "status", "image_url", "image_credit"])
            w.writeheader()
            w.writerows(out)
        print(f"wrote {len(out)} rows -> pending.csv (review manually before --emit)")
        return
    pend = [r for r in csv.DictReader((BASE / "pending.csv").open(encoding="utf-8")) if r["status"] == "ok"]

    def sql_str(v):
        return "'" + v.replace("'", "''") + "'"

    lines = [
        "",
        "-- Seed ảnh Wikimedia (sinh tự động, đã review). UPDATE theo tên canonical.",
    ]
    for r in pend:
        lines.append(
            f"UPDATE foods SET image_url = {sql_str(r['image_url'])}, "
            f"image_credit = {sql_str(r['image_credit'])} "
            f"WHERE food_name_vi = {sql_str(r['food_name_vi'])} AND image_url IS NULL;"
        )
    mig = BASE.parent.parent / "src" / "database" / "migrations" / "021-food-images.sql"
    text = mig.read_text(encoding="utf-8")
    marker = "-- Seed ảnh Wikimedia"
    if marker in text:
        print("021 đã có seed, bỏ qua (immutable sau khi applied)")
        return
    mig.write_text(text + "\n".join(lines) + "\n", encoding="utf-8")
    print(f"appended {len(pend)} updates -> 021-food-images.sql")


if __name__ == "__main__":
    main()
