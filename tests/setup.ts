import path from 'node:path'

// Point the app's DB module to the test database (created by global-setup.ts)
process.env.DATABASE_PATH = path.join(process.cwd(), 'data.test.db')
