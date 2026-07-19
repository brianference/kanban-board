import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../../data')
const uploadsDir = path.join(__dirname, '../../uploads')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'flowboard.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
db.exec(schema)

/**
 * Generate a random hex id.
 * @param {number} bytes
 */
export function id(bytes = 16) {
  return randomBytes(bytes).toString('hex')
}

export function now() {
  return Date.now()
}

export { db, uploadsDir, dbPath }
