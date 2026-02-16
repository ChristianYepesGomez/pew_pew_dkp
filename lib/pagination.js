export function parsePagination(query, defaults = { limit: 50, maxLimit: 100 }) {
  const limit = Math.min(Math.max(parseInt(query.limit) || defaults.limit, 1), defaults.maxLimit);
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  return { limit, offset };
}
