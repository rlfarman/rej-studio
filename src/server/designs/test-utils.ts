// Test doubles for the cloud-design tests: an in-memory Workflow binding
// that behaves as the local runtime does (ids are unique within retention,
// `get` of an unknown id throws `instance.not_found`, params are readable
// through a `workflow_started` subscription once the instance has started).

import type { FormValues } from '@/features/design-tool/types/form-schema'
import type { ProcessResult } from '@/features/design-tool/types/process-result'

import type { CloudDesignParams } from './run'

/** A short, valid coding sequence: ATG, 30 lysines, TAA. */
export const CDS = `ATG${'AAA'.repeat(30)}TAA`

export function formValues(overrides: Partial<FormValues> = {}): FormValues {
  return {
    selectedWggwSites: [null],
    sequenceType: 'dna',
    codingSequence: CDS,
    proteinSequence: '',
    name: 'Cloud test',
    species: 'human',
    codonOptimizeWeight: 1,
    removeCrypticSpliceSites: true,
    removeCrypticSpliceSitesWeight: 1,
    minimizeCpgs: true,
    minimizeCpgsWeight: 1,
    reduceKmerComplexity: true,
    reduceKmerComplexityWeight: 1,
    enforceGcContent: true,
    '5PrimeStimulatoryIntron': false,
    '3PrimeStimulatoryIntron': false,
    spliceJunctionPositions: [45],
    ...overrides,
  }
}

export const RESULT: ProcessResult = {
  name: 'Cloud test',
  original_sequence: CDS,
  optimized_sequence: CDS,
  seq5: CDS.slice(0, 45),
  seq3: CDS.slice(45),
  split_point: 45,
  used_wggw_as_split: false,
  objectives_before: '',
  objectives_after: '',
  objectives_report_before: { entries: [], total_score: null },
  objectives_report_after: { entries: [], total_score: null },
  wggw_info: null,
  processing_time_seconds: 0,
}

export class FakeInstance {
  restarts = 0
  deleted = false
  started = true
  snapshot: InstanceStatus = { status: 'queued' }

  constructor(
    readonly id: string,
    readonly params: CloudDesignParams,
    readonly retention: WorkflowInstanceCreateOptions['retention'],
  ) {}

  status = async (): Promise<InstanceStatus> => this.snapshot
  restart = async () => {
    this.restarts++
    this.snapshot = { status: 'queued' }
  }
  delete = async () => {
    this.deleted = true
  }
  subscribe = async () => {
    const event =
      this.started && this.snapshot.status !== 'queued'
        ? {
            done: false as const,
            value: {
              instanceId: this.id,
              eventId: 2,
              timestamp: Date.now(),
              type: 'workflow_started' as const,
              params: this.params,
            },
          }
        : null
    return {
      // A queued instance has no start event: the subscription never
      // delivers one, and the reader gives up.
      next: () => (event ? Promise.resolve(event) : new Promise(() => {})),
      [Symbol.dispose]: () => {},
    }
  }
}

export class FakeWorkflow {
  readonly instances = new Map<string, FakeInstance>()
  creates = 0
  /** Runs before every create; a test uses it to stage a race. */
  beforeCreate: ((id: string) => void) | null = null

  create = async ({
    id,
    params,
    retention,
  }: WorkflowInstanceCreateOptions<CloudDesignParams>) => {
    if (!id || !params) throw new Error('id and params are required')
    this.beforeCreate?.(id)
    if (this.instances.has(id)) {
      throw new Error(
        `WorkflowError: (instance.already_exists) Workflow instance with id "${id}" already exists`,
      )
    }
    this.creates++
    const instance = new FakeInstance(id, params, retention)
    this.instances.set(id, instance)
    return instance
  }

  get = async (id: string) => {
    const instance = this.instances.get(id)
    if (!instance || instance.deleted) throw new Error('instance.not_found')
    return instance
  }

  /** The env shape the service reads this binding from. */
  binding(): Workflow<CloudDesignParams> {
    return this as unknown as Workflow<CloudDesignParams>
  }
}

/** A Rate Limiting binding that allows `allowed` calls, then refuses. */
export function fakeLimiter(allowed = Infinity) {
  const keys: string[] = []
  return {
    keys,
    binding: {
      limit: async ({ key }: { key: string }) => {
        keys.push(key)
        return { success: keys.length <= allowed }
      },
    } as unknown as RateLimit,
  }
}

/** An R2 bucket holding JSON objects in memory. */
export function fakeBucket() {
  const objects = new Map<string, string>()
  return {
    objects,
    binding: {
      put: async (key: string, value: string) => {
        objects.set(key, value)
        return {}
      },
      get: async (key: string) => {
        const value = objects.get(key)
        return value === undefined
          ? null
          : { json: async () => JSON.parse(value) as unknown }
      },
      delete: async (key: string) => {
        objects.delete(key)
      },
    } as unknown as R2Bucket,
  }
}
