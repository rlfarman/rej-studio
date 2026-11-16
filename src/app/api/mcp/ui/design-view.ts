/**
 * The view a finished design gets inside a chat host.
 *
 * A design result is a thousand bases of sequence, thirty objectives and a
 * split point. As text in a conversation that is a wall; as a small view it
 * is a glance. The view shows the same facts the results panel shows first:
 * what the design did, where it was split, and which objectives changed.
 *
 * It is one self-contained HTML document, because that is what the protocol
 * delivers. It loads one script, the MCP Apps client, from this deployment —
 * the only origin named in the view's content security policy. Everything
 * else is inline.
 *
 * Nothing is computed here that the result does not contain, and nothing is
 * fetched: the host hands the tool's result to the view, and the view renders
 * it. A host that does not support views shows the structured result instead,
 * which is why `get_design` always returns one.
 */

/** Written against the app's own tokens so the view does not look foreign. */
const STYLES = `
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --fg: #0a0a0a;
    --muted: #6b7280;
    --line: #e5e7eb;
    --good: #15803d;
    --bad: #b91c1c;
    --accent: #1d4ed8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0b0b0c;
      --fg: #fafafa;
      --muted: #9ca3af;
      --line: #27272a;
      --good: #4ade80;
      --bad: #f87171;
      --accent: #93c5fd;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 16px;
    background: var(--bg);
    color: var(--fg);
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  h1 { margin: 0 0 2px; font-size: 15px; font-weight: 600; }
  .sub { margin: 0 0 14px; color: var(--muted); font-size: 13px; }
  .metrics { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 14px; }
  .metric .label { color: var(--muted); font-size: 12px; }
  .metric .value { font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .split { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
  .split span:first-child { background: var(--accent); }
  .split span:last-child { background: var(--muted); opacity: 0.45; }
  .split-labels { display: flex; justify-content: space-between; color: var(--muted); font-size: 12px; margin-bottom: 16px; }
  h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  caption { text-align: left; color: var(--muted); font-size: 12px; padding-bottom: 6px; }
  th, td { text-align: left; padding: 5px 8px 5px 0; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 500; }
  td.state { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .pass { color: var(--good); }
  .fail { color: var(--bad); }
  .seq {
    font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-all;
    background: color-mix(in srgb, var(--fg) 4%, transparent);
    border-radius: 6px;
    padding: 8px;
    max-height: 120px;
    overflow: auto;
  }
  .empty { color: var(--muted); }
`

/**
 * Runs inside the sandboxed view. Receives the tool result from the host and
 * renders it; renders nothing at all until one arrives, rather than guessing
 * at a shape.
 */
const SCRIPT = `
  import { App } from "__BRIDGE__";

  const $ = (id) => document.getElementById(id);
  const n = (value) => Number(value ?? 0).toLocaleString();

  function objectives(before, after) {
    // Pair the two reports by objective name, and show only what changed or
    // is still failing. Everything that passed before and after is noise.
    const was = new Map((before?.entries ?? []).map((e) => [e.objective, e]));
    const rows = [];
    for (const entry of after?.entries ?? []) {
      const previous = was.get(entry.objective);
      const changed = !previous || previous.passes !== entry.passes;
      if (changed || !entry.passes) {
        rows.push({
          name: entry.objective,
          before: previous ? previous.passes : null,
          after: entry.passes,
          message: entry.message ?? "",
        });
      }
    }
    return rows;
  }

  function render(result) {
    if (!result) return;

    $("name").textContent = result.name || "Design";
    const total = (result.original_sequence ?? "").length;
    const five = (result.seq5 ?? "").length;
    const three = (result.seq3 ?? "").length;
    $("summary").textContent =
      n(total) + " nt optimized and split" +
      (result.used_wggw_as_split ? " at a WGGW motif" : "") + ".";

    $("m-length").textContent = n(total) + " nt";
    $("m-split").textContent = n(result.split_point);
    $("m-time").textContent =
      result.processing_time_seconds != null
        ? result.processing_time_seconds + " s"
        : "\\u2014";

    const span = five + three || 1;
    $("bar-5").style.width = ((five / span) * 100).toFixed(1) + "%";
    $("bar-3").style.width = ((three / span) * 100).toFixed(1) + "%";
    $("label-5").textContent = "5\\u2032 " + n(five) + " nt";
    $("label-3").textContent = n(three) + " nt 3\\u2032";

    const rows = objectives(
      result.objectives_report_before,
      result.objectives_report_after,
    );
    const body = $("objectives-body");
    body.replaceChildren();
    if (rows.length === 0) {
      $("objectives-wrap").hidden = true;
    } else {
      for (const row of rows) {
        const tr = document.createElement("tr");
        const name = document.createElement("td");
        name.textContent = row.name;
        const state = document.createElement("td");
        state.className = "state " + (row.after ? "pass" : "fail");
        const from = row.before === null ? "new" : row.before ? "passed" : "failed";
        state.textContent = from + " \\u2192 " + (row.after ? "passed" : "failed");
        tr.append(name, state);
        body.append(tr);
      }
    }

    const sequence = result.optimized_sequence ?? "";
    $("sequence").textContent = sequence || "No optimized sequence in this result.";
    $("sequence").classList.toggle("empty", sequence.length === 0);
  }

  /**
   * A design with no result yet: still running, failed, or a job the backend
   * could not be asked about. The view is attached to every get_design call,
   * not only the ones that finished, so it has to say which — leaving
   * "Waiting for the result…" under text that says the design failed is the
   * one thing it must not do.
   */
  function renderWithoutResult(payload) {
    const status = payload?.status;
    const stage = payload?.stage;
    const error = payload?.error?.message;
    const job = payload?.job_id ? "Design " + payload.job_id : "Design";

    $("name").textContent = job;
    if (status === "failed" || (error && status !== "running")) {
      $("summary").textContent = error
        ? "This design did not finish: " + error
        : "This design did not finish.";
    } else if (status) {
      $("summary").textContent =
        "Still " + status + (stage ? " \\u2014 " + stage : "") +
        ". Nothing to show until it finishes.";
    } else {
      $("summary").textContent = "No design to show.";
    }

    // Hide the parts that would otherwise sit at their placeholder dashes and
    // read as measurements of something.
    $("objectives-wrap").hidden = true;
    $("sequence").textContent = "No sequence yet.";
    $("sequence").classList.add("empty");
  }

  const app = new App({ name: "REJ Studio design", version: "1.0.0" });
  app.ontoolresult = (toolResult) => {
    // The structured result is what the tool returns; the text beside it is
    // the same thing said in a sentence, for a host that shows only text.
    const payload = toolResult?.structuredContent;
    if (payload?.result) {
      render(payload.result);
    } else {
      renderWithoutResult(payload);
    }
  };
  app.connect();
`

const BODY = `
  <h1 id="name">Design</h1>
  <p class="sub" id="summary">Waiting for the result…</p>

  <div class="metrics">
    <div class="metric"><div class="label">Coding sequence</div><div class="value" id="m-length">—</div></div>
    <div class="metric"><div class="label">Split after base</div><div class="value" id="m-split">—</div></div>
    <div class="metric"><div class="label">Took</div><div class="value" id="m-time">—</div></div>
  </div>

  <div class="split" role="img" aria-label="The 5-prime and 3-prime fragments, to scale">
    <span id="bar-5"></span><span id="bar-3"></span>
  </div>
  <div class="split-labels"><span id="label-5"></span><span id="label-3"></span></div>

  <div id="objectives-wrap">
    <h2>Objectives that changed or still fail</h2>
    <table>
      <caption>Each objective that changed state, or is still failing</caption>
      <thead><tr><th>Objective</th><th>Before → after</th></tr></thead>
      <tbody id="objectives-body"></tbody>
    </table>
  </div>

  <h2 style="margin-top:16px">Optimized sequence</h2>
  <div class="seq" id="sequence"></div>
`

/**
 * The view as one HTML document.
 *
 * @param bridgeUrl Where the view loads the MCP Apps client from. The same
 *   origin must be named in the resource's `_meta.ui.csp.resourceDomains`,
 *   or the host's policy will block it.
 */
export function designViewHtml(bridgeUrl: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>REJ Studio design</title>
<style>${STYLES}</style>
</head>
<body>
${BODY}
<script type="module">${SCRIPT.replace('__BRIDGE__', bridgeUrl)}</script>
</body>
</html>`
}
