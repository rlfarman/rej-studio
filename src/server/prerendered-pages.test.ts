// @vitest-environment node
import { describe, expect, it } from 'vite-plus/test'

import {
  isPrerenderedPage,
  needsShell,
  prerenderJobPath,
  prerenderedFile,
} from './prerendered-pages'

/** What the Worker asks of this module for a navigation (worker-entry.ts). */
const decide = (href: string) => {
  const url = new URL(href, 'https://rej.example.com')
  return needsShell(url.pathname, url.search) ? 'shell' : 'file'
}

describe('needsShell', () => {
  it('serves a prerendered page by its own file', () => {
    expect(decide('/')).toBe('file')
    expect(decide('/design-tool')).toBe('file')
    expect(decide('/architecture')).toBe('file')
    expect(decide('/login')).toBe('file')
  })

  it('serves the shell for a prerendered page whose query changes it', () => {
    expect(decide('/design-tool?job=abc')).toBe('shell')
    expect(decide('/design-tool?isoform=ENST00000269305')).toBe('shell')
    // SPA mode owns `/`, so the build fetches the home page as `/?prerender`
    // and Start renders it; the deployed Worker answers it with the shell.
    expect(decide('/?prerender')).toBe('shell')
  })

  it('serves the login page for every /login URL', () => {
    // The page reads these only after hydration (src/routes/login.tsx), so
    // the HTML is the same whatever they say — which is what lets a visitor
    // without JavaScript see the form after a refused passcode.
    expect(decide('/login?error=passcode')).toBe('file')
    expect(decide('/login?error=limit&return_to=%2Fgenes%2FTP53')).toBe('file')
    expect(decide('/login?return_to=%2Fgenes%2FTP53')).toBe('file')
    expect(decide('/login?')).toBe('file')
  })

  it('looks for a file first for anything not prerendered', () => {
    // A page route falls through to the shell when no file matches, and a
    // static file is served as itself.
    expect(decide('/genes/TP53')).toBe('file')
    expect(decide('/genes?q=53')).toBe('file')
    expect(decide('/favicon.svg')).toBe('file')
  })
})

describe('the prerender build', () => {
  it('names a file per page and a job path per page', () => {
    expect(isPrerenderedPage('/login')).toBe(true)
    expect(isPrerenderedPage('/genes')).toBe(false)
    expect(prerenderedFile('/')).toBe('/index.html')
    expect(prerenderedFile('/login')).toBe('/login.html')
    expect(prerenderJobPath('/')).toBe('/?prerender')
    expect(prerenderJobPath('/login')).toBe('/login')
  })
})
