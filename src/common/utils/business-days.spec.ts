import { addBusinessDays, toDateOnlyString } from './business-days';

describe('business-days', () => {
  it('addBusinessDays skips weekends (UTC)', () => {
    const monday = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    const out = addBusinessDays(monday, 7);
    expect(toDateOnlyString(out)).toBe('2026-01-14');
  });
});
