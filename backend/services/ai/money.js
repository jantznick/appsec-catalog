/**
 * Helpers for working with Prisma Decimal money values. Prisma returns Decimal
 * columns as Decimal objects (which JSON-serialize to strings); the frontend
 * wants plain numbers, so we normalize at the boundary.
 */

/** Convert a Prisma Decimal | string | number | null to a JS number (or null). */
export function decToNum(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  // Prisma.Decimal exposes toNumber(); strings/other coerce via Number().
  if (typeof value.toNumber === 'function') return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Round to a fixed number of decimal places, returning a number. */
export function round(value, places = 8) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const f = 10 ** places;
  return Math.round(Number(value) * f) / f;
}
