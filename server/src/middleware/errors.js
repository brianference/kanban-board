/**
 * Central error handler for Express.
 */
export function errorHandler(err, _req, res, _next) {
  console.error(err)
  if (err?.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors?.map((e) => e.message) || [],
    })
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 1.5MB)' })
  }
  const status = err.status || err.statusCode || 500
  res.status(status).json({
    error: err.message || 'Internal server error',
  })
}

/**
 * Async route wrapper.
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<unknown>} fn
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
