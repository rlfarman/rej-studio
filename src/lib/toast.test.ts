import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

const sonner = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  })
  return { toast }
})
vi.mock('sonner', () => sonner)

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('toast', () => {
  it('holds a toast until the container has mounted, then shows it', async () => {
    const { toast, isToasterWanted, toasterMounted } = await import('./toast')
    expect(isToasterWanted()).toBe(false)

    toast.error('Upload failed', { description: 'Too large' })
    expect(isToasterWanted()).toBe(true)
    await Promise.resolve()
    expect(sonner.toast.error).not.toHaveBeenCalled()

    toasterMounted()
    await vi.waitFor(() =>
      expect(sonner.toast.error).toHaveBeenCalledWith('Upload failed', {
        description: 'Too large',
      }),
    )
  })

  it('forwards every kind once loaded', async () => {
    const { toast, toasterMounted, loadToaster } = await import('./toast')
    const ready = loadToaster()
    toasterMounted()
    await ready
    toast('plain')
    toast.success('ok')
    toast.info('fyi')
    toast.warning('careful')
    await vi.waitFor(() => expect(sonner.toast.warning).toHaveBeenCalled())
    expect(sonner.toast).toHaveBeenCalledWith('plain')
    expect(sonner.toast.success).toHaveBeenCalledWith('ok')
    expect(sonner.toast.info).toHaveBeenCalledWith('fyi')
  })
})
