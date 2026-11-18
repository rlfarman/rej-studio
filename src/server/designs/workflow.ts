import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers'
import { NonRetryableError } from 'cloudflare:workflows'

import {
  CloudDesignFailure,
  runCloudDesign,
  type CloudDesignOutput,
  type CloudDesignParams,
} from './run'

/**
 * A cloud design: one step that runs the optimizer's WebAssembly, the same
 * module the tab runs, through the same ABI (./run.ts). Exported from the
 * Worker's entry (src/server/worker-entry.ts) beside Start's handler and bound
 * as DESIGN_WORKFLOW in wrangler.jsonc.
 *
 * The step's CPU budget is the Worker's `limits.cpu_ms` (300,000 ms, the Paid
 * plan's maximum): Workflow steps take no CPU setting of their own; each step
 * invocation gets the Worker's limit.
 *
 * **No step retries.** The optimizer is deterministic, so a design that failed
 * would fail again — and one killed by the CPU limit would spend another 5
 * minutes of CPU doing it. The step's one transient operation, writing a large
 * result to R2, retries inside the step. A failure the platform caused (an
 * evicted isolate, say) leaves the instance errored but retriable, and
 * resubmitting the same design restarts it (./service.ts, `resubmit`).
 */
export class DesignWorkflow extends WorkflowEntrypoint<Env, CloudDesignParams> {
  override async run(
    event: Readonly<WorkflowEvent<CloudDesignParams>>,
    step: WorkflowStep,
  ): Promise<CloudDesignOutput> {
    const output = await step.do(
      'design',
      {
        retries: { limit: 0, delay: '10 seconds' },
        // Wall time, not CPU: generous, since a busy isolate can take a while
        // to get through 5 minutes of CPU.
        timeout: '30 minutes',
      },
      // The step hands back JSON text: the output's type holds the result
      // schema's `Record<string, unknown>`s, which the RPC `Serializable` type
      // cannot see through, though every value in them is plain JSON. The
      // instance's output (what status() reports) is the parsed object.
      async (): Promise<string> => {
        try {
          return JSON.stringify(
            await runCloudDesign(event.instanceId, event.payload, this.env),
          )
        } catch (error) {
          if (error instanceof CloudDesignFailure) {
            // The code leads the message: it is what status() reports back.
            throw new NonRetryableError(`${error.code}: ${error.message}`)
          }
          throw error
        }
      },
    )
    return JSON.parse(output) as CloudDesignOutput
  }
}
