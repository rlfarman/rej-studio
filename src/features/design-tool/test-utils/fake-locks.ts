// A minimal in-memory Web Locks manager (exclusive locks, `ifAvailable`),
// installed on `navigator.locks` for tests. happy-dom has none.
type Callback = (lock: { name: string } | null) => unknown

export function installFakeLocks() {
  const held = new Set<string>()
  const request = async (
    name: string,
    optionsOrCallback: { ifAvailable?: boolean } | Callback,
    maybeCallback?: Callback,
  ) => {
    const callback = maybeCallback ?? (optionsOrCallback as Callback)
    const options = maybeCallback
      ? (optionsOrCallback as { ifAvailable?: boolean })
      : {}
    if (held.has(name)) {
      if (options.ifAvailable) return callback(null)
      throw new Error(`fake locks: ${name} is held and waiting isn't modelled`)
    }
    held.add(name)
    try {
      return await callback({ name })
    } finally {
      held.delete(name)
    }
  }
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request },
  })
  return {
    held,
    uninstall: () => {
      Reflect.deleteProperty(navigator, 'locks')
    },
  }
}
