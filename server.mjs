import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import pg from 'pg'

const { Pool } = pg
const rootDirectory = fileURLToPath(new URL('.', import.meta.url))
const staticDirectory = resolve(rootDirectory, 'dist')
const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '0.0.0.0'
const maxRecordingSize = 1024 * 1024 * 1024
const adminCookie = 'phunu_admin_session'
const consentCookie = 'phunu_data_consent'
const sessionDurationSeconds = 8 * 60 * 60
const loginFailures = new Map()
const apiRequests = new Map()
const recordingRequests = new Map()
class RequestBodyTooLargeError extends Error {}
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
])

const requiredEnv = (key) => {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

const adminPassword = requiredEnv('ADMIN_PASSWORD')
const sessionSecret = requiredEnv('SESSION_SECRET')
const appDbPassword = requiredEnv('APP_DB_PASSWORD')
const dbHost = process.env.POSTGRES_HOST ?? '127.0.0.1'
const dbPort = Number(process.env.POSTGRES_PORT ?? 5432)
const dbName = process.env.POSTGRES_DB ?? 'phunuvietnam'
const bootstrapUser = process.env.POSTGRES_USER ?? 'postgres'
const bootstrapPassword = requiredEnv('POSTGRES_PASSWORD')
const appDbUser = process.env.APP_DB_USER ?? 'phunu_app'
const isProduction = process.env.NODE_ENV === 'production'
const trustProxy = process.env.TRUST_PROXY === 'true'

for (const key of ['ADMIN_PASSWORD', 'SESSION_SECRET', 'APP_DB_PASSWORD', 'POSTGRES_PASSWORD']) {
  if (process.env[key]?.includes('replace-with')) {
    throw new Error(`${key} must be changed from its .env.example placeholder`)
  }
}
if (adminPassword.length < 16) throw new Error('ADMIN_PASSWORD must be at least 16 characters')
if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters')
if (!/^[a-z_][a-z0-9_]*$/i.test(appDbUser) || !/^[a-z_][a-z0-9_]*$/i.test(dbName)) {
  throw new Error('Database and application role names must be simple SQL identifiers')
}

const adminPool = new Pool({
  host: dbHost,
  port: dbPort,
  database: dbName,
  user: bootstrapUser,
  password: bootstrapPassword,
  max: 2,
  connectionTimeoutMillis: 10_000,
})
const appPool = new Pool({
  host: dbHost,
  port: dbPort,
  database: dbName,
  user: appDbUser,
  password: appDbPassword,
  max: 10,
  connectionTimeoutMillis: 10_000,
})

const initDatabase = async () => {
  const quotedAppPassword = `'${appDbPassword.replaceAll("'", "''")}'`
  const role = await adminPool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appDbUser])
  if (role.rowCount) {
    await adminPool.query(`ALTER ROLE "${appDbUser}" WITH LOGIN PASSWORD ${quotedAppPassword}`)
  } else {
    await adminPool.query(`CREATE ROLE "${appDbUser}" WITH LOGIN PASSWORD ${quotedAppPassword}`)
  }

  await adminPool.query(`
    CREATE TABLE IF NOT EXISTS public.visitor_events (
      id BIGSERIAL PRIMARY KEY,
      session_id UUID NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      page_step SMALLINT,
      event_type VARCHAR(40) NOT NULL,
      target TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT visitor_events_details_size CHECK (pg_column_size(details) <= 32768)
    );
    CREATE INDEX IF NOT EXISTS visitor_events_occurred_at_idx ON public.visitor_events (occurred_at DESC);
    CREATE INDEX IF NOT EXISTS visitor_events_session_id_idx ON public.visitor_events (session_id, occurred_at DESC);
    CREATE TABLE IF NOT EXISTS public.screen_recordings (
      id BIGSERIAL PRIMARY KEY,
      session_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      filename TEXT NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
      large_object_oid OID NOT NULL UNIQUE
    );
    GRANT CONNECT ON DATABASE "${dbName}" TO "${appDbUser}";
    GRANT USAGE ON SCHEMA public TO "${appDbUser}";
    GRANT SELECT, INSERT, DELETE ON public.visitor_events TO "${appDbUser}";
    GRANT SELECT, INSERT, DELETE ON public.screen_recordings TO "${appDbUser}";
    GRANT USAGE, SELECT ON SEQUENCE public.visitor_events_id_seq TO "${appDbUser}";
    GRANT USAGE, SELECT ON SEQUENCE public.screen_recordings_id_seq TO "${appDbUser}";
  `)

  await appPool.query('SELECT 1')
  await adminPool.end()
  console.log('PostgreSQL connected; application schema is ready')
}

const sendJson = (response, status, body, extraHeaders = {}) => {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  response.end(JSON.stringify(body))
}

const readJson = async (request, maxBytes = 32 * 1024) => {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) throw new RequestBodyTooLargeError('Request body too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const requestIp = (request) => {
  if (trustProxy && typeof request.headers['x-forwarded-for'] === 'string') {
    const forwardedAddress = request.headers['x-forwarded-for'].split(',')[0]?.trim()
    if (forwardedAddress) return forwardedAddress
  }
  return request.socket.remoteAddress ?? 'unknown'
}

const isRateLimited = (table, key, limit, windowMs) => {
  const now = Date.now()
  if (table.size > 5000) {
    for (const [entryKey, entry] of table) {
      if (entry.resetAt <= now) table.delete(entryKey)
    }
  }
  const previous = table.get(key)
  if (!previous || previous.resetAt <= now) {
    table.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  previous.count += 1
  return previous.count > limit
}

const hasSameOrigin = (request) => {
  const origin = request.headers.origin
  if (!origin) return false
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

const signToken = (payload) => {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', sessionSecret).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${signature}`
}

const verifyToken = (token) => {
  const [encodedPayload, signature, extra] = token.split('.')
  if (!encodedPayload || !signature || extra) return null
  const expected = createHmac('sha256', sessionSecret).update(encodedPayload).digest()
  let actual
  try {
    actual = Buffer.from(signature, 'base64url')
  } catch {
    return false
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    return payload.exp > Date.now() ? payload : null
  } catch {
    return null
  }
}

const readCookie = (request, name) => {
  const cookies = request.headers.cookie?.split(';').map((value) => value.trim()) ?? []
  return cookies.find((cookie) => cookie.startsWith(`${name}=`))?.slice(name.length + 1) ?? null
}

const hasAdminSession = (request) => verifyToken(readCookie(request, adminCookie) ?? '')?.kind === 'admin'
const hasVisitorConsent = (request) => verifyToken(readCookie(request, consentCookie) ?? '')?.kind === 'visitor-consent'

const requireAdmin = (request, response) => {
  if (hasAdminSession(request)) return true
  sendJson(response, 401, { error: 'Admin login required' })
  return false
}

const readSessionId = (request) => {
  const sessionId = request.headers['x-session-id']
  if (typeof sessionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return null
  }
  return sessionId
}

const saveEvent = async (request, response) => {
  if (!hasSameOrigin(request)) {
    sendJson(response, 403, { error: 'Same-origin request required' })
    request.resume()
    return
  }
  if (!hasVisitorConsent(request)) {
    sendJson(response, 403, { error: 'Visitor consent is required' })
    request.resume()
    return
  }
  const sessionId = readSessionId(request)
  if (!sessionId) {
    sendJson(response, 400, { error: 'Valid session ID is required' })
    request.resume()
    return
  }
  if (isRateLimited(apiRequests, `${requestIp(request)}:${sessionId}`, 180, 60_000)) {
    sendJson(response, 429, { error: 'Too many event requests' })
    request.resume()
    return
  }

  try {
    const event = await readJson(request)
    if (
      typeof event.eventType !== 'string' || event.eventType.length > 40 ||
      (event.pageStep !== null && event.pageStep !== undefined && (!Number.isInteger(event.pageStep) || event.pageStep < 1 || event.pageStep > 9)) ||
      (event.target !== null && event.target !== undefined && (typeof event.target !== 'string' || event.target.length > 200))
    ) {
      sendJson(response, 400, { error: 'Invalid event payload' })
      return
    }
    const details = event.details && typeof event.details === 'object' && !Array.isArray(event.details)
      ? event.details
      : {}
    await appPool.query(
      `INSERT INTO public.visitor_events (session_id, page_step, event_type, target, details)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [sessionId, event.pageStep ?? null, event.eventType, event.target ?? null, JSON.stringify(details)],
    )
    sendJson(response, 201, { saved: true })
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError
    if (!tooLarge && !(error instanceof SyntaxError)) {
      console.error('Could not save visitor event:', error instanceof Error ? error.message : 'Unknown error')
    }
    sendJson(response, tooLarge ? 413 : error instanceof SyntaxError ? 400 : 500, {
      error: tooLarge ? 'Event payload is too large' : error instanceof SyntaxError ? 'Invalid JSON payload' : 'Could not save visitor event',
    })
  }
}

const saveRecording = async (request, response) => {
  if (!hasSameOrigin(request)) {
    sendJson(response, 403, { error: 'Same-origin request required' })
    request.resume()
    return
  }
  if (!hasVisitorConsent(request)) {
    sendJson(response, 403, { error: 'Visitor consent is required' })
    request.resume()
    return
  }
  if (isRateLimited(recordingRequests, requestIp(request), 4, 60 * 60 * 1000)) {
    sendJson(response, 429, { error: 'Recording upload limit reached' })
    request.resume()
    return
  }
  const sessionId = readSessionId(request)
  if (!sessionId) {
    sendJson(response, 400, { error: 'Valid session ID is required' })
    request.resume()
    return
  }
  if (!request.headers['content-type']?.startsWith('video/webm')) {
    sendJson(response, 415, { error: 'Expected a WebM recording' })
    request.resume()
    return
  }
  const contentLength = Number(request.headers['content-length'])
  if (Number.isFinite(contentLength) && contentLength > maxRecordingSize) {
    sendJson(response, 413, { error: 'Recording exceeds the 1 GB limit' })
    request.resume()
    return
  }

  const filename = `screen-recording-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.webm`
  const client = await appPool.connect()
  let transactionStarted = false
  let oid
  let descriptor
  let size = 0

  try {
    await client.query('BEGIN')
    transactionStarted = true
    const created = await client.query('SELECT lo_create(0) AS oid')
    oid = created.rows[0].oid
    const opened = await client.query('SELECT lo_open($1, 131072) AS descriptor', [oid])
    descriptor = opened.rows[0].descriptor

    for await (const value of request) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
      size += chunk.length
      if (size > maxRecordingSize) throw new Error('Recording exceeds the 1 GB limit')
      const written = await client.query('SELECT lowrite($1, $2) AS bytes_written', [descriptor, chunk])
      if (written.rows[0].bytes_written !== chunk.length) throw new Error('Incomplete write to PostgreSQL large object')
    }
    if (size === 0) throw new Error('Recording is empty')
    await client.query('SELECT lo_close($1)', [descriptor])
    descriptor = null
    const saved = await client.query(
      `INSERT INTO public.screen_recordings (session_id, filename, mime_type, size_bytes, large_object_oid)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [sessionId, filename, request.headers['content-type'], size, oid],
    )
    await client.query('COMMIT')
    transactionStarted = false
    sendJson(response, 201, { id: saved.rows[0].id, sizeBytes: size })
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined)
    if (!response.headersSent) {
      sendJson(response, size > maxRecordingSize ? 413 : 500, {
        error: size > maxRecordingSize ? 'Recording exceeds the 1 GB limit' : 'Could not save recording',
      })
    }
    if (size <= maxRecordingSize && error instanceof Error && error.name !== 'AbortError') {
      console.error('Could not save screen recording:', error.message)
    }
  } finally {
    client.release()
  }
}

const listEvents = async (request, response, requestUrl) => {
  if (!requireAdmin(request, response)) return
  const limit = Math.min(Math.max(Number(requestUrl.searchParams.get('limit') ?? 50), 1), 100)
  const offset = Math.max(Number(requestUrl.searchParams.get('offset') ?? 0), 0)
  const search = (requestUrl.searchParams.get('search') ?? '').trim().slice(0, 100)
  const result = await appPool.query(
    `SELECT id, session_id, occurred_at, page_step, event_type, target, details
     FROM public.visitor_events
     WHERE $3 = '' OR details::text ILIKE '%' || $3 || '%'
       OR COALESCE(target, '') ILIKE '%' || $3 || '%'
       OR event_type ILIKE '%' || $3 || '%'
     ORDER BY occurred_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset, search],
  )
  sendJson(response, 200, { events: result.rows })
}

const exportEvents = async (request, response, requestUrl) => {
  if (!requireAdmin(request, response)) return
  const search = (requestUrl.searchParams.get('search') ?? '').trim().slice(0, 100)
  const result = await appPool.query(
    `SELECT id, session_id, occurred_at, page_step, event_type, target, details
     FROM public.visitor_events
     WHERE $1 = '' OR details::text ILIKE '%' || $1 || '%'
       OR COALESCE(target, '') ILIKE '%' || $1 || '%'
       OR event_type ILIKE '%' || $1 || '%'
     ORDER BY occurred_at DESC`,
    [search],
  )
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PhunuVietnam Admin'
  workbook.created = new Date()
  const worksheet = workbook.addWorksheet('Lịch sử thao tác')
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 12 },
    { header: 'Thời gian', key: 'occurredAt', width: 24 },
    { header: 'Session ID', key: 'sessionId', width: 38 },
    { header: 'Trang', key: 'pageStep', width: 12 },
    { header: 'Hành động', key: 'eventType', width: 24 },
    { header: 'Mục tiêu', key: 'target', width: 32 },
    { header: 'Chi tiết', key: 'details', width: 80 },
  ]
  worksheet.getRow(1).font = { bold: true }
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  for (const event of result.rows) {
    worksheet.addRow({
      id: event.id,
      occurredAt: event.occurred_at,
      sessionId: event.session_id,
      pageStep: event.page_step,
      eventType: event.event_type,
      target: event.target,
      details: JSON.stringify(event.details),
    })
  }
  worksheet.autoFilter = { from: 'A1', to: 'G1' }
  const file = Buffer.from(await workbook.xlsx.writeBuffer())
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Disposition': 'attachment; filename="visitor-events.xlsx"',
    'Content-Length': file.length,
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(file)
}

const listRecordings = async (request, response, requestUrl) => {
  if (!requireAdmin(request, response)) return
  const limit = Math.min(Math.max(Number(requestUrl.searchParams.get('limit') ?? 50), 1), 100)
  const offset = Math.max(Number(requestUrl.searchParams.get('offset') ?? 0), 0)
  const result = await appPool.query(
    `SELECT id, session_id, created_at, filename, mime_type, size_bytes
     FROM public.screen_recordings ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
  sendJson(response, 200, { recordings: result.rows })
}

const streamRecording = async (request, response, recordingId, download = false) => {
  if (!requireAdmin(request, response)) return
  if (!/^[1-9]\d{0,17}$/.test(recordingId)) {
    sendJson(response, 400, { error: 'Invalid recording ID' })
    return
  }
  const client = await appPool.connect()
  try {
    await client.query('BEGIN')
    const record = await client.query(
      'SELECT filename, mime_type, size_bytes, large_object_oid FROM public.screen_recordings WHERE id = $1',
      [recordingId],
    )
    if (record.rowCount === 0) {
      await client.query('ROLLBACK')
      sendJson(response, 404, { error: 'Recording not found' })
      return
    }
    const { filename, mime_type: mimeType, size_bytes: sizeBytes, large_object_oid: oid } = record.rows[0]
    const totalBytes = Number(sizeBytes)
    const rangeHeader = request.headers.range
    const rangeMatch = typeof rangeHeader === 'string' ? rangeHeader.match(/^bytes=(\d*)-(\d*)$/) : null
    if (rangeHeader && !rangeMatch) {
      await client.query('ROLLBACK')
      response.writeHead(416, { 'Content-Range': `bytes */${totalBytes}` }).end()
      return
    }
    let start = 0
    let end = totalBytes - 1
    if (rangeMatch) {
      if (rangeMatch[1]) {
        start = Number(rangeMatch[1])
        if (rangeMatch[2]) end = Math.min(Number(rangeMatch[2]), totalBytes - 1)
      } else {
        const suffixLength = Number(rangeMatch[2])
        start = Math.max(totalBytes - suffixLength, 0)
      }
      if (start >= totalBytes || end < start) {
        await client.query('ROLLBACK')
        response.writeHead(416, { 'Content-Range': `bytes */${totalBytes}` }).end()
        return
      }
    }
    const opened = await client.query('SELECT lo_open($1, 262144) AS descriptor', [oid])
    const descriptor = opened.rows[0].descriptor
    if (start > 0) await client.query('SELECT lo_lseek($1, $2, 0)', [descriptor, start])
    const contentLength = end - start + 1
    response.writeHead(rangeMatch ? 206 : 200, {
      'Cache-Control': 'no-store',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Content-Length': contentLength,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      ...(rangeMatch ? { 'Content-Range': `bytes ${start}-${end}/${totalBytes}` } : {}),
      'X-Content-Type-Options': 'nosniff',
    })
    let remaining = contentLength
    while (remaining > 0) {
      const amount = Math.min(64 * 1024, remaining)
      const chunkResult = await client.query('SELECT loread($1, $2) AS chunk', [descriptor, amount])
      const chunk = chunkResult.rows[0].chunk
      if (!chunk?.length) break
      remaining -= chunk.length
      if (!response.write(chunk)) await new Promise((resolve) => response.once('drain', resolve))
    }
    await client.query('SELECT lo_close($1)', [descriptor])
    await client.query('COMMIT')
    response.end()
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    if (response.headersSent) response.destroy()
    else sendJson(response, 500, { error: 'Could not stream recording' })
    console.error('Could not stream recording:', error instanceof Error ? error.message : 'Unknown error')
  } finally {
    client.release()
  }
}

const deleteAdminRecord = async (request, response, kind, id) => {
  if (!requireAdmin(request, response)) return
  if (!/^[1-9]\d{0,17}$/.test(id)) {
    sendJson(response, 400, { error: 'Invalid record ID' })
    return
  }
  if (kind === 'events') {
    const result = await appPool.query('DELETE FROM public.visitor_events WHERE id = $1', [id])
    sendJson(response, result.rowCount ? 200 : 404, { deleted: result.rowCount === 1 })
    return
  }

  const client = await appPool.connect()
  try {
    await client.query('BEGIN')
    const record = await client.query(
      'DELETE FROM public.screen_recordings WHERE id = $1 RETURNING large_object_oid',
      [id],
    )
    if (!record.rowCount) {
      await client.query('ROLLBACK')
      sendJson(response, 404, { error: 'Recording not found' })
      return
    }
    await client.query('SELECT lo_unlink($1)', [record.rows[0].large_object_oid])
    await client.query('COMMIT')
    sendJson(response, 200, { deleted: true })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    sendJson(response, 500, { error: 'Could not delete recording' })
    console.error('Could not delete recording:', error instanceof Error ? error.message : 'Unknown error')
  } finally {
    client.release()
  }
}

const deleteAllAdminRecords = async (request, response, kind) => {
  if (!requireAdmin(request, response)) return
  const client = await appPool.connect()
  try {
    await client.query('BEGIN')
    if (kind === 'events') {
      const result = await client.query('DELETE FROM public.visitor_events')
      await client.query('COMMIT')
      sendJson(response, 200, { deleted: result.rowCount })
      return
    }
    const recordings = await client.query(
      'DELETE FROM public.screen_recordings RETURNING large_object_oid',
    )
    for (const recording of recordings.rows) {
      await client.query('SELECT lo_unlink($1)', [recording.large_object_oid])
    }
    await client.query('COMMIT')
    sendJson(response, 200, { deleted: recordings.rowCount })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    sendJson(response, 500, { error: `Could not delete all ${kind}` })
    console.error(`Could not delete all ${kind}:`, error instanceof Error ? error.message : 'Unknown error')
  } finally {
    client.release()
  }
}

const login = async (request, response) => {
  if (!hasSameOrigin(request)) {
    sendJson(response, 403, { error: 'Same-origin request required' })
    request.resume()
    return
  }
  const key = requestIp(request)
  if (isRateLimited(loginFailures, key, 8, 15 * 60 * 1000)) {
    sendJson(response, 429, { error: 'Too many login attempts' })
    request.resume()
    return
  }
  try {
    const body = await readJson(request)
    const submitted = typeof body.password === 'string' ? Buffer.from(body.password) : Buffer.alloc(0)
    const expected = Buffer.from(adminPassword)
    const valid = submitted.length === expected.length && timingSafeEqual(submitted, expected)
    if (!valid) {
      sendJson(response, 401, { error: 'Invalid administrator password' })
      return
    }
    loginFailures.delete(key)
    const token = signToken({ kind: 'admin', exp: Date.now() + sessionDurationSeconds * 1000 })
    const secure = isProduction ? '; Secure' : ''
    sendJson(response, 200, { authenticated: true }, {
      'Set-Cookie': `${adminCookie}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${sessionDurationSeconds}${secure}`,
    })
  } catch {
    sendJson(response, 400, { error: 'Invalid login request' })
  }
}

const saveConsent = async (request, response) => {
  if (!hasSameOrigin(request)) {
    sendJson(response, 403, { error: 'Same-origin request required' })
    request.resume()
    return
  }
  try {
    const body = await readJson(request)
    const secure = isProduction ? '; Secure' : ''
    if (body.granted === true) {
      const token = signToken({ kind: 'visitor-consent', exp: Date.now() + 365 * 24 * 60 * 60 * 1000 })
      sendJson(response, 200, { consent: true }, {
        'Set-Cookie': `${consentCookie}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=31536000${secure}`,
      })
      return
    }
    if (body.granted === false) {
      sendJson(response, 200, { consent: false }, {
        'Set-Cookie': `${consentCookie}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`,
      })
      return
    }
    sendJson(response, 400, { error: 'Consent choice is required' })
  } catch {
    sendJson(response, 400, { error: 'Invalid consent request' })
  }
}

const serveStatic = async (request, response, pathname) => {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    response.writeHead(400).end('Bad request')
    return
  }
  const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath
  const filePath = resolve(staticDirectory, `.${requestedPath}`)
  if (filePath !== staticDirectory && !filePath.startsWith(`${staticDirectory}${sep}`)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  try {
    const fileInfo = await stat(filePath)
    if (!fileInfo.isFile()) throw new Error('Not a file')
    response.writeHead(200, {
      'Cache-Control': requestedPath === '/index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'Content-Length': fileInfo.size,
      'Content-Type': mimeTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    })
    if (request.method === 'HEAD') response.end()
    else await pipeline(createReadStream(filePath), response)
  } catch {
    if (response.headersSent) {
      response.destroy()
      return
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && !extname(decodedPath)) {
      try {
        const indexPath = join(staticDirectory, 'index.html')
        const indexInfo = await stat(indexPath)
        response.writeHead(200, {
          'Cache-Control': 'no-cache',
          'Content-Length': indexInfo.size,
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        })
        if (request.method === 'HEAD') response.end()
        else await pipeline(createReadStream(indexPath), response)
      } catch {
        if (!response.headersSent) response.writeHead(404).end('Not found')
      }
      return
    }
    response.writeHead(404).end('Not found')
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  try {
    if (requestUrl.pathname === '/api/health') {
      await appPool.query('SELECT 1')
      sendJson(response, 200, { healthy: true })
      return
    }
    if (requestUrl.pathname === '/api/consent' && request.method === 'POST') {
      await saveConsent(request, response)
      return
    }
    if (requestUrl.pathname === '/api/events' && request.method === 'POST') {
      await saveEvent(request, response)
      return
    }
    if (requestUrl.pathname === '/api/recordings' && request.method === 'POST') {
      await saveRecording(request, response)
      return
    }
    if (requestUrl.pathname === '/api/admin/login' && request.method === 'POST') {
      await login(request, response)
      return
    }
    if (requestUrl.pathname === '/api/admin/session' && request.method === 'GET') {
      sendJson(response, hasAdminSession(request) ? 200 : 401, { authenticated: hasAdminSession(request) })
      return
    }
    if (requestUrl.pathname === '/api/admin/logout' && request.method === 'POST') {
      if (!hasSameOrigin(request)) {
        sendJson(response, 403, { error: 'Same-origin request required' })
        return
      }
      sendJson(response, 200, { authenticated: false }, {
        'Set-Cookie': `${adminCookie}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${isProduction ? '; Secure' : ''}`,
      })
      return
    }
    if (requestUrl.pathname === '/api/admin/events' && request.method === 'GET') {
      await listEvents(request, response, requestUrl)
      return
    }
    if (requestUrl.pathname === '/api/admin/events/export' && request.method === 'GET') {
      await exportEvents(request, response, requestUrl)
      return
    }
    if (requestUrl.pathname === '/api/admin/recordings' && request.method === 'GET') {
      await listRecordings(request, response, requestUrl)
      return
    }
    const recordingMatch = requestUrl.pathname.match(/^\/api\/admin\/recordings\/([1-9]\d{0,17})$/)
    if (recordingMatch && request.method === 'GET') {
      await streamRecording(request, response, recordingMatch[1], requestUrl.searchParams.get('download') === '1')
      return
    }
    const collectionDeleteMatch = requestUrl.pathname.match(/^\/api\/admin\/(events|recordings)$/)
    if (collectionDeleteMatch && request.method === 'DELETE') {
      if (!hasSameOrigin(request)) {
        sendJson(response, 403, { error: 'Same-origin request required' })
        return
      }
      await deleteAllAdminRecords(request, response, collectionDeleteMatch[1])
      return
    }
    const deleteMatch = requestUrl.pathname.match(/^\/api\/admin\/(events|recordings)\/([1-9]\d{0,17})$/)
    if (deleteMatch && request.method === 'DELETE') {
      if (!hasSameOrigin(request)) {
        sendJson(response, 403, { error: 'Same-origin request required' })
        return
      }
      await deleteAdminRecord(request, response, deleteMatch[1], deleteMatch[2])
      return
    }
    if (requestUrl.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'Not found' })
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    await serveStatic(request, response, requestUrl.pathname)
  } catch (error) {
    console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error')
    if (!response.headersSent) sendJson(response, 500, { error: 'Internal server error' })
    else response.destroy()
  }
})

server.requestTimeout = 15 * 60 * 1000
server.listen(port, host, () => {
  console.log(`App server listening on http://${host}:${port}`)
})

const shutdown = () => {
  server.close((error) => {
    if (error) {
      console.error('Server shutdown failed:', error)
      process.exitCode = 1
    }
  })
  void Promise.all([adminPool.end(), appPool.end()])
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

try {
  await initDatabase()
} catch (error) {
  console.error('Database initialization failed:', error)
  process.exitCode = 1
  server.close()
  await Promise.all([adminPool.end(), appPool.end()])
}
