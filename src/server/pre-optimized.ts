/**
 * `/api/pre-optimized/<transcript id>`: an isoform's pre-optimized sequence
 * package, a ZIP built offline and kept in a Backblaze B2 bucket.
 *
 * The page used to link the bucket directly. Cross-origin, the `download`
 * attribute is ignored and a missing file shows the bucket's raw XML error,
 * so the Worker passes the file through instead: same origin, an attachment
 * with the app's filename, and a status the page can act on.
 */

const UPSTREAM =
  'https://rej-seq-1.s3.us-west-004.backblazeb2.com/rej/v1.0/zips'
const PACKAGE_VERSION = 'v1.0'

/**
 * A transcript id as the corpus keys it and the page sends it: human `ENST…`
 * or mouse `ENSMUST…`, uppercase, unversioned. Checked before any upstream
 * URL is built, so the route can only ever fetch a file in the ZIP directory.
 */
const TRANSCRIPT_ID = /^(?:ENST|ENSMUST)\d{11}$/

/** The package's filename, as the bucket and the download both name it. */
function preOptimizedZipFilename(transcriptId: string) {
  return `${transcriptId}_${PACKAGE_VERSION}.zip`
}

const NO_STORE = { 'cache-control': 'no-store' }

function refuse(status: number, message: string) {
  return new Response(message, {
    status,
    headers: { ...NO_STORE, 'content-type': 'text/plain; charset=utf-8' },
  })
}

export async function handlePreOptimizedZip(
  transcriptId: string,
  fetchUpstream: typeof fetch = fetch,
): Promise<Response> {
  if (!TRANSCRIPT_ID.test(transcriptId)) {
    return refuse(400, 'Not an Ensembl transcript id.')
  }
  const filename = preOptimizedZipFilename(transcriptId)

  let upstream: Response
  try {
    upstream = await fetchUpstream(`${UPSTREAM}/${filename}`)
  } catch {
    return refuse(502, 'The package store could not be reached.')
  }
  // B2 answers a missing key with 404 (403 only for a private bucket, which
  // this is not), so 404 is the one "no such package" signal.
  if (upstream.status === 404) {
    await upstream.body?.cancel()
    return refuse(404, 'No pre-optimized package for this isoform.')
  }
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel()
    return refuse(502, 'The package store did not answer.')
  }

  const headers = new Headers({
    'content-type': 'application/zip',
    'content-disposition': `attachment; filename="${filename}"`,
    // The path carries the package version, so a file never changes in
    // place. Private: the route is behind the passcode gate, and a shared
    // cache must not hand it to someone who has not signed in.
    'cache-control': 'private, max-age=31536000, immutable',
  })
  const length = upstream.headers.get('content-length')
  if (length) headers.set('content-length', length)
  // The body is streamed through, never buffered in the Worker.
  return new Response(upstream.body, { status: 200, headers })
}
