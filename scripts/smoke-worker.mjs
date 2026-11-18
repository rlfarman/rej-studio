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
// The cloud-design Workflow runs here too: submit_design hands a sequence
// over 12 kb to it, and the script polls it to completion. The design tool's
// own cloud designs (server functions) are covered end to end by
// e2e/cloud-design.spec.ts, in the browser, on dev and on this build.
// The passcode gate is on, as deployed: the script checks that it turns away
// signed-out requests, signs in through /api/login, and sends that session
// cookie with everything after. Accounts are on too, on a local D1 with the
// committed migrations applied: an emailed code (the send_email binding,
// simulated by wrangler) signs in, read back from the test mailbox.
//
// It lives here rather than in Vitest because @cloudflare/vitest-pool-workers
// supports Vitest 4 and this repo runs Vite+'s Vitest 5; the pool's proxy
// worker fails to start. See AGENTS.md ("Testing").

import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const worker = path.join(root, 'dist/server/wrangler.json')

/** A token long enough for the endpoint to accept (src/server/mcp/tokens.ts). */
const TOKEN = `smoke-agent:${'s'.repeat(32)}`
const SECRET = 's'.repeat(32)
const HEALTH_TOKEN = 'h'.repeat(40)
const PASSCODE = 'smoke-passcode'
const SESSION_SECRET = 'x'.repeat(40)
const ACCOUNTS_SECRET = 'a'.repeat(40)

/** The session cookie from signing in; sent with every request once set. */
let session = ''

/**
 * fetch with a deadline. A request that workerd accepts but never answers
 * would otherwise hang the script, and with it the CI job, indefinitely.
 */
function request(url, init = {}, ms = 60_000) {
  const headers = new Headers(init.headers)
  if (session && !headers.has('cookie')) headers.set('cookie', session)
  return fetch(url, { ...init, headers, signal: AbortSignal.timeout(ms) })
}

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
      // Public, so it answers before anyone has signed in.
      const response = await request(`${url}/api/health`, {}, 2_000)
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
  const response = await request(`${url}/api/mcp`, {
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

/** Ends wrangler and everything it started (workerd), however it responds. */
function stop(child) {
  const group = (signal) => {
    try {
      process.kill(-child.pid, signal)
    } catch {
      // Already gone.
    }
  }
  group('SIGTERM')
  setTimeout(() => group('SIGKILL'), 5_000).unref()
  child.stdout.destroy()
  child.stderr.destroy()
}

const textOf = (result) =>
  (result.content ?? []).map((block) => block.text ?? '').join('\n')

/** Polls until `read` returns something `done` accepts, or gives up. */
async function pollUntil(read, done, ms = 180_000) {
  const deadline = Date.now() + ms
  let last
  while (Date.now() < deadline) {
    last = await read()
    if (done(last)) return last
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`timed out polling: ${JSON.stringify(last).slice(0, 300)}`)
}

async function passcodeGate(url) {
  const page = await request(`${url}/genes/TP53`, { redirect: 'manual' })
  check(
    'a signed-out page load is sent to the login page',
    page.status === 302 &&
      page.headers.get('location') === `${url}/login?return_to=%2Fgenes%2FTP53`,
    `HTTP ${page.status} ${page.headers.get('location')}`,
  )
  const api = await request(`${url}/api/version`)
  check('a signed-out API call is refused with 401', api.status === 401)
  // A server-function read is a GET; it must not be taken for a page load.
  const fn = await request(`${url}/_serverFn/any`, { redirect: 'manual' })
  const fnBody = await fn.json().catch(() => null)
  check(
    'a signed-out server-function call gets a 401 refusal, not a redirect',
    fn.status === 401 && fnBody?.reason === 'unauthorized',
    `HTTP ${fn.status}`,
  )
  const login = await request(`${url}/login`)
  check(
    'the login page is served to anyone',
    login.status === 200 &&
      (login.headers.get('content-type') ?? '').includes('text/html'),
  )
  const asset = await request(`${url}/optimizer/THIRD-PARTY-NOTICES.md`)
  check('static files load without a session', asset.status === 200)
  const wasm = await request(`${url}/optimizer/rej-optimizer.wasm?v=smoke`)
  check(
    'the optimizer .wasm is cached as immutable (its URL is versioned)',
    wasm.status === 200 &&
      (wasm.headers.get('cache-control') ?? '').includes('immutable'),
    wasm.headers.get('cache-control') ?? '',
  )
  // BRCA1's disease associations: the one shard the build emitted under a
  // content-named directory (associationShards in vite.config.ts).
  const [shardDir] = readdirSync(
    path.join(root, 'dist/client/assets/disease-associations'),
  )
  const shard = await request(
    `${url}/assets/disease-associations/${shardDir}/br.json`,
  )
  const shardBody = shard.ok ? await shard.json() : null
  check(
    'a disease-associations shard loads without a session, cached as immutable',
    shard.status === 200 &&
      (shard.headers.get('cache-control') ?? '').includes('immutable') &&
      shardBody?.rows?.some((row) => row.symbol === 'BRCA1'),
    `HTTP ${shard.status} ${shard.headers.get('cache-control') ?? ''}`,
  )

  const signIn = (password) =>
    request(`${url}/api/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: url,
      },
      body: new URLSearchParams({ password, return_to: '/design-tool' }),
    })
  const wrong = await signIn('not-the-passcode')
  check(
    'a wrong passcode goes back to the form, with no cookie',
    wrong.status === 303 &&
      wrong.headers.get('location')?.includes('error=passcode') &&
      !wrong.headers.get('set-cookie'),
    `HTTP ${wrong.status} ${wrong.headers.get('location')}`,
  )
  const right = await signIn(PASSCODE)
  session = (right.headers.get('set-cookie') ?? '').split(';')[0]
  check(
    'the passcode signs in and returns to the page asked for',
    right.status === 303 &&
      right.headers.get('location') === `${url}/design-tool` &&
      session.startsWith('rej_session='),
    `HTTP ${right.status} ${right.headers.get('location')}`,
  )
  const heading = async (path) => {
    const html = await (await request(`${url}${path}`)).text()
    return /<h1[^>]*>([^<]*)/.exec(html)?.[1] ?? ''
  }
  check(
    'a prerendered page arrives with its content',
    (await heading('/design-tool')) === 'Design a sequence',
  )
  check(
    'the same page with a query string gets the shell',
    (await heading('/design-tool?isoform=ENST00000269305')) === '',
  )
  check(
    'a route that is not prerendered gets the shell',
    (await heading('/genes/TP53')) === '',
  )
  const signedIn = await request(`${url}/genes/TP53`, { redirect: 'manual' })
  check(
    'a signed-in page load gets the app',
    signedIn.status === 200 &&
      (signedIn.headers.get('content-type') ?? '').includes('text/html'),
    `HTTP ${signedIn.status}`,
  )
}

/**
 * A coding sequence of `codons` sense codons between ATG and TAA, from a
 * fixed pseudo-random stream: varied enough for the optimizer to have real
 * work, identical every run.
 */
function syntheticCds(codons) {
  const sense = []
  for (const a of 'ACGT')
    for (const b of 'ACGT')
      for (const c of 'ACGT') {
        const codon = a + b + c
        if (!['TAA', 'TAG', 'TGA'].includes(codon)) sense.push(codon)
      }
  let state = 12345
  let cds = 'ATG'
  for (let i = 0; i < codons; i++) {
    state = (state * 1103515245 + 12345) % 2 ** 31
    cds += sense[state % sense.length]
  }
  return `${cds}TAA`
}

/**
 * The design the browser's optimizer makes for a request: the committed
 * .wasm, instantiated by Node through the app's own ABI glue
 * (wasm-harness.mjs).
 */
async function designInNode(request) {
  const { loadModule } = await import('./wasm-harness.mjs')
  const { design } = await loadModule(
    path.join(root, 'public/optimizer/rej-optimizer.wasm'),
  )
  return design(request)
}

const HAND_OFF_SEED = 4321

/**
 * The optimizer request the MCP endpoint builds for a DNA `submit_design`
 * input: the endpoint's own input mapping and the form's request builder,
 * loaded through tsx (which resolves the `@/` paths).
 */
async function mcpRequestFor(input) {
  const { tsImport } = await import('tsx/esm/api')
  const { toFormValues } = await tsImport(
    '../src/server/mcp/design-input.ts',
    import.meta.url,
  )
  const { buildJobParams } = await tsImport(
    '../src/features/design-tool/utils/form-handler.ts',
    import.meta.url,
  )
  const values = await toFormValues(input, () => {
    throw new Error('DNA input only: nothing to reverse-translate')
  })
  const request = buildJobParams(values)
  return { ...request, options: { ...request.options, seed: input.seed } }
}

async function mcpHandOff(url) {
  // Just over the 12 kb inline limit: the shortest design that is handed off.
  const sequence = syntheticCds(4_050)
  const input = {
    name: 'long smoke',
    sequence,
    species: 'human',
    seed: HAND_OFF_SEED,
  }
  const handed = await callTool(url, 'submit_design', input)
  const jobId = handed.structuredContent?.job_id
  check(
    'submit_design hands a sequence over 12 kb to the cloud and returns a job id',
    !handed.isError &&
      /^[0-9a-f]{64}$/.test(jobId ?? '') &&
      ['queued', 'running'].includes(handed.structuredContent?.status) &&
      handed.structuredContent?.estimated_seconds > 0,
    textOf(handed),
  )
  if (!jobId) return null

  const started = Date.now()
  const done = await pollUntil(
    () => callTool(url, 'get_design', { job_id: jobId }),
    (result) =>
      result.isError ||
      ['completed', 'failed'].includes(result.structuredContent?.status),
  )
  console.log(
    `[smoke] ${sequence.length} bp hand-off finished ${((Date.now() - started) / 1000).toFixed(1)} s after submit_design returned`,
  )
  check(
    'get_design returns the handed-off design when it is done',
    !done.isError &&
      done.structuredContent?.status === 'completed' &&
      done.structuredContent?.result?.optimized_sequence?.length ===
        sequence.length,
    textOf(done),
  )

  // Compared with the browser's design after the HTTP checks: running a
  // 12 kb design in Node blocks its event loop for seconds, long enough for
  // the server to drop the next request's keep-alive connection.
  return { input, cloud: done.structuredContent?.result }
}

/**
 * The Workflow ran the same optimizer the browser runs: the committed .wasm
 * in Node, given the request the endpoint built, makes the same design.
 */
async function compareWithBrowser({ input, cloud }) {
  const local = await designInNode(await mcpRequestFor(input))
  const same = ['optimized_sequence', 'seq5', 'seq3', 'split_point', 'seed']
  const differing = same.filter(
    (key) => JSON.stringify(local[key]) !== JSON.stringify(cloud?.[key]),
  )
  check(
    'the cloud design is the design the browser makes (same .wasm, same seed)',
    cloud?.seed === HAND_OFF_SEED && differing.length === 0,
    `seed ${cloud?.seed}; differing: ${differing.join(', ')}`,
  )
}

/** The `name=value` pairs a response sets, as a Cookie header. */
function cookiesOf(response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

/**
 * Accounts on the real runtime: Better Auth on D1 (the local database, with
 * migrations/ applied), the code sent through the send_email binding
 * (wrangler simulates it locally and logs the message), the session it
 * gives, and both ways out.
 */
async function accounts(url, log) {
  const json = { 'content-type': 'application/json', origin: url }
  const signedOut = await request(`${url}/api/account`, {
    headers: { cookie: '' },
  })
  check(
    'account state needs the passcode like every other API call',
    signedOut.status === 401,
    `HTTP ${signedOut.status}`,
  )
  const before = await (await request(`${url}/api/account`)).json()
  check(
    'accounts are on, with nobody signed in yet',
    before.available === true && before.user === null,
    JSON.stringify(before),
  )

  const email = `smoke-${Date.now()}@example.com`
  const sent = await request(
    `${url}/api/auth/email-otp/send-verification-otp`,
    {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, type: 'sign-in' }),
    },
  )
  check(
    'a sign-in code is requested',
    sent.status === 200,
    `HTTP ${sent.status}`,
  )
  const code = await pollUntil(
    async () => {
      const response = await request(
        `${url}/api/dev/sign-in-code?email=${encodeURIComponent(email)}`,
      )
      return response.ok ? (await response.json()).code : null
    },
    (value) => typeof value === 'string',
    10_000,
  )
  // The binding's own log line can land after the mailbox read above, so
  // wait for it rather than reading the log once.
  const sentLine = await pollUntil(
    () => log.join(''),
    (text) =>
      text.includes(`To: ${email}`) && text.includes('sign-in@rejstudio.com'),
    10_000,
  ).catch(() => '')
  check(
    'the code goes out through the send_email binding, from rejstudio.com',
    sentLine.includes(`To: ${email}`),
  )
  const crossSite = await request(`${url}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { ...json, origin: 'https://elsewhere.example' },
    body: JSON.stringify({ email, otp: code }),
  })
  check(
    'a cross-site sign-in is refused',
    crossSite.status === 403,
    `HTTP ${crossSite.status}`,
  )
  const wrong = await request(`${url}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({
      email,
      otp: code === '000000' ? '111111' : '000000',
    }),
  })
  check(
    'a wrong code signs nobody in',
    !wrong.ok && wrong.headers.getSetCookie().length === 0,
    `HTTP ${wrong.status}`,
  )
  const signedIn = await request(`${url}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email, otp: code }),
  })
  const account = cookiesOf(signedIn)
  check(
    'the emailed code signs in and sets the account cookie',
    signedIn.ok && account.includes('rej-account.session_token='),
    `HTTP ${signedIn.status}`,
  )
  const withAccount = { cookie: `${session}; ${account}` }
  const after = await (
    await request(`${url}/api/account`, { headers: withAccount })
  ).json()
  check(
    'the account is signed in, from the D1 session',
    after.user?.email === email,
    JSON.stringify(after),
  )
  const out = await request(`${url}/api/auth/sign-out`, {
    method: 'POST',
    headers: { ...json, ...withAccount },
    body: '{}',
  })
  const gone = await (
    await request(`${url}/api/account`, { headers: withAccount })
  ).json()
  check(
    'signing out ends the account session',
    out.ok && gone.user === null,
    JSON.stringify(gone),
  )
  // Leaving the lab (the passcode's sign-out) clears the account cookie too.
  // The passcode cookie is stateless, so the script's own stays usable.
  const logout = await request(`${url}/api/logout`, {
    method: 'POST',
    redirect: 'manual',
    headers: { origin: url },
  })
  check(
    'the passcode sign-out clears the account cookie too',
    logout.headers
      .getSetCookie()
      .some((cookie) => cookie.startsWith('rej-account.session_token=;')),
  )
}

async function main() {
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  // Local state (Workflow instances, rate-limit counters) in a directory of
  // its own: wrangler's default, .wrangler/state, outlives the run, and a
  // design left from the last run would turn "submitted" into "already
  // done".
  const state = mkdtempSync(path.join(tmpdir(), 'rej-smoke-'))

  // The accounts database's schema, into the same local state.
  const migrate = spawnSync(
    path.join(root, 'node_modules/.bin/wrangler'),
    [
      'd1',
      'migrations',
      'apply',
      'AUTH_DB',
      '--local',
      '--config',
      worker,
      '--persist-to',
      state,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
    },
  )
  if (migrate.status !== 0) {
    throw new Error(`D1 migrations failed:\n${migrate.stdout}${migrate.stderr}`)
  }

  // The wrangler binary itself, not `npx wrangler`, and in its own process
  // group: wrangler starts workerd as a child, and killing only the parent
  // leaves workerd holding our stdout/stderr pipes open, so Node never exits.
  const child = spawn(
    path.join(root, 'node_modules/.bin/wrangler'),
    [
      'dev',
      '--config',
      worker,
      '--port',
      String(port),
      '--ip',
      '127.0.0.1',
      '--local',
      '--persist-to',
      state,
      '--var',
      `MCP_TOKENS:${TOKEN}`,
      '--var',
      `HEALTH_AUTH_TOKEN:${HEALTH_TOKEN}`,
      '--var',
      `BASIC_AUTH_PASSWORD:${PASSCODE}`,
      '--var',
      `SESSION_SECRET:${SESSION_SECRET}`,
      // Sentry off: wrangler.jsonc carries the production DSN as a plain
      // var, and a smoke run must not report into the real project.
      '--var',
      'SENTRY_DSN:',
      '--var',
      `BETTER_AUTH_SECRET:${ACCOUNTS_SECRET}`,
      // The test mailbox, so the script can read the emailed code back.
      '--var',
      'AUTH_DEV_MAILBOX:true',
    ],
    {
      cwd: root,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    },
  )
  const log = []
  child.stdout.on('data', (chunk) => log.push(String(chunk)))
  child.stderr.on('data', (chunk) => log.push(String(chunk)))

  try {
    await waitForReady(url, child)

    // --- the passcode gate --------------------------------------------------
    await passcodeGate(url)

    // --- accounts ------------------------------------------------------------
    await accounts(url, log)

    // --- version -----------------------------------------------------------
    const version = await (await request(`${url}/api/version`)).json()
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
    const liveness = await request(`${url}/api/health`)
    check(
      'health answers an anonymous probe with liveness only',
      liveness.status === 200 &&
        JSON.stringify(await liveness.json()) === '{"status":"ok"}',
    )
    const deep = await request(`${url}/api/health`, {
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
      await request(`${url}/gene-data/sample/genes/ENSG00000141510.json`)
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
    // Over the cloud cap: nothing here runs it, and the refusal keeps the
    // agent in its conversation rather than sending it to a page.
    const tooLong = await callTool(url, 'submit_design', {
      name: 'too long',
      sequence: `ATG${'AAA'.repeat(15_000)}TAA`,
    })
    check(
      'the length guard refuses a sequence over the cloud cap',
      tooLong.isError === true &&
        /45,000/.test(textOf(tooLong)) &&
        !/web app/.test(textOf(tooLong)),
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
      'get_design answers an unknown id with where ids come from',
      stale.isError === true && /submit_design/.test(textOf(stale)),
      textOf(stale),
    )

    const handedOff = await mcpHandOff(url)

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
    const bridge = await request(`${url}/mcp/app-bridge.js`)
    check(
      'the view’s client library is a static asset of this build',
      bridge.ok && (await bridge.text()).length > 1000,
      `HTTP ${bridge.status}`,
    )

    // Last: CPU-bound in Node (see mcpHandOff).
    if (handedOff) await compareWithBrowser(handedOff)
  } catch (error) {
    // A hang or crash says more with wrangler's own output beside it.
    console.error('wrangler dev output:\n' + log.join(''))
    throw error
  } finally {
    stop(child)
    // After workerd has had a moment to go (stop() signals its group): it
    // holds the files. A failure to remove a temp directory fails nothing.
    await new Promise((resolve) => setTimeout(resolve, 500))
    rmSync(state, { recursive: true, force: true, maxRetries: 3 })
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

try {
  await main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
// Nothing should be left running, but never let a stray handle keep CI
// waiting: the result is already decided.
process.exit()
