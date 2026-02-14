// Standardized API response helpers

export function success(res, data, message, status = 200) {
  const body = { success: true, data: data !== undefined ? data : null };
  if (message) body.message = message;
  return res.status(status).json(body);
}

export function error(res, message, status = 400, code, details) {
  const body = { success: false, error: message };
  if (code) body.code = code;
  if (details) body.details = details;
  return res.status(status).json(body);
}

export function paginated(res, data, { limit, offset, total }) {
  return res.json({
    success: true,
    data,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + limit < total,
    },
  });
}
