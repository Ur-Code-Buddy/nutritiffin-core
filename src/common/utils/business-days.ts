/**
 * Returns a new Date (UTC midnight) advanced by `businessDays` weekdays (Mon–Fri),
 * counting from the calendar day after `from` (UTC).
 */
export function addBusinessDays(from: Date, businessDays: number): Date {
  const d = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  let added = 0;
  while (added < businessDays) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return d;
}

/** YYYY-MM-DD in UTC for API / Postgres `date` columns. */
export function toDateOnlyString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
