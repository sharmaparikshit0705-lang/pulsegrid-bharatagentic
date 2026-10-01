export function notFound(req, res) {
  res.status(404).json({ error: `No route: ${req.method} ${req.originalUrl}` });
}

/* eslint-disable-next-line no-unused-vars */
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.message || 'Internal server error' });
}

/** Express error factory */
export const httpError = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};
