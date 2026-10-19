import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Connect, type Plugin } from 'vite'

const maxRecordingSize = 1024 * 1024 * 1024
const recordingDirectory = resolve(process.cwd(), 'assets', 'output')

const recordingMiddleware = (): Connect.NextHandleFunction => (request, response, next) => {
  if (request.url !== '/api/recordings') {
    next()
    return
  }
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST' }).end()
    return
  }
  if (!request.headers['content-type']?.startsWith('video/webm')) {
    response.writeHead(415).end('Expected a WebM recording')
    return
  }

  const contentLength = Number(request.headers['content-length'])
  if (Number.isFinite(contentLength) && contentLength > maxRecordingSize) {
    response.writeHead(413).end('Recording exceeds the 1 GB limit')
    request.resume()
    return
  }

  const filename = `screen-recording-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.webm`
  const outputPath = resolve(recordingDirectory, filename)
  let receivedBytes = 0
  const sizeLimit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      receivedBytes += chunk.length
      if (receivedBytes > maxRecordingSize) {
        callback(new Error('Recording exceeds the 1 GB limit'))
        return
      }
      callback(null, chunk)
    },
  })

  void (async () => {
    try {
      await mkdir(recordingDirectory, { recursive: true })
      await pipeline(request, sizeLimit, createWriteStream(outputPath, { flags: 'wx' }))
      response.writeHead(201, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ path: `assets/output/${filename}` }))
    } catch {
      await unlink(outputPath).catch(() => undefined)
      if (!response.headersSent) {
        const status = receivedBytes > maxRecordingSize ? 413 : 500
        response.writeHead(status, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: status === 413 ? 'Recording exceeds the 1 GB limit' : 'Could not save recording' }))
      }
    }
  })()
}

const recordingsPlugin: Plugin = {
  name: 'screen-recording-storage',
  configureServer(server) {
    server.middlewares.use(recordingMiddleware())
  },
  configurePreviewServer(server) {
    server.middlewares.use(recordingMiddleware())
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), recordingsPlugin],
})
