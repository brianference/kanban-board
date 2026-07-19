import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { errorHandler } from './middleware/errors.js'
import authRoutes from './routes/auth.js'
import projectRoutes from './routes/projects.js'
import boardRoutes from './routes/boards.js'
import taskRoutes from './routes/tasks.js'
import searchRoutes from './routes/search.js'
import miscRoutes from './routes/misc.js'
import './db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT || 8787)
const isProd = process.env.NODE_ENV === 'production'
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            'img-src': ["'self'", 'data:', 'blob:'],
            'script-src': ["'self'"],
            'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
            'connect-src': ["'self'"],
          },
        }
      : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

app.use(
  cors({
    origin: isProd ? clientOrigin : true,
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/boards', boardRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/search', searchRoutes)
app.use('/api', miscRoutes)

// Serve Vite production build
const clientDist = path.join(__dirname, '../../client/dist')
app.use(express.static(clientDist, { maxAge: isProd ? '7d' : 0, index: false }))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next()
  })
})

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`FlowBoard server listening on http://localhost:${PORT}`)
})
