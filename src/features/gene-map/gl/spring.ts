/**
 * Critical-damped-ish spring integrator. Call step() once per frame with a
 * target; it advances value toward target with the given stiffness/damping.
 * Settled = value close enough to target AND velocity near zero.
 */

export interface SpringConfig {
  stiffness: number
  damping: number
  mass: number
  precision: number
}

export const DEFAULT_SPRING: SpringConfig = {
  stiffness: 180,
  damping: 26,
  mass: 1,
  precision: 0.0005,
}

export class Spring {
  value: number
  velocity = 0
  target: number
  config: SpringConfig
  snap = false

  constructor(initial: number, config: SpringConfig = DEFAULT_SPRING) {
    this.value = initial
    this.target = initial
    this.config = config
  }

  setTarget(target: number) {
    this.target = target
  }

  jump(value: number) {
    this.value = value
    this.target = value
    this.velocity = 0
  }

  /** Advance by `dt` seconds. Returns true if still animating. */
  step(dt: number): boolean {
    if (this.snap) {
      this.value = this.target
      this.velocity = 0
      return false
    }
    const { stiffness, damping, mass, precision } = this.config
    // Clamp dt so a tab refocus doesn't explode the spring.
    const h = Math.min(dt, 1 / 30)
    const force = -stiffness * (this.value - this.target)
    const dampForce = -damping * this.velocity
    const accel = (force + dampForce) / mass
    this.velocity += accel * h
    this.value += this.velocity * h
    if (
      Math.abs(this.velocity) < precision &&
      Math.abs(this.value - this.target) < precision
    ) {
      this.value = this.target
      this.velocity = 0
      return false
    }
    return true
  }
}
