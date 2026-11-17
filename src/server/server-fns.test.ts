import { describe, expect, it } from 'vite-plus/test'

import { serverFnId } from './server-fns'

describe('serverFnId', () => {
  it('names a server function by its file and export', () => {
    expect(
      serverFnId(
        '/repo/src/features/design-tool/api/cloud-designs.functions.ts',
        'submitCloudDesignFn_createServerFn_handler',
      ),
    ).toBe('cloud-designs.submitCloudDesignFn')
    expect(serverFnId('cloud-designs.functions.ts', 'readCloudDesignFn')).toBe(
      'cloud-designs.readCloudDesignFn',
    )
  })
})
