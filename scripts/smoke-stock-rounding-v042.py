#!/usr/bin/env python3
"""Actual stock-order UI checks. CityView is explicitly stubbed; no GPU or market-return claim."""
import json
import os
import re
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(os.getenv('STOCK_ROUNDING_OUT', '/workspace/shared/shibuya-artifacts/stock-rounding-v042'))
URL = os.getenv('PLAYTEST_URL', 'http://127.0.0.1:5173')
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, orders, boundaries = [], [], [], []
completed = False


def button(root, name):
    return root.get_by_role('button', name=name, exact=True)


def yen(amount):
    return '¥' + format(amount, ',')


def quote(price, shares, side):
    return int((Decimal(str(price)) * shares).to_integral_value(rounding=ROUND_CEILING if side == 'buy' else ROUND_FLOOR))


def money_value(text):
    return Decimal(text.replace('¥', '').replace('￥', '').replace(',', '').strip())


def read(page):
    return page.evaluate("async()=>(await import('/src/persistence.ts')).loadGame()")


def save(page):
    button(page, '設定・保存').click()
    dialog = page.get_by_role('dialog', name='設定と会社データ')
    button(dialog, '今すぐ保存する').click()
    expect(page.locator('.toast')).to_contain_text('保存しました')
    button(dialog, '閉じる').click()
    return read(page)


def value(dialog, label):
    return dialog.locator('dt').filter(has_text=re.compile('^' + re.escape(label) + '$')).locator('..').locator('dd')


def shot(page, name):
    if page.locator('.toast button').count():
        page.locator('.toast button').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'document overflow'
    assert page.locator('.investment-order').evaluate('(e)=>e.scrollWidth<=e.clientWidth'), 'order dialog overflow'
    page.screenshot(path=str(OUT / (name + '.png')))


def ok(message):
    checks.append(message)
    print('PASS', message, flush=True)


def import_fixture(page, state, name):
    envelope = page.evaluate("async(s)=>(await import('/src/persistence.ts')).createEnvelope(s)", state)
    path = OUT / (name + '.json')
    path.write_text(json.dumps(envelope, ensure_ascii=False))
    button(page, '設定・保存').click()
    button(page.get_by_role('dialog', name='設定と会社データ'), 'ファイルから読み込む').click()
    page.locator('input[type=file]').set_input_files(str(path))
    expect(page.locator('.company h1')).to_have_text(state['companyName'])


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--disable-gpu'])
    context = browser.new_context(viewport={'width': 1280, 'height': 960})
    context.route('**/src/city/CityView.tsx*', lambda r: r.fulfill(status=200, content_type='application/javascript', body='export default function CityView(){return null}'))
    page = context.new_page()
    page.set_default_timeout(20000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('dialog', lambda d: d.accept())
    try:
        page.goto(URL)
        page.get_by_label('会社名', exact=True).fill('端数注文の通常会社')
        button(page, '新しい会社を設立').click()
        expect(page.locator('.company h1')).to_have_text('端数注文の通常会社')
        current = save(page)
        assert current['cash'] == 12000000 and current['week'] == 1
        stocks = page.evaluate("async()=>(await import('/src/data/stocks.ts')).STOCKS.filter(s=>['9005','9432'].includes(s.code))")
        assert len(stocks) == 2
        for index, stock in enumerate(stocks):
            page.set_viewport_size({'width': 1280, 'height': 960} if index == 0 else {'width': 390, 'height': 844})
            button(page, '株式市場').click()
            button(page, '株式投資').click()
            page.get_by_label('銘柄を検索').fill(stock['code'])
            row = page.locator('.investment-panel tbody tr')
            expect(row).to_have_count(1)
            start_cash = current['cash']
            price = current['stockPrices'][stock['id']]
            assert Decimal(str(price)) % 1 != 0
            for order_index, (side, shares) in enumerate([('buy', 2), ('sell', 1), ('sell', 1)]):
                amount = quote(price, shares, side)
                button(row, '買う' if side == 'buy' else '売る').click()
                dialog = page.get_by_role('dialog', name=stock['name'] + ('の購入' if side == 'buy' else 'の売却'))
                dialog.get_by_label('購入株数' if side == 'buy' else '売却株数').fill(str(shares))
                expect(value(dialog, '購入総額' if side == 'buy' else '売却総額')).to_have_text(yen(amount))
                expect(value(dialog, '取引後の手元資金')).to_have_text(yen(current['cash'] + (-amount if side == 'buy' else amount)))
                assert money_value(value(dialog, 'ゲーム内株価 / 第1週').inner_text()) == Decimal(str(price))
                assert re.search('切り?上げ', dialog.inner_text()) and re.search('切り?捨て', dialog.inner_text()), 'Rounding rule is not explained in the order dialog'
                assert read(page) == current, 'Opening and changing a quote mutated persisted state'
                if order_index < 2:
                    shot(page, f"{stock['code']}-{side}")
                action = {'type': 'buyStock' if side == 'buy' else 'sellStock', 'stockId': stock['id'], 'shares': shares}
                expected = page.evaluate("async(x)=>(await import('/src/sim/engine.ts')).applyAction(x.state,x.action)", {'state': current, 'action': action})
                expect(dialog.locator('button.primary')).to_be_enabled()
                dialog.locator('button.primary').click()
                expect(dialog).to_have_count(0)
                actual = save(page)
                assert actual == expected
                assert actual['cash'] == current['cash'] + (-amount if side == 'buy' else amount)
                assert actual['week'] == 1 and actual['stockPrices'] == current['stockPrices']
                orders.append({'code': stock['code'], 'price': price, 'side': side, 'shares': shares, 'quote': amount,
                               'cashBefore': current['cash'], 'cashAfter': actual['cash']})
                current = actual
            assert current['cash'] == start_cash - 1
            assert not any(p['stockId'] == stock['id'] for p in current['positions'])
            ok(stock['code'] + ': displayed decimal price and settlement match independent Decimal; buy 2/sell 1/sell 1 loses exactly 1 yen')

        final = current
        page.reload()
        page.get_by_role('button', name=re.compile('端数注文の通常会社 を続ける')).click()
        assert read(page) == final and final['cash'] == 11999998 and not final['positions']
        ok('Normal company finishes both round trips at 11,999,998 yen with no holdings; save/reload exactly matches')

        # Only this boundary test edits cash: a declared synthetic state, not a normal-play claim.
        for stock in stocks:
            amount = quote(stock['basePrice'], 1, 'buy')
            state = page.evaluate("async(x)=>{const s=(await import('/src/sim/engine.ts')).createGame('1円不足 '+x.code,812);s.cash=x.cash;return s}", {'code': stock['code'], 'cash': amount - 1})
            import_fixture(page, state, 'one-yen-short-' + stock['code'])
            button(page, '株式市場').click()
            button(page, '株式投資').click()
            page.get_by_label('銘柄を検索').fill(stock['code'])
            page.get_by_label('1株の購入予算').select_option('cash')
            expect(page.locator('.investment-panel tbody tr')).to_have_count(0)
            page.get_by_label('1株の購入予算').select_option('all')
            button(page.locator('.investment-panel tbody tr'), '買う').click()
            dialog = page.get_by_role('dialog', name=stock['name'] + 'の購入')
            expect(value(dialog, '購入総額')).to_have_text(yen(amount))
            expect(value(dialog, '取引後の手元資金')).to_have_text('取引できません')
            expect(value(dialog, '手元資金')).to_have_text(yen(amount - 1))
            expect(dialog.locator('button.primary')).to_be_disabled()
            expect(dialog.locator('.warning')).to_contain_text('購入総額が手元資金を超えています')
            rejection = page.evaluate('''async(x)=>{
              const before=JSON.stringify(x.s);try{(await import('/src/sim/engine.ts')).applyAction(x.s,{type:'buyStock',stockId:x.id,shares:1});return {rejected:false};}
              catch(e){return {rejected:true,unchanged:JSON.stringify(x.s)===before,message:String(e.message)}}
            }''', {'s': state, 'id': stock['id']})
            assert rejection['rejected'] and rejection['unchanged']
            shot(page, stock['code'] + '-one-yen-short-mobile')
            button(dialog, '取引を閉じる').click()
            assert save(page) == state
            boundaries.append({'code': stock['code'], 'cash': amount - 1, 'required': amount, 'engine': rejection})
            ok(stock['code'] + ': one-yen-short order disabled, engine rejects, and save is unchanged')

        # Existing save schemas may contain cash outside exact integer arithmetic range.
        stock = next(s for s in stocks if s['code'] == '9432')
        huge = page.evaluate("async()=>{const s=(await import('/src/sim/engine.ts')).createGame('安全整数域外の旧保存',812);s.cash=2**54;return s}")
        import_fixture(page, huge, 'unsafe-cash-legacy-fixture')
        button(page, '株式市場').click()
        button(page, '株式投資').click()
        page.get_by_label('銘柄を検索').fill(stock['code'])
        page.get_by_label('1株の購入予算').select_option('cash')
        expect(page.locator('.investment-panel tbody tr')).to_have_count(0)
        page.get_by_label('1株の購入予算').select_option('all')
        button(page.locator('.investment-panel tbody tr'), '買う').click()
        dialog = page.get_by_role('dialog', name=stock['name'] + 'の購入')
        expect(dialog.locator('button.primary')).to_be_disabled()
        expect(dialog.locator('.warning')).to_be_visible()
        rejection = page.evaluate('''async(x)=>{const before=JSON.stringify(x.s);
          try{(await import('/src/sim/engine.ts')).applyAction(x.s,{type:'buyStock',stockId:x.id,shares:1});return {rejected:false};}
          catch(e){return {rejected:true,unchanged:JSON.stringify(x.s)===before,message:String(e.message)}}
        }''', {'s': huge, 'id': stock['id']})
        assert rejection['rejected'] and rejection['unchanged']
        shot(page, 'unsafe-cash-warning-mobile')
        button(dialog, '取引を閉じる').click()
        assert save(page) == huge
        boundaries.append({'case': 'legacy cash outside safe integer range', 'cash': huge['cash'], 'engine': rejection})
        ok('Legacy 2**54 cash is loadable but stock buying is visibly blocked and rejected without mutation')
        assert not errors, errors
        ok('No browser page or console errors; all order dialogs fit desktop/mobile')
        completed = True
    except Exception as exc:
        errors.append(type(exc).__name__ + ': ' + str(exc))
        page.screenshot(path=str(OUT / 'failure.png'))
        raise
    finally:
        (OUT / 'result.json').write_text(json.dumps({'completed': completed, 'checks': checks, 'errors': errors,
            'orders': orders, 'syntheticBoundaries': boundaries, 'cityViewStub': True, 'renderingTested': False,
            'normalFlow': 'New company, no injected cash/prices, both split round trips at week 1',
            'syntheticScope': 'One-yen-short and legacy unsafe-integer cash boundaries use edited cash in imported saves'}, ensure_ascii=False, indent=2) + '\n')
        browser.close()
