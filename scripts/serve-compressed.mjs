#!/usr/bin/env node
// Serves the production build the way Cloudflare's edge does, for
// Lighthouse CI (.lighthouserc.json).
//
// `vp preview` runs the built Worker and its static assets in workerd, but
// sends every response uncompressed: in production Cloudflare compresses at
// the edge, in front of the Worker. Auditing the raw preview would fail
// text-compression and document-latency for something production doesn't
// do, so this puts a compressing proxy in front of it:
//
//   :PORT (default 3000)  brotli/gzip, by Accept-Encoding
//     -> vp preview on :UPSTREAM_PORT (default 4173)
//
// It prints READY_LINE only once the preview answers, so Lighthouse's
// startServerReadyPattern can't race a server that is still booting.
//
//   pnpm build && node scripts/serve-compressed.mjs

import { spawn } from 'node:child_process'
import http from 'node:http'
import { pipeline } from 'node:stream'
import zlib from 'node:zlib'

const PORT = Number(process.env.PORT ?? 3000)
const UPSTREAM_PORT = Number(process.env.UPSTREAM_PORT ?? 4173)
const READY_LINE = `serve-compressed: ready on http://localhost:${PORT}`

// What Cloudflare compresses: text, JSON/JS, SVG and WebAssembly. Images,
// fonts and archives are already compressed.
const COMPRESSIBLE =
  /^(text\/|application\/(javascript|json|wasm|xml|manifest\+json)|image\/svg\+xml)/

const preview = spawn(
  'pnpm',
  ['exec', 'vp', 'preview', '--port', String(UPSTREAM_PORT), '--strictPort'],
  { stdio: ['ignore', 'inherit', 'inherit'] },
)
preview.on('exit', (code) => {
  console.error(`serve-compressed: vp preview exited (${code})`)
  process.exit(code ?? 1)
})
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    preview.kill(signal)
    process.exit(0)
  })
}

function pickEncoding(acceptEncoding = '') {
  if (/\bbr\b/.test(acceptEncoding)) return 'br'
  if (/\bgzip\b/.test(acceptEncoding)) return 'gzip'
  return null
}

const server = http.createServer((req, res) => {
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: UPSTREAM_PORT,
      method: req.method,
      path: req.url,
      // Ask the preview for identity so this proxy is the only compressor.
      headers: { ...req.headers, 'accept-encoding': 'identity' },
    },
    (upstreamRes) => {
      const headers = { ...upstreamRes.headers }
      const type = String(headers['content-type'] ?? '')
      const encoding =
        req.method !== 'HEAD' &&
        upstreamRes.statusCode !== 204 &&
        upstreamRes.statusCode !== 304 &&
        !headers['content-encoding'] &&
        COMPRESSIBLE.test(type)
          ? pickEncoding(req.headers['accept-encoding'])
          : null

      if (!encoding) {
        res.writeHead(upstreamRes.statusCode ?? 502, headers)
        upstreamRes.pipe(res)
        return
      }
      delete headers['content-length']
      headers['content-encoding'] = encoding
      headers.vary = headers.vary
        ? `${headers.vary}, Accept-Encoding`
        : 'Accept-Encoding'
      res.writeHead(upstreamRes.statusCode ?? 502, headers)
      const compressor =
        encoding === 'br'
          ? zlib.createBrotliCompress({
              params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
            })
          : zlib.createGzip()
      pipeline(upstreamRes, compressor, res, () => {})
    },
  )
  upstream.on('error', () => {
    res.writeHead(502).end()
  })
  req.pipe(upstream)
})

async function waitForPreview() {
  for (let attempt = 0; attempt < 240; attempt++) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${UPSTREAM_PORT}/favicon.svg`,
      )
      if (response.ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('vp preview did not start within 2 minutes')
}

await waitForPreview()
server.listen(PORT, () => console.log(READY_LINE))
