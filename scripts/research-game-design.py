#!/usr/bin/env python3
"""Read public research pages with inherited proxy/TLS settings.

Usage: python3 scripts/research-game-design.py URL [URL ...]
Raw pages stay outside the repository. HTTP success is not content verification.
No authentication, challenge solving, proxy changes, or automatic retries.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
import json
import html
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import urlopen


def extract_sakurai_index(path):
    """Extract metadata only; the public fan index is not a viewing record."""
    source = path.read_text()
    records = []
    pattern = r'<a\s[^>]*href="(https://www.youtube.com/watch\?v=[A-Za-z0-9_-]{11})"[^>]*>(.*?)</a>'
    for url, body in re.findall(pattern, source, re.S):
        heading = re.search(r'<h2[^>]*>(.*?)</h2>', body, re.S)
        if not heading:
            continue
        title = html.unescape(re.sub('<[^>]+>', '', heading[1]))
        category = re.search(r'【([^】]+)】', title)
        compilation = re.match(r'[A-M]:\s*(.*?)\s*\d*\s*\(まとめ動画\)', title)
        date = re.search(r'20\d\d/\d\d/\d\d', body)
        records.append({"url": url, "title": title,
                        "category": category[1] if category else compilation[1].strip() if compilation else "未分類・特別回",
                        "published_date_in_index": date[0] if date else None,
                        "retrieved_date": datetime.now(timezone.utc).date().isoformat(),
                        "discovery_source": "https://creating-games-unofficial.vercel.app/",
                        "reading_method": "公開非公式索引のHTMLからタイトル・URL・日付を抽出",
                        "review_status": "metadata_only",
                        "video_content_reviewed": False, "transcript_reviewed": False})
    if not records or len({r['url'] for r in records}) != len(records):
        raise ValueError("Empty or duplicate video index; inspect source before using it.")
    return records


def fetch(url, output):
    record = {"url": url, "retrieved_at": datetime.now(timezone.utc).isoformat(),
              "method": "public HTTP GET; inherited proxy; verified TLS",
              "content_reviewed": False}
    if urlparse(url).scheme != "https":
        return {**record, "error": "Only explicit HTTPS source URLs are accepted."}
    try:
        with urlopen(url, timeout=20) as response:
            body = response.read(4 * 1024 * 1024 + 1)
            record.update(status=response.status, final_url=response.url)
        if len(body) > 4 * 1024 * 1024:
            return {**record, "error": "Source exceeds 4 MiB limit."}
        filename = sha256(url.encode()).hexdigest()[:20] + ".html"
        (output / filename).write_bytes(body)
        record.update(bytes=len(body), sha256=sha256(body).hexdigest(), local_file=str(output / filename))
    except HTTPError as error:
        record.update(status=error.code, error=str(error))
    except (URLError, TimeoutError) as error:
        record["error"] = str(error)
    return record


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("urls", nargs="*")
    parser.add_argument("--sakurai-index", type=Path, help="Extract only metadata from a previously fetched public fan-index HTML file")
    parser.add_argument("--output", type=Path, default=Path("/tmp/shibuya-game-design-research"))
    args = parser.parse_args()
    if args.sakurai_index:
        print(json.dumps(extract_sakurai_index(args.sakurai_index), ensure_ascii=False, indent=2))
        raise SystemExit(0)
    if not args.urls:
        parser.error("Supply HTTPS URLs or --sakurai-index.")
    args.output.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(lambda url: fetch(url, args.output), args.urls))
    manifest = args.output / "fetch-manifest.json"
    manifest.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(records, ensure_ascii=False, indent=2))
