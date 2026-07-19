import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me-flowboard-jwt-secret-32chars'

/**
 * Require a valid JWT (cookie or Authorization Bearer).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null
    const token = req.cookies?.fb_token || bearer
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = { id: payload.sub, email: payload.email, name: payload.name }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
}

/**
 * Optional auth — attaches user if token present.
 */
export function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || ''
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null
    const token = req.cookies?.fb_token || bearer
    if (token) {
      const payload = jwt.verify(token, JWT_SECRET)
      req.user = { id: payload.sub, email: payload.email, name: payload.name }
    }
  } catch {
    /* ignore */
  }
  next()
}

export function signToken(user) {
  return jwt.sign(
    { email: user.email, name: user.name },
    JWT_SECRET,
    { subject: user.id, expiresIn: '30d' },
  )
}

export function cookieOptions() {
  const secure = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  }
}

export { JWT_SECRET }
