// @vitest-environment node
//
// VAT is included in the catalog prices (TTC), so it must be extracted out of
// the order total, not added on top. The rate is 20% for every sales channel.
import { describe, expect, it } from 'vitest';
import { extractOrderVat } from './pos.service';

describe('extractOrderVat', () => {
  it('applies 20% for table orders', () => {
    const vat = extractOrderVat('SUR_PLACE', 120);
    expect(vat.vatRate).toBe(0.2);
    expect(vat.netTotal).toBe(100);
    expect(vat.vatAmount).toBe(20);
  });

  it('applies 20% for takeaway orders', () => {
    const vat = extractOrderVat('EMPORTER', 120);
    expect(vat.vatRate).toBe(0.2);
    expect(vat.netTotal).toBe(100);
    expect(vat.vatAmount).toBe(20);
  });

  it('applies 20% for delivery orders', () => {
    const vat = extractOrderVat('LIVRAISON', 135);
    expect(vat.vatRate).toBe(0.2);
    expect(vat.netTotal).toBe(112.5);
    expect(vat.vatAmount).toBe(22.5);
  });

  it('never changes the paid total', () => {
    for (const channel of ['SUR_PLACE', 'EMPORTER', 'LIVRAISON'] as const) {
      for (const total of [45, 99.99, 135, 7.5, 1000.01]) {
        const vat = extractOrderVat(channel, total);
        expect(vat.netTotal + vat.vatAmount).toBeCloseTo(total, 2);
      }
    }
  });

  it('rounds both parts to cents so they still sum to the total', () => {
    const vat = extractOrderVat('SUR_PLACE', 100);
    expect(vat.netTotal).toBe(83.33);
    expect(vat.vatAmount).toBe(16.67);
    expect(vat.netTotal + vat.vatAmount).toBe(100);
  });

  it('handles an empty order', () => {
    const vat = extractOrderVat('EMPORTER', 0);
    expect(vat.netTotal).toBe(0);
    expect(vat.vatAmount).toBe(0);
  });
});
