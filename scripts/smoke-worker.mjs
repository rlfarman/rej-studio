// Exercise the server routes in the real Workers runtime, over HTTP.
//
//   pnpm build && pnpm test:worker
//
// This is the only place the Worker is tested as it is deployed: `wrangler
// dev` runs the built Worker in workerd with its static assets, so the
// optimizer `.wasm` is instantiated the Cloudflare way (a compiled module in
// the bundle — workerd cannot compile WebAssembly from bytes at runtime), the
// gene data is read through the assets binding, and /api/mcp is spoken to
// over the protocol with a bearer token.
//
// It lives here rather than in Vitest because @cloudflare/vitest-pool-workers
// supports Vitest 4 and this repo runs Vite+'s Vitest 5; the pool's proxy
// worker fails to start. See AGENTS.md ("Testing").

import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const worker = path.join(root, 'dist/server/wrangler.json')

/** A token long enough for the endpoint to accept (src/server/mcp/tokens.ts). */
const TOKEN = `smoke-agent:${'s'.repeat(32)}`
const SECRET = 's'.repeat(32)
const HEALTH_TOKEN = 'h'.repeat(40)

const checks = []
function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail })
}

/** A free port, so a local `pnpm dev` on 3000 doesn't have to be stopped. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

async function waitForReady(url, child) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler dev exited with ${child.exitCode}`)
    }
    try {
      const response = await fetch(`${url}/api/version`)
      if (response.ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error('wrangler dev did not become ready within 60s')
}

/** One JSON-RPC call to /api/mcp, as a client would make it. */
async function rpc(url, method, params, { secret = SECRET, id = 1 } = {}) {
  const response = await fetch(`${url}/api/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
  const body = await response.text()
  if (!response.ok) return { status: response.status, body }
  // `responseMode: 'auto'` answers with JSON unless the call emitted a
  // notification first, in which case it is an SSE stream of one event.
  const streamed = (response.headers.get('content-type') ?? '').includes(
    'text/event-stream',
  )
  const json = streamed
    ? JSON.parse(
        body
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .at(-1),
      )
    : JSON.parse(body)
  return { status: response.status, json }
}

/** An initialized session, so tool calls are accepted. */
async function initialize(url) {
  const { json } = await rpc(url, 'initialize', {
    protocolVersion: '2026-07-28',
    capabilities: {},
    clientInfo: { name: 'rej-smoke', version: '1.0.0' },
  })
  return json
}

async function callTool(url, name, args, options) {
  const { json, status, body } = await rpc(
    url,
    'tools/call',
    { name, arguments: args },
    options,
  )
  if (!json) throw new Error(`tools/call ${name}: HTTP ${status} ${body}`)
  if (json.error) throw new Error(`tools/call ${name}: ${json.error.message}`)
  return json.result
}

const textOf = (result) =>
  (result.content ?? []).map((block) => block.text ?? '').join('\n')

async function main() {
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`

  const child = spawn(
    'npx',
    [
      'wrangler',
      'dev',
      '--config',
      worker,
      '--port',
      String(port),
      '--ip',
      '127.0.0.1',
      '--local',
      '--var',
      `MCP_TOKENS:${TOKEN}`,
      '--var',
      `HEALTH_AUTH_TOKEN:${HEALTH_TOKEN}`,
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const log = []
  child.stdout.on('data', (chunk) => log.push(String(chunk)))
  child.stderr.on('data', (chunk) => log.push(String(chunk)))

  try {
    await waitForReady(url, child)

    // --- version -----------------------------------------------------------
    const version = await (await fetch(`${url}/api/version`)).json()
    check(
      'version reports the optimizer digest',
      /^[0-9a-f]{64}$/.test(version.optimizerSha256),
      JSON.stringify(version),
    )
    check(
      'version reports the corpus it points at',
      typeof version.corpus?.version === 'string' &&
        version.corpus.version.length > 0,
    )
    check(
      'version never reports a blank commit',
      typeof version.sha === 'string' && version.sha.length > 0,
    )

    // --- health ------------------------------------------------------------
    const liveness = await fetch(`${url}/api/health`)
    check(
      'health answers an anonymous probe with liveness only',
      liveness.status === 200 &&
        JSON.stringify(await liveness.json()) === '{"status":"ok"}',
    )
    const deep = await fetch(`${url}/api/health`, {
      headers: { authorization: `Bearer ${HEALTH_TOKEN}` },
    })
    const deepBody = await deep.json()
    // With no R2 binding (none until cutover) there is nothing deeper to
    // check, so an authorized probe gets the same liveness answer.
    check(
      'health answers an authorized probe',
      deep.status === 200 && deepBody.status === 'ok',
      JSON.stringify(deepBody),
    )

    // --- auth --------------------------------------------------------------
    const noToken = await rpc(url, 'tools/list', {}, { secret: '' })
    check('mcp refuses a request with no token', noToken.status === 401)
    const badToken = await rpc(
      url,
      'tools/list',
      {},
      { secret: 'x'.repeat(32) },
    )
    check('mcp refuses a wrong token', badToken.status === 401)

    // --- the protocol ------------------------------------------------------
    const initialized = await initialize(url)
    check(
      'mcp initializes with a valid token',
      initialized?.result?.serverInfo?.name === 'com.rej-studio/design',
      JSON.stringify(initialized),
    )

    const list = await rpc(url, 'tools/list', {})
    const tools = (list.json?.result?.tools ?? []).map((tool) => tool.name)
    check(
      'tools/list offers the four tools',
      ['get_design', 'get_gene', 'search_genes', 'submit_design'].every(
        (name) => tools.includes(name),
      ),
      tools.join(','),
    )

    // --- gene data, read through the assets binding ------------------------
    const search = await callTool(url, 'search_genes', { query: 'TP53' })
    const matches = search.structuredContent?.results ?? []
    check(
      'search_genes finds TP53 in the corpus',
      matches[0]?.symbol === 'TP53' &&
        matches[0]?.ensembl_gene_id === 'ENSG00000141510',
      JSON.stringify(matches[0]),
    )

    const gene = await callTool(url, 'get_gene', { symbol: 'TP53' })
    const isoforms = gene.structuredContent?.isoforms ?? []
    const tp53 = isoforms.find(
      (isoform) => isoform.ensembl_transcript_id === 'ENST00000269305',
    )
    check(
      'get_gene returns TP53 with its isoforms',
      tp53?.coding_sequence_length === 1182,
      JSON.stringify(tp53),
    )

    // The coding sequence to design: TP53-201, straight out of the corpus the
    // Worker just read.
    const geneFile = await (
      await fetch(`${url}/gene-data/sample/genes/ENSG00000141510.json`)
    ).json()
    const CDS = geneFile.isoforms.find(
      (isoform) => isoform.id === 'ENST00000269305',
    ).codingSequence

    // --- a real design, in workerd -----------------------------------------
    const started = Date.now()
    const design = await callTool(url, 'submit_design', {
      name: 'TP53 smoke',
      sequence: CDS,
      species: 'human',
      seed: 1234,
    })
    const elapsed = (Date.now() - started) / 1000
    const result = design.structuredContent?.result
    check(
      'submit_design returns a completed design inline',
      design.structuredContent?.status === 'completed' &&
        result?.optimized_sequence?.length === CDS.length,
      textOf(design),
    )
    check(
      'the design is optimized, not echoed back',
      result?.optimized_sequence !== CDS,
    )
    // The two fragments cover the sequence and then some: each carries the
    // bases either side of the junction, so they overlap slightly.
    check(
      'the design is split into two fragments at a point inside it',
      result?.seq5?.length > 0 &&
        result?.seq3?.length > 0 &&
        result.seq5.length + result.seq3.length >= CDS.length &&
        result.split_point > 0 &&
        result.split_point < CDS.length,
      JSON.stringify({
        seq5: result?.seq5?.length,
        seq3: result?.seq3?.length,
        split_point: result?.split_point,
      }),
    )
    check(
      'the result carries the objectives before and after',
      (result?.objectives_report_after?.entries ?? []).length > 0,
    )
    console.log(
      `[smoke] TP53 (${CDS.length} bp) designed in ${elapsed.toFixed(2)} s ` +
        `(round trip; the tool reported ${textOf(design).match(/\(([\d.]+) s\)/)?.[1] ?? '?'} s)`,
    )

    const repeat = await callTool(url, 'submit_design', {
      name: 'TP53 smoke',
      sequence: CDS,
      species: 'human',
      seed: 1234,
    })
    check(
      'a seeded design reproduces exactly',
      repeat.structuredContent?.result?.optimized_sequence ===
        result?.optimized_sequence,
    )

    // --- the guards --------------------------------------------------------
    const tooLong = await callTool(url, 'submit_design', {
      name: 'too long',
      sequence: `ATG${'AAA'.repeat(4500)}TAA`,
    })
    check(
      'the length guard refuses an oversized sequence',
      tooLong.isError === true && /web app/.test(textOf(tooLong)),
      textOf(tooLong),
    )

    const invalid = await callTool(url, 'submit_design', {
      name: 'invalid',
      sequence: 'ATGXYZTAA',
    })
    check(
      'an invalid sequence is refused, not fixed',
      invalid.isError === true && /cannot be run/.test(textOf(invalid)),
      textOf(invalid),
    )

    const stale = await callTool(url, 'get_design', { job_id: 'job-1' })
    check(
      'get_design says designs come back from submit_design',
      stale.isError === true && /submit_design/.test(textOf(stale)),
      textOf(stale),
    )

    // --- the design view ---------------------------------------------------
    const view = await rpc(url, 'resources/read', {
      uri: 'ui://rej-studio/design-result.html',
    })
    const html = view.json?.result?.contents?.[0]?.text ?? ''
    check(
      'the design view is served as one document',
      html.startsWith('<!doctype html>') && html.includes('/mcp/app-bridge.js'),
      html.slice(0, 80),
    )
    const bridge = await fetch(`${url}/mcp/app-bridge.js`)
    check(
      'the view’s client library is a static asset of this build',
      bridge.ok && (await bridge.text()).length > 1000,
      `HTTP ${bridge.status}`,
    )
  } finally {
    child.kill('SIGTERM')
  }

  const failed = checks.filter((entry) => !entry.ok)
  for (const entry of checks) {
    console.log(
      `${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail && !entry.ok ? ` — ${entry.detail}` : ''}`,
    )
  }
  console.log(
    `\n${checks.length - failed.length}/${checks.length} checks passed`,
  )
  if (failed.length > 0) {
    console.error('\nwrangler dev output:\n' + log.join(''))
    process.exitCode = 1
  }
}

await main()
