// Minimal static server with HTTP Basic Auth. Zero dependencies.
//
// This app embeds PRIXEL's shape artwork and outline data derived from
// PRIXELMono.otf, whose licence excludes "storing on publicly available
// servers". A password keeps it a private tool rather than a public one —
// see NOTICE.md. Do not remove the auth gate.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { timingSafeEqual } from 'node:crypto'

const ROOT = join(import.meta.dirname, 'dist')
const PORT = process.env.PORT || 8080
const USER = process.env.SITE_USER || 'fitz'
const PASS = process.env.SITE_PASSWORD
if (!PASS) { console.error('SITE_PASSWORD is not set — refusing to start unprotected.'); process.exit(1) }

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.otf': 'font/otf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

/** Constant-time compare that does not leak length. */
const same = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function authed(req) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Basic ')) return false
  const [u, ...rest] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':')
  return same(u, USER) && same(rest.join(':'), PASS)
}

createServer(async (req, res) => {
  if (!authed(req)) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="The Fitz", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    })
    return res.end('Authentication required.')
  }
  // Never let a request escape dist/
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  let file = join(ROOT, rel)
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden') }
  try {
    const s = await stat(file)
    if (s.isDirectory()) file = join(file, 'index.html')
  } catch { file = join(ROOT, 'index.html') }          // SPA fallback
  try {
    const body = await readFile(file)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'X-Robots-Tag': 'noindex, nofollow',              // keep it out of search indexes
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    })
    res.end(body)
  } catch { res.writeHead(404); res.end('Not found') }
}).listen(PORT, () => console.log(`serving dist/ on :${PORT} (basic auth as "${USER}")`))
