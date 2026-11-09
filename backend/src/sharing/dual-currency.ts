import type { SharePricing } from './sharing.types';

/**
 * Fixed display rate used by the share cards. Product prices are already keyed
 * in dual currencies elsewhere in the app (for example 8 UKP / 10 USD), so the
 * share engine only converts catalogue values that arrive in a single
 * currency. It is a presentation conversion, not a payment rate.
 */
const USD_PER_GBP = 1.25;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatUkp(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function normaliseCurrency(currency: string | null | undefined): string {
  return (currency ?? '').trim().toUpperCase();
}

/**
 * Returns a transparent dual-currency price for a single-currency amount.
 * Unsupported or non-positive amounts return null so the card omits pricing
 * rather than showing a misleading conversion.
 */
export function formatDualCurrencyPrice(
  amount: number | null | undefined,
  currency: string | null | undefined,
): SharePricing | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unit = normaliseCurrency(currency);
  let ukp: number;
  let usd: number;

  if (unit === 'GBP' || unit === 'UKP' || unit === '£') {
    ukp = roundMoney(amount);
    usd = roundMoney(amount * USD_PER_GBP);
  } else if (unit === 'USD' || unit === '$') {
    usd = roundMoney(amount);
    ukp = roundMoney(amount / USD_PER_GBP);
  } else {
    return null;
  }

  return {
    ukp,
    usd,
    display: `${formatUkp(ukp)} UKP / ${usd.toFixed(2)} USD`,
  };
}
