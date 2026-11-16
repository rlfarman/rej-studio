// App-facing entry point for the database. The marker makes a build fail if
// any client bundle imports it. CLI scripts import ./client directly.
import 'server-only'

export { getDb } from './client'
