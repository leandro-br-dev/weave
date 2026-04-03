import { Router, Request, Response } from 'express'
import multer, { FileFilterCallback } from 'multer'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { authenticateToken } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { getUploadsDir } from '../utils/paths.js'

const router = Router()

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// New user-data uploads directory: ~/.local/share/weave[-dev]/uploads/
const UPLOADS_ROOT = getUploadsDir()

// Legacy uploads directory (project data/uploads) for backwards-compatible reads
const LEGACY_UPLOADS_ROOT = path.resolve(path.join(process.cwd(), 'data', 'uploads'))

/**
 * Resolve the absolute file path for an attachment.
 * Tries the new user-data directory first, then falls back to the legacy
 * project directory so existing uploads remain accessible.
 */
function resolveFilePath(storagePath: string): string {
  const newPath = path.join(UPLOADS_ROOT, storagePath)
  if (fs.existsSync(newPath)) return newPath
  const legacyPath = path.join(LEGACY_UPLOADS_ROOT, storagePath)
  if (fs.existsSync(legacyPath)) return legacyPath
  // Default to new path even if it doesn't exist yet (will 404 later)
  return newPath
}

const MAX_FILE_SIZE = 10 * 1024 * 1024        // 10 MB per file
const MAX_TOTAL_SIZE = 20 * 1024 * 1024       // 20 MB total

/** MIME types that are allowed for upload. */
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  // Text / code
  'text/plain',
  'text/csv',
  'text/html',
  'text/css',
  'text/markdown',
  'application/json',
  'application/xml',
  'application/javascript',
  'application/typescript',
  'application/octet-stream',   // generic binary (covers many code files)
])

// ---------------------------------------------------------------------------
// Multer storage – files go into data/uploads/{year}/{month}/
// ---------------------------------------------------------------------------

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const dir = path.join(UPLOADS_ROOT, year, month)

    fs.mkdir(dir, { recursive: true }, (err) => {
      if (err) return cb(err, dir)
      cb(null, dir)
    })
  },

  filename(_req, file, cb) {
    const ext = path.extname(file.originalname) || ''
    const filename = `${uuidv4()}${ext}`
    cb(null, filename)
  },
})

// ---------------------------------------------------------------------------
// File type filter
// ---------------------------------------------------------------------------

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`File type "${file.mimetype}" is not allowed`))
  }
}

// ---------------------------------------------------------------------------
// Multer instance
// ---------------------------------------------------------------------------

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
})

// ---------------------------------------------------------------------------
// POST /api/uploads – upload one or more files
// ---------------------------------------------------------------------------

router.post('/', authenticateToken, upload.array('files', 20), (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files provided. Use field name "files".' })
  }

  // Validate total size
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  if (totalSize > MAX_TOTAL_SIZE) {
    // Remove already-written files
    for (const f of files) {
      try { fs.unlinkSync(f.path) } catch { /* ignore */ }
    }
    return res.status(413).json({
      error: `Total upload size ${(totalSize / 1024 / 1024).toFixed(1)} MB exceeds the 20 MB limit.`,
    })
  }

  const insertStmt = db.prepare(`
    INSERT INTO message_attachments (id, message_type, message_id, file_name, file_type, file_size, storage_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const attachments = files.map((file) => {
    // Compute the relative storage_path from the uploads root
    const relPath = path.relative(UPLOADS_ROOT, file.path)
    const id = uuidv4()

    // Persist metadata so GET /api/uploads/:id can find it later
    insertStmt.run(id, 'quick_action', '', file.originalname, file.mimetype, file.size, relPath)

    return {
      id,
      file_name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      storage_path: relPath,
    }
  })

  res.json({ attachments })
})

// ---------------------------------------------------------------------------
// GET /api/uploads/:id – retrieve a file by attachment ID
// ---------------------------------------------------------------------------

router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params

  const row = db
    .prepare('SELECT * FROM message_attachments WHERE id = ?')
    .get(id) as Record<string, any> | undefined

  if (!row) {
    return res.status(404).json({ error: 'Attachment not found' })
  }

  const filePath = resolveFilePath(row.storage_path)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on disk' })
  }

  // Set Content-Type based on the stored file_type
  const contentType = row.file_type || 'application/octet-stream'
  res.setHeader('Content-Type', contentType)

  // Images are served inline; other files trigger download
  const isImage = contentType.startsWith('image/')
  res.setHeader(
    'Content-Disposition',
    `${isImage ? 'inline' : 'attachment'}; filename="${encodeURIComponent(row.file_name)}"`
  )

  // Stream the file to the response
  const fileStream = fs.createReadStream(filePath)
  fileStream.pipe(res)
})

// ---------------------------------------------------------------------------
// GET /api/uploads/:id/metadata – return attachment metadata (including absolute path)
// ---------------------------------------------------------------------------

router.get('/:id/metadata', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params

  const row = db
    .prepare('SELECT * FROM message_attachments WHERE id = ?')
    .get(id) as Record<string, any> | undefined

  if (!row) {
    return res.status(404).json({ error: 'Attachment not found' })
  }

  const absolutePath = resolveFilePath(row.storage_path)

  res.json({
    id: row.id,
    file_name: row.file_name,
    file_type: row.file_type,
    file_size: row.file_size,
    storage_path: row.storage_path,
    absolute_path: absolutePath,
    message_type: row.message_type,
    created_at: row.created_at,
  })
})

// ---------------------------------------------------------------------------
// Multer error handler (file too large, bad type, etc.)
// ---------------------------------------------------------------------------

router.use((err: any, _req: Request, res: Response, _next: Function) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File size exceeds the ${MAX_FILE_SIZE / 1024 / 1024} MB limit.` })
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected field name. Use "files" for uploads.' })
    }
    return res.status(400).json({ error: err.message })
  }

  if (err?.message?.includes('not allowed')) {
    return res.status(415).json({ error: err.message })
  }

  res.status(500).json({ error: 'Upload failed' })
})

export default router
