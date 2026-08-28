import type { Money } from './types.ts';

export function precision(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Unsupported currency code.');
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
export function fromDecimal(amount: string, currency: string): Money {
  const digits = precision(currency);
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error('Invalid product price.');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.slice(digits).replace(/0/g, '')) throw new Error('Price has unsupported precision.');
  const minor = Number(whole) * (10 ** digits) + Number(fraction.slice(0, digits).padEnd(digits, '0'));
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Invalid product price.');
  return { amount: minor, currency };
}
export function formatMoney(value: Money): string {
  if (!Number.isSafeInteger(value.amount) || value.amount < 0) throw new Error('Invalid product price.');
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: value.currency,
    minimumFractionDigits: value.amount % (10 ** precision(value.currency)) === 0 ? 0 : precision(value.currency)
  }).format(value.amount / (10 ** precision(value.currency)));
}
export function quantity(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 99) throw new Error('Choose a quantity from 1 to 99.');
  return value;
}
export function multiply(price: Money, count: number): Money {
  const amount = price.amount * quantity(count);
  if (!Number.isSafeInteger(amount)) throw new Error('Cart total is too large.');
  return { ...price, amount };
}
export function subtotal(prices: Money[], currency = 'USD'): Money {
  if (prices.some(p => p.currency !== currency)) throw new Error('A cart cannot mix currencies.');
  const amount = prices.reduce((sum, p) => sum + p.amount, 0);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid cart total.');
  return { amount, currency };
}
