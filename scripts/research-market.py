#!/usr/bin/env python3
"""Capture public Yahoo Finance JPY market references offline, never at game startup.

No dependencies, proxy overrides, trust bypasses or credentials required.
Run only after the environment allows query1.finance.yahoo.com. If Yahoo refuses
access or changes its response, retain simulation entries and report the failures.
All dividend/volatility parameters remain simulation values; this updates prices only.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import math
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STOCK_FILE = ROOT / 'src' / 'data' / 'stocks.ts'
START = '// MARKET_SNAPSHOTS_START'
END = '// MARKET_SNAPSHOTS_END'
DECLARATION = "const marketSnapshots: Partial<Record<string, Pick<StockDefinition, 'basePrice' | 'priceDate' | 'sourceUrl' | 'priceKind'>>> = "
JST = dt.timezone(dt.timedelta(hours=9))


def fetch(code, max_age_days):
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{code}.T?interval=1d&range=5d'
    request = urllib.request.Request(url, headers={'User-Agent': 'TokyoCapital-OfflineResearch/1.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise ValueError(f'HTTP {response.status}')
        payload = json.load(response)
    chart = payload.get('chart', {})
    if chart.get('error'):
        raise ValueError(f'source error: {chart["error"].get("code", "unknown")}')
    results = chart.get('result') or []
    if not results:
        raise ValueError('empty chart result')
    meta = results[0].get('meta', {})
    if meta.get('symbol') != f'{code}.T' or meta.get('currency') != 'JPY':
        raise ValueError('symbol or currency mismatch')
    if meta.get('instrumentType') != 'EQUITY':
        raise ValueError('source does not identify an equity')
    price = meta.get('regularMarketPrice')
    timestamp = meta.get('regularMarketTime')
    if isinstance(price, bool) or not isinstance(price, (int, float)) or not math.isfinite(price) or price <= 0:
        raise ValueError('missing/invalid regularMarketPrice')
    if not isinstance(timestamp, (int, float)) or not math.isfinite(timestamp):
        raise ValueError('missing/invalid regularMarketTime')
    quote_time = dt.datetime.fromtimestamp(timestamp, dt.timezone.utc)
    age = dt.datetime.now(dt.timezone.utc) - quote_time
    if age.total_seconds() < -3600 or age > dt.timedelta(days=max_age_days):
        raise ValueError(f'quote timestamp outside allowed age: {quote_time.isoformat()}')
    # Provider time may be delayed/intraday. Do not label this an official close.
    return {
        'basePrice': price,
        'priceDate': quote_time.astimezone(JST).isoformat(),
        'sourceUrl': url,
        'priceKind': 'market-reference',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codes', help='Comma-separated codes; default all 100')
    parser.add_argument('--max-age-days', type=int, default=7)
    parser.add_argument('--dry-run', action='store_true', help='Fetch and validate without writing')
    args = parser.parse_args()
    if not 1 <= args.max_age_days <= 31:
        parser.error('--max-age-days must be between 1 and 31')
    original = STOCK_FILE.read_text()
    universe = re.findall(r"^  \['([0-9A-Z]{4})'", original, re.M)
    requested = list(dict.fromkeys(args.codes.split(','))) if args.codes else universe
    if not requested or any(code not in universe for code in requested):
        parser.error('--codes must be codes already in the game universe')
    pattern = re.compile(re.escape(START) + r'\n' + re.escape(DECLARATION) + r'(\{.*?\});\n' + re.escape(END), re.S)
    match = pattern.search(original)
    if not match:
        raise SystemExit('snapshot markers malformed; no files changed')
    snapshots = json.loads(match.group(1))
    successes, failures = {}, {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {pool.submit(fetch, code, args.max_age_days): code for code in requested}
        for future in concurrent.futures.as_completed(jobs):
            code = jobs[future]
            try:
                successes[code] = future.result()
            except (urllib.error.URLError, ValueError, KeyError, TypeError, TimeoutError, OSError) as exc:
                failures[code] = str(exc)
    print(json.dumps({'captured': len(successes), 'requested': len(requested), 'failures': failures, 'dryRun': args.dry_run}, ensure_ascii=False, indent=2))
    if successes and not args.dry_run:
        snapshots = {code: value for code, value in snapshots.items() if code in universe}
        snapshots.update(successes)
        replacement = START + '\n' + DECLARATION + json.dumps(snapshots, ensure_ascii=False, indent=2, sort_keys=True) + ';\n' + END
        updated = original[:match.start()] + replacement + original[match.end():]
        if STOCK_FILE.read_text() != original:
            raise SystemExit('stocks.ts changed during download; no files changed; retry')
        temporary = STOCK_FILE.with_suffix('.ts.research-tmp')
        temporary.write_text(updated)
        temporary.replace(STOCK_FILE)
        print(f'Saved {len(successes)} verified price snapshots; all yields and volatilities remain simulation parameters.')
    elif not successes:
        print('No valid snapshots received. Existing data unchanged.', file=sys.stderr)
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
