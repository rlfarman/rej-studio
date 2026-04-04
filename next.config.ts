import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  outputFileTracingIncludes: {
    '/**': ['./data/rej-studio.db.gz'],
  },
}

export default nextConfig
