#!/usr/bin/env python3
"""Offline structural guard. It cannot establish facts, rights or semantic uniqueness."""
import argparse
import copy
import datetime as dt
import json
from pathlib import Path
import re
import sys
import unicodedata
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'docs/external/news-research'
CATEGORIES = ('food', 'retail-property', 'rail-city', 'capital-ma')
FIELDS = ('id eventKey category realEntities eventDate eventDateNote sourceURL publisher '
          'publishedDate publishedDateNote accessedDate sourceLocation sourceRead facts '
          'managementChoice authorWrittenBrief parodyEntities relevantExistingSavedEventContext '
          'displayClassification runtimeEligible unverifiedReason').split()
TODAY = dt.datetime.now(dt.timezone.utc).date()
BASE_SHA = '0f20987d5e9961b8efe16c5f6aa5c6322120ec0b'


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def normalize(value, names=()):
    value = unicodedata.normalize('NFKC', value).casefold()
    for name in sorted(names, key=len, reverse=True):
        if name:
            value = value.replace(unicodedata.normalize('NFKC', name).casefold(), '企業')
    return ''.join(c for c in value if c.isalnum())


def stock_catalog():
    seeds = re.findall(r"\['([^']+)', '([^']+)', '([^']+)', '[^']+', '([^']+)', '[^']+'\]",
                       (ROOT / 'src/data/stocks.ts').read_text())
    stocks = {'jp-' + code: {'name': name, 'realName': real, 'market': market}
              for code, name, real, market in seeds}
    universe = json.loads((ROOT / 'docs/market-universe.json').read_text())
    if len(stocks) != 100 or len(universe) != 100:
        raise ValueError('expected existing 100-stock universe')
    for item in universe:
        stock = stocks.get('jp-' + item['code'])
        if stock is None or stock['realName'] != item['realName'] or stock['market'] != item['market']:
            raise ValueError('STOCKS/market-universe realName or market mismatch: ' + item['code'])
    return stocks


class Validator:
    def __init__(self, stocks):
        self.stocks = stocks
        self.errors = []

    def require(self, condition, label, message):
        if not condition:
            self.errors.append(label + ': ' + message)

    def required(self, obj, fields, label):
        self.require(isinstance(obj, dict), label, 'must be object')
        if not isinstance(obj, dict):
            return False
        for field in fields:
            self.require(field in obj, label, 'missing ' + field)
        return True

    def date(self, value, label, nullable=False):
        if value is None and nullable:
            return None
        try:
            if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
                raise ValueError()
            parsed = dt.date.fromisoformat(value)
            self.require(parsed <= TODAY, label, 'future date prohibited in historical pilot')
            return parsed
        except ValueError:
            self.require(False, label, 'invalid YYYY-MM-DD date')
        return None

    def context(self, rows, label):
        self.require(isinstance(rows, list) and bool(rows), label, 'nonempty context array required')
        if not isinstance(rows, list):
            return
        for i, row in enumerate(rows):
            where = f'{label}[{i}]'
            if not self.required(row, ('tag', 'sourceFile', 'existingFieldOrEvent', 'rationale', 'limitation'), where):
                continue
            for key in ('tag', 'sourceFile', 'existingFieldOrEvent', 'rationale', 'limitation'):
                self.require(nonempty(row.get(key)), where, 'empty ' + key)
            source = row.get('sourceFile', '')
            sources = [s.strip() for s in source.split(';')] if isinstance(source, str) else []
            safe = bool(sources) and all(s.startswith('src/') and '..' not in Path(s).parts and (ROOT / s).is_file() for s in sources)
            self.require(safe, where, 'unknown/unsafe sourceFile')
            if safe and nonempty(row.get('existingFieldOrEvent')):
                text = '\n'.join((ROOT / s).read_text() for s in sources)
                # A lexical guard over names and paths; relationships still require human review.
                refs = re.findall(r'[A-Za-z_$][\w$]*', row['existingFieldOrEvent'])
                for ref in refs:
                    self.require(bool(re.search(r'\b' + re.escape(ref) + r'\b', text)), where, 'unknown source token ' + ref)

    def candidate(self, row, category, label):
        if not self.required(row, FIELDS, label):
            return
        self.require(row.get('category') == category and category in CATEGORIES, label, 'category mismatch')
        self.require(bool(re.fullmatch(r'nr-' + re.escape(category) + r'-[a-z0-9]+(?:-[a-z0-9]+)*', str(row.get('id', '')))), label, 'invalid stable id')
        self.require(bool(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', str(row.get('eventKey', '')))), label, 'invalid eventKey')
        for field in ('publisher', 'sourceLocation', 'managementChoice', 'eventDateNote', 'publishedDateNote'):
            self.require(nonempty(row.get(field)), label, 'empty ' + field)
        for field in ('realEntities', 'facts'):
            value = row.get(field)
            self.require(isinstance(value, list) and bool(value) and all(nonempty(x) for x in value), label, 'invalid ' + field)
        url = row.get('sourceURL')
        parsed = urlsplit(url) if isinstance(url, str) else urlsplit('')
        self.require(parsed.scheme == 'https' and bool(parsed.hostname) and not parsed.username and not parsed.password and not any(c.isspace() for c in (url or '')), label, 'invalid https sourceURL')
        for field in ('eventDate', 'publishedDate'):
            self.date(row.get(field), label + '.' + field, nullable=True)
            if row.get(field) is None:
                self.require(nonempty(row.get(field + 'Note')), label, 'null date requires reason')
        accessed = self.date(row.get('accessedDate'), label + '.accessedDate')
        published = self.date(row.get('publishedDate'), label + '.publishedDate', nullable=True)
        if accessed and published:
            self.require(published <= accessed, label, 'published after accessed')
        supporting = row.get('supportingSources', [])
        self.require(isinstance(supporting, list), label, 'supportingSources must be array')
        for i, support in enumerate(supporting if isinstance(supporting, list) else []):
            where = f'{label}.supportingSources[{i}]'
            if not self.required(support, ('sourceURL', 'publisher', 'publishedDate', 'publishedDateNote', 'accessedDate', 'sourceLocation', 'sourceRead'), where):
                continue
            support_url = support.get('sourceURL')
            parsed_support = urlsplit(support_url) if isinstance(support_url, str) else urlsplit('')
            self.require(parsed_support.scheme == 'https' and bool(parsed_support.hostname) and not parsed_support.username and not parsed_support.password and not any(c.isspace() for c in (support_url or '')), where, 'invalid https sourceURL')
            for key in ('publisher', 'publishedDateNote', 'sourceLocation'):
                self.require(nonempty(support.get(key)), where, 'empty ' + key)
            support_published = self.date(support.get('publishedDate'), where + '.publishedDate', nullable=True)
            support_accessed = self.date(support.get('accessedDate'), where + '.accessedDate')
            if support_accessed and support_published:
                self.require(support_published <= support_accessed, where, 'published after accessed')
            sr = support.get('sourceRead')
            if self.required(sr, ('method', 'status', 'notes'), where + '.sourceRead'):
                self.require(sr.get('status') == 'verified' and nonempty(sr.get('method')) and nonempty(sr.get('notes')) and not re.search(r'snippet|search-only|検索結果のみ', sr.get('method', ''), re.I), where, 'support requires verified non-snippet read')
        self.require(row.get('displayClassification') in ('historical-reference', 'hold'), label, 'historical-reference/hold only')
        self.require(row.get('runtimeEligible') is False, label, 'runtimeEligible must be false')
        read = row.get('sourceRead')
        if self.required(read, ('method', 'status', 'notes'), label + '.sourceRead'):
            self.require(nonempty(read.get('method')) and nonempty(read.get('notes')), label, 'read method/notes required')
            verified = read.get('status') == 'verified'
            self.require(read.get('status') in ('verified', 'unverified'), label, 'invalid sourceRead.status')
            self.require(not (verified and re.search(r'snippet|search-only|検索結果のみ', read.get('method', ''), re.I)), label, 'snippet-only cannot verify')
            if row.get('displayClassification') == 'historical-reference':
                self.require(verified and row.get('unverifiedReason') is None, label, 'historical reference requires verified read and null reason')
            else:
                self.require(nonempty(row.get('unverifiedReason')), label, 'hold requires reason')
        brief = row.get('authorWrittenBrief')
        self.brief(brief, label)
        mappings = row.get('parodyEntities')
        self.require(isinstance(mappings, list), label, 'parodyEntities must be array')
        seen = set()
        for mapping in mappings if isinstance(mappings, list) else []:
            if not self.required(mapping, ('stockId', 'gameName', 'realName', 'relationship', 'note'), label + '.parodyEntities'):
                continue
            stock_id = mapping.get('stockId')
            stock = self.stocks.get(stock_id)
            self.require(stock is not None, label, 'unknown stockId ' + str(stock_id))
            self.require(stock_id not in seen, label, 'duplicate stock mapping')
            seen.add(stock_id)
            if stock:
                self.require(mapping.get('gameName') == stock['name'] and mapping.get('realName') == stock['realName'], label, 'STOCKS name/realName mismatch')
                if 'market' in mapping:
                    self.require(mapping['market'] == stock['market'], label, 'STOCKS market mismatch')
            self.require(mapping.get('relationship') in ('direct', 'subsidiary', 'parent-group') and nonempty(mapping.get('note')), label, 'invalid relationship/note')
        self.context(row.get('relevantExistingSavedEventContext'), label + '.context')

    def brief(self, brief, label):
        self.require(nonempty(brief) and len(brief) <= 350, label, 'brief required, <=350 characters')
        if isinstance(brief, str):
            self.require(not re.search(r'今週|本週|当週|今期の実績|ゲーム内で.*(?:開業|買収|発売|上場)', brief), label, 'unrecorded activity presented as current game fact')

    def unique(self, rows, label):
        names = [name for row in rows for name in row.get('realEntities', [])]
        names += [s[k] for s in self.stocks.values() for k in ('name', 'realName')]
        for field in ('id', 'eventKey', 'authorWrittenBrief'):
            seen = {}
            for row in rows:
                value = row.get(field)
                if not isinstance(value, str):
                    continue
                key = normalize(value, names if field == 'authorWrittenBrief' else ())
                self.require(key not in seen, label, 'duplicate/company-replaced ' + field + ': ' + str(row.get('id')) + ' / ' + str(seen.get(key)))
                seen[key] = row.get('id')

    def eligible(self, row):
        return row.get('displayClassification') == 'historical-reference' and row.get('runtimeEligible') is False and row.get('sourceRead', {}).get('status') == 'verified' and row.get('unverifiedReason') is None


def load(path):
    # Duplicate JSON object keys must not disappear silently at parsing time.
    def object_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('duplicate JSON key ' + key)
            result[key] = value
        return result
    return json.loads(path.read_text(), object_pairs_hook=object_pairs)


def run_local(stocks, partial=False, pilot_path=None):
    v = Validator(stocks)
    candidates = []
    for owner in ('n01', 'n02'):
        path = DATA / 'candidates' / (owner + '.json')
        if partial and not path.exists():
            continue
        data = load(path)
        v.require(data.get('schemaVersion') == 1, str(path), 'root mismatch')
        rows = data.get('candidates')
        v.require(isinstance(rows, list), str(path), 'candidates array required')
        for row in rows if isinstance(rows, list) else []:
            v.candidate(row, row.get('category'), str(row.get('id')))
            candidates.append(row)
    v.unique(candidates, 'candidates')
    ids = {row['id'] for row in candidates}
    eligible_ids = {row['id'] for row in candidates if v.eligible(row)}
    editor = {}
    for filename in ('shortforms.json', 'context-tags.json'):
        path = DATA / filename
        if partial and not path.exists():
            continue
        data = load(path)
        v.require(data.get('schemaVersion') == 1 and isinstance(data.get('records'), list), filename, 'root mismatch')
        mapped = {}
        for row in data.get('records', []):
            fields = ('candidateId', 'authorWrittenBrief', 'displayClassification', 'runtimeEligible', 'editorialNotes') if filename == 'shortforms.json' else ('candidateId', 'relevantExistingSavedEventContext', 'contextNotes')
            if not v.required(row, fields, filename):
                continue
            cid = row.get('candidateId')
            v.require(cid in ids and cid not in mapped, filename, 'unknown/duplicate candidateId ' + str(cid))
            mapped[cid] = row
            if filename == 'shortforms.json':
                v.brief(row.get('authorWrittenBrief'), str(cid))
                v.require(row.get('displayClassification') in ('historical-reference', 'hold') and row.get('runtimeEligible') is False, str(cid), 'editor classification/runtime mismatch')
                v.require(nonempty(row.get('editorialNotes')), str(cid), 'editorialNotes required')
            else:
                v.context(row.get('relevantExistingSavedEventContext'), str(cid))
                v.require(nonempty(row.get('contextNotes')), str(cid), 'contextNotes required')
        v.require(set(mapped) == ids, filename, 'candidate/editor IDs must match 1:1')
        editor[filename] = mapped
        if filename == 'shortforms.json':
            v.unique([dict(r, id=r['candidateId'], realEntities=next(c['realEntities'] for c in candidates if c['id'] == r['candidateId'])) for r in mapped.values() if r['candidateId'] in ids], filename)
    path = pilot_path or DATA / 'pilot.json'
    if not partial or path.exists():
        data = load(path)
        v.required(data, ('schemaVersion', 'runId', 'baseSha', 'reviewedAt', 'status', 'runtimeIntegration', 'records', 'reviewSummary'), 'pilot')
        v.require(data.get('schemaVersion') == 1 and data.get('baseSha') == BASE_SHA, 'pilot', 'schema/base mismatch')
        v.require(nonempty(data.get('runId')) and bool(data.get('reviewSummary')), 'pilot', 'runId/reviewSummary required')
        v.require(data.get('status') == 'awaiting-parent-review' and data.get('runtimeIntegration') is False, 'pilot', 'status/runtimeIntegration mismatch')
        stamp = data.get('reviewedAt', '')
        try:
            instant = dt.datetime.fromisoformat(stamp.replace('Z', '+00:00'))
            v.require(instant.tzinfo is not None and instant <= dt.datetime.now(dt.timezone.utc), 'pilot', 'reviewedAt timezone/future mismatch')
        except (ValueError, TypeError):
            v.require(False, 'pilot', 'invalid reviewedAt ISO timestamp')
        rows = data.get('records', [])
        v.require(isinstance(rows, list) and len(rows) == sum(PLANNED[DATA.name]), 'pilot', 'planned batch requires 28 records')
        for row in rows if isinstance(rows, list) else []:
            cid = row.get('id')
            v.candidate(row, row.get('category'), str(cid))
            v.require(cid in eligible_ids and v.eligible(row), str(cid), 'pilot unknown/ineligible candidate or hold')
            original = next((r for r in candidates if r.get('id') == cid), {})
            for key in FIELDS:
                expected = original.get(key)
                if key in ('authorWrittenBrief', 'displayClassification', 'runtimeEligible'):
                    expected = editor.get('shortforms.json', {}).get(cid, {}).get(key)
                elif key == 'relevantExistingSavedEventContext':
                    expected = editor.get('context-tags.json', {}).get(cid, {}).get(key)
                v.require(row.get(key) == expected, str(cid), 'pilot differs from candidate/editor ' + key)
            v.require(row.get('supportingSources', []) == original.get('supportingSources', []), str(cid), 'pilot differs from candidate supportingSources')
        v.unique(rows, 'pilot')
        v.require({r.get('id') for r in rows} == eligible_ids, 'pilot', 'pilot/eligible candidate IDs must match')
    return v, len(candidates)


PLANNED = {'batch-02': (16, 12), 'batch-03': (16, 12)}


def merged_batch(path):
    rows = []
    for file in sorted((path / 'candidates').glob('*.json')):
        rows.extend(load(file).get('candidates', []))
    shortforms = path / 'shortforms.json'
    tags = path / 'context-tags.json'
    briefs = {r['candidateId']: r for r in load(shortforms).get('records', [])} if shortforms.exists() else {}
    contexts = {r['candidateId']: r for r in load(tags).get('records', [])} if tags.exists() else {}
    result = []
    for row in rows:
        record = dict(row)
        for key in ('authorWrittenBrief', 'displayClassification', 'runtimeEligible'):
            if row.get('id') in briefs:
                record[key] = briefs[row['id']].get(key)
        if row.get('id') in contexts:
            record['relevantExistingSavedEventContext'] = contexts[row['id']].get('relevantExistingSavedEventContext')
        result.append(record)
    return result


def run(stocks, partial=False, pilot_path=None, baseline_paths=(), catalog_path=None):
    if DATA.name not in PLANNED:
        raise ValueError('expected edited/batch-02 or batch-03 directory')
    v, count = run_local(stocks, partial, pilot_path)
    for owner, expected in zip(('n01', 'n02'), PLANNED[DATA.name]):
        path = DATA / 'candidates' / (owner + '.json')
        if path.exists():
            actual = len(load(path).get('candidates', []))
            v.require(actual <= expected if partial else actual == expected, owner, 'planned author count mismatch')
    baseline = []
    for path in baseline_paths:
        data = load(path)
        v.require(data.get('schemaVersion') == 1 and isinstance(data.get('records'), list), str(path), 'baseline requires records')
        for row in data.get('records', []):
            v.candidate(row, row.get('category'), str(row.get('id')))
        baseline.extend(data.get('records', []))
    # Canonical primary files preserve initial IDs; parent snapshots select only the new rows.
    primary_root = DATA.parent.parent / 'candidates'
    batch_index = 0 if DATA.name == 'batch-02' else 1
    for filename, owner, initial_count, new_count, take in (
        ('company-news-wave1.json', 'n01', 8, 32, 16),
        ('property-rail-capital-wave1.json', 'n02', 16, 24, 12),
    ):
        path = primary_root / filename
        if not path.exists():
            v.require(not catalog_path, filename, 'canonical primary file required for final catalog')
            continue
        data = load(path)
        initial_ids = data.get('initialCandidateIds', data.get('metadata', {}).get('initialCandidateIds', []))
        primary = data.get('candidates', [])
        v.require(isinstance(initial_ids, list) and len(initial_ids) == len(set(initial_ids)) == initial_count, filename, 'initialCandidateIds count/uniqueness mismatch')
        v.require(set(initial_ids).issubset({r.get('id') for r in primary}), filename, 'initial IDs missing from primary')
        v.unique(primary, filename)
        if catalog_path:
            v.require(len(primary) == 40, filename, 'canonical task requires 40 records')
        else:
            v.require(len(primary) <= 40, filename, 'canonical exceeds finite task')
        new = [r for r in primary if r.get('id') not in set(initial_ids)]
        selected = new[batch_index * take:(batch_index + 1) * take]
        snapshot = DATA / 'candidates' / (owner + '.json')
        if snapshot.exists():
            rows = load(snapshot).get('candidates', [])
            v.require(rows == selected, owner, 'snapshot differs from canonical selected rows/order')
        if baseline:
            original = {r.get('id'): r for r in baseline}
            for row in primary:
                if row.get('id') not in initial_ids:
                    continue
                v.require(row.get('id') in original, filename, 'initial row absent from baseline')
                for key in FIELDS + ['supportingSources']:
                    if key in ('authorWrittenBrief', 'relevantExistingSavedEventContext'):
                        continue
                    default = [] if key == 'supportingSources' else None
                    v.require(row.get(key, default) == original.get(row.get('id'), {}).get(key, default), str(row.get('id')), 'initial canonical facts/source changed: ' + key)
    cumulative = list(baseline)
    for name in PLANNED:
        path = DATA.parent / name
        if path.exists():
            cumulative.extend(merged_batch(path))
    v.unique(cumulative, 'cumulative edited/baseline')
    v.require(len(cumulative) <= 80, 'cumulative', 'finite wave exceeds 80')
    if catalog_path:
        data = load(catalog_path)
        v.require(len(baseline) == 24 and len(cumulative) == 80, 'catalog', 'initial24 + new56 required')
        v.require(data.get('schemaVersion') == 1 and data.get('baseSha') == BASE_SHA and data.get('runtimeIntegration') is False and data.get('status') == 'awaiting-parent-review', 'catalog', 'root/base/runtime mismatch')
        actual = data.get('records', [])
        v.require(isinstance(actual, list) and len(actual) == 80, 'catalog', '80 records required')
        expected = {r.get('id'): r for r in cumulative}
        for row in actual:
            cid = row.get('id')
            v.candidate(row, row.get('category'), str(cid))
            v.require(cid in expected and v.eligible(row), str(cid), 'unknown/ineligible catalog record')
            for key in FIELDS + ['supportingSources']:
                v.require(row.get(key, [] if key == 'supportingSources' else None) == expected.get(cid, {}).get(key, [] if key == 'supportingSources' else None), str(cid), 'catalog differs from assembled ' + key)
        v.unique(actual, 'catalog')
        v.require({r.get('id') for r in actual} == set(expected), 'catalog', 'catalog ID mismatch')
    return v, count, len(cumulative)


def self_test(stocks):
    v = Validator(stocks)
    base = dict(id='nr-food-example-launch-20200101', eventKey='example-launch-20200101', category='food',
                realEntities=['実在会社'], eventDate='2020-01-01', eventDateNote='発表日', sourceURL='https://example.org/news',
                publisher='実在会社', publishedDate='2020-01-01', publishedDateNote='日付表示', accessedDate=TODAY.isoformat(),
                sourceLocation='本文第1段落', sourceRead=dict(method='web-open', status='verified', notes='本文を実読'),
                facts=['実在会社は過去に商品を発売した。'], managementChoice='商品投入', authorWrittenBrief='実在会社は2020年、新商品を発売した。',
                parodyEntities=[], relevantExistingSavedEventContext=[dict(tag='store-opening', sourceFile='src/model.ts',
                existingFieldOrEvent='OpeningRecord.decisionWeek', rationale='開業判断の参考', limitation='他社活動は未記録')],
                displayClassification='historical-reference', runtimeEligible=False, unverifiedReason=None)
    v.candidate(base, 'food', 'valid fixture')
    if v.errors:
        raise AssertionError(v.errors)
    cases = {}
    bad = copy.deepcopy(base); del bad['sourceURL']; cases['missing source'] = [bad]
    bad = copy.deepcopy(base); bad['eventDate'] = (TODAY + dt.timedelta(days=1)).isoformat(); cases['future date'] = [bad]
    bad = copy.deepcopy(base); bad['parodyEntities'] = [dict(stockId='jp-0000', gameName='架空', realName='架空', relationship='direct', note='不明')]; cases['unknown stock'] = [bad]
    bad = copy.deepcopy(base); bad.update(id='nr-food-other-launch-20200101', eventKey='other-launch-20200101', realEntities=['別会社'], authorWrittenBrief='別会社は2020年、新商品を発売した。'); cases['company replacement'] = [base, bad]
    bad = copy.deepcopy(base); bad['authorWrittenBrief'] = '今週、コモレビ珈琲は新店舗を開業した。'; cases['unrecorded current activity'] = [bad]
    bad = copy.deepcopy(base); bad['sourceRead']['method'] = 'snippet-only'; cases['snippet verification'] = [bad]
    bad = copy.deepcopy(base); bad['relevantExistingSavedEventContext'][0]['existingFieldOrEvent'] = 'GameState.nonexistentLog'; cases['unknown saved field'] = [bad]
    for name, rows in cases.items():
        check = Validator(stocks)
        for row in rows:
            check.candidate(row, 'food', name)
        check.unique(rows, name)
        if not check.errors:
            raise AssertionError('adversarial fixture accepted: ' + name)
        print('REJECTED: ' + name)
    hold = copy.deepcopy(base)
    hold.update(displayClassification='hold', unverifiedReason='原資料を再確認できない')
    hold['sourceRead']['status'] = 'unverified'
    held = Validator(stocks)
    held.candidate(hold, 'food', 'valid hold fixture')
    if held.errors or held.eligible(hold):
        raise AssertionError('hold retention/eligibility guard failed')
    rejected_pilot = Validator(stocks)
    rejected_pilot.require(rejected_pilot.eligible(hold), 'hold in pilot', 'ineligible record')
    if not rejected_pilot.errors:
        raise AssertionError('hold accepted into pilot')
    print('REJECTED: hold in pilot; valid hold candidate retained')
    print('SELF-TEST PASS: valid/hold fixtures accepted; 8 adversarial cases rejected')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--batch', type=Path, help='edited/batch-02/03 directory')
    parser.add_argument('--baseline', type=Path, action='append', default=[], help='initial24 pilot for cumulative comparison')
    parser.add_argument('--catalog', type=Path, help='parent final80 catalog')
    parser.add_argument('--partial', action='store_true', help='validate existing files during research, no final count guarantee')
    parser.add_argument('--pilot', type=Path, help='alternative final pilot JSON')
    args = parser.parse_args()
    try:
        stocks = stock_catalog()
        if args.self_test:
            self_test(stocks)
            return 0
        if args.batch is None:
            parser.error('--batch is required unless --self-test')
        global DATA
        DATA = args.batch.resolve()
        check, count, cumulative = run(stocks, args.partial, args.pilot, args.baseline, args.catalog)
        for error in check.errors:
            print('ERROR: ' + error, file=sys.stderr)
        if check.errors:
            print(f'FAIL: {len(check.errors)} errors; {count} candidates', file=sys.stderr)
            return 1
        print(f'PASS: {count} batch/{cumulative} cumulative candidates; 100 STOCKS match market-universe; mode={"partial" if args.partial else "final"}')
        if not args.baseline:
            print('Initial24 not supplied: use --baseline for initial/cumulative comparison.')
        print('Structural pass does not establish source facts, copyright clearance or semantic uniqueness; see audit.md.')
        return 0
    except (OSError, ValueError, KeyError, TypeError, AssertionError) as error:
        print('FAIL: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
