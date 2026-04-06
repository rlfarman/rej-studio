import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = createLogger('csp')

/**
 * CSP violation reporting endpoint. Browsers POST a JSON payload here when a
 * Content-Security-Policy directive is violated. We log it as a structured
 * warning so it shows up in production logs (Vercel, stdout) without needing
 * a third-party reporting service.
 *
 * The report format follows the Reporting API v1 spec (report-to) and the
 * legacy report-uri format. We handle both.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Reporting API v1 sends an array of reports
    const reports = Array.isArray(body) ? body : [body]

    for (const report of reports) {
      // Legacy report-uri format nests under csp-report
      const violation = report['csp-report'] ?? report.body ?? report

      log.warn('csp violation', {
        blockedUri: violation['blocked-uri'] ?? violation.blockedURL,
        directive:
          violation['violated-directive'] ?? violation.effectiveDirective,
        documentUri: violation['document-uri'] ?? violation.documentURL,
        sourceFile: violation['source-file'] ?? violation.sourceFile,
        lineNumber: violation['line-number'] ?? violation.lineNumber,
        disposition: violation.disposition,
      })
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 400 })
  }
}
