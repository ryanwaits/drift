/**
 * Deterministic clock. Honors SOURCE_DATE_EPOCH (seconds since epoch, the
 * reproducible-builds convention) so two runs over the same input produce
 * byte-identical output — required for diffing/caching extracted specs in CI.
 */
export function nowISO(): string {
  const epoch = process.env.SOURCE_DATE_EPOCH;
  if (epoch !== undefined) {
    const seconds = Number(epoch);
    if (Number.isFinite(seconds)) return new Date(seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}
