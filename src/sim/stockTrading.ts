/** Quote the actual whole-yen settlement without altering the stored reference price. */
export function quoteStockTrade(price: number, shares: number, side: 'buy' | 'sell'): number {
  if (!Number.isFinite(price) || price < 0) throw new Error('株価が不正です。');
  if (!Number.isSafeInteger(shares) || shares < 1 || shares > 1_000_000_000) throw new Error('株数は1〜10億の整数で入力してください。');
  if (side !== 'buy' && side !== 'sell') throw new Error('売買区分が不正です。');

  // Use the number's decimal representation, including exponent notation. Binary
  // multiplication can otherwise turn an exact yen amount into e.g. 110.00000000000001.
  const [mantissa, exponentText = '0'] = price.toString().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const scale = fraction.length - Number(exponentText);
  let numerator = BigInt(whole + fraction) * BigInt(shares);
  const denominator = scale > 0 ? 10n ** BigInt(scale) : 1n;
  if (scale < 0) numerator *= 10n ** BigInt(-scale);
  const settled = side === 'buy' ? (numerator + denominator - 1n) / denominator : numerator / denominator;
  if (settled > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('取引総額が正確に扱える上限を超えています。株数を減らしてください。');
  return Number(settled);
}

/** Validate both sides of the cash transfer; a precise quote alone cannot protect an imprecise balance. */
export function settleStockTradeCash(cash: number, amount: number, side: 'buy' | 'sell'): number {
  if (side !== 'buy' && side !== 'sell') throw new Error('売買区分が不正です。');
  if (!Number.isFinite(cash) || cash < 0 || cash > Number.MAX_SAFE_INTEGER || !Number.isSafeInteger(amount) || amount < 0) throw new Error('現預金または取引総額が正確に扱える範囲外です。');
  if (side === 'buy' && cash < amount) throw new Error('現預金が不足しています。');
  // Older valid saves may contain fractional cash. Preserve the former spend()
  // rounding on purchases; once rounded, it cannot fund repeated fractional gains.
  const after = side === 'buy' ? Math.round(cash - amount) : cash + amount;
  if (!Number.isFinite(after) || after < 0 || after > Number.MAX_SAFE_INTEGER) throw new Error('取引後の現預金が正確に扱える上限を超えています。');
  return after;
}
