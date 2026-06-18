# JS Self-Profiling: Safe Markers in Non-Isolated Contexts — Timeline Visualisation

> **Based on the original demo by [Victor Huang](https://github.com/victorhuangwq)** —
> see the upstream repo at [victorhuangwq/js-profiler-markers-demo](https://github.com/victorhuangwq/js-profiler-markers-demo)
> and his README for the full background on the Chromium change.

This fork extends Victor's functional marker test with an **interactive visual timeline** to make it easier to see exactly when and how often each marker type fires, and to inspect the call stack behind each sample.

---

## Screenshots

**Non-COI context** (`layout` + `style` explicit; inferred lanes show everything else):
![Timeline — non-COI context](docs/timeline-no-coi.png)

**COI context** (all five explicit marker types, plus inferred lanes):
![Timeline — COI context](docs/timeline-coi.png)

---

## What this fork adds

### Two-section timeline

After running the profiling test, every collected sample is plotted on a canvas timeline — one horizontal lane per category, left-to-right by timestamp. The timeline is split into two sections separated by a divider:

**Explicit markers** — lanes driven directly by `sample.marker` (set by the browser):

| Lane | Colour | When present |
|------|--------|--------------|
| `layout` | 🟢 green | always (COI and non-COI) |
| `style` | 🔵 blue | always |
| `gc` | 🔴 red | COI only |
| `paint` | 🟡 yellow | COI only |
| `script` | 🟣 dark purple | COI only |

**Inferred** — lanes for samples with no `marker` field:

| Lane | Colour | Meaning |
|------|--------|---------|
| `js (exec)` | 🟣 light purple | has a stack — JS was executing, `script` marker suppressed outside COI |
| `idle` | ⬛ blue-grey | no stack captured |

Explicit markers are drawn as **solid filled rects**; inferred lanes as **outlined rects** (lower opacity) to make the distinction immediately visible. The legend is **clickable** — toggle any lane on/off.

### Why inferred lanes exist

In the Chromium implementation ([`profiler_trace_builder.h`](https://chromium.googlesource.com/chromium/src/+/1f1f610cb6a035a830c85523e5e59e25446ed2bf/third_party/blink/renderer/bindings/core/v8/profiler_trace_builder.h)), `VMStateToMarker()` assigns markers based on V8's internal `StateTag`:

| V8 `StateTag` | `marker` value | What it means |
|---|---|---|
| `JS`, `ATOMICS_WAIT` | `script` | Ordinary JS execution |
| `GC` | `gc` | Garbage collection |
| `COMPILER`, `BYTECODE_COMPILER`, `PARSER` | *(none)* | JIT compilation / parsing — no JS frames captured, samples appear stackless or as `js (exec)` |
| `EXTERNAL` | *(none)* | Native/host callback called from JS (DOM API, Web API, etc.) |
| `IDLE` | *(none)* | Nothing executing |

Blink's embedder state layer adds `layout`, `style`, and `paint` on top of this via `BlinkStateToMarker()`.

In a **COI context** all of these markers are exposed as-is. Outside COI, `ProfileMarkerToPublicMarker()` strips everything except `layout` and `style` — so samples that would have been `marker: "script"` (i.e. `StateTag::JS`) arrive with no marker field at all. They still carry a `stackId` because stack capture happens independently of marker filtering.

The inferred lanes recover this information from the stack:

- **`js (exec)`** — no marker + has stack → JS was executing, `script` marker was suppressed by `ProfileMarkerToPublicMarker()` (non-COI context)
- **`idle`** — no marker + no stack → nothing executing at sample time

Note: the JS Self-Profiling API is a user-space profiler — it only captures JavaScript frames. V8 compiler/parser internals (`StateTag::COMPILER`, `BYTECODE_COMPILER`, etc.) are not visible in the stack; those states simply produce no frames in the trace.

### Hover tooltip

Hovering a sample dot shows:

- **Lane pill** (coloured) + **explicit / inferred badge**
- **Meta row**: timestamp · raw `marker` value · `stackId`
- **Reason callout** (inferred lanes only): explains which heuristic classified this sample and why
- **Call stack** resolved from the profiler trace's linked-list structure, displayed leaf-first with file/line/column. For `compile` and `native cb` lanes the leaf frame is annotated with `← drove lane classification`.
- **Source snippet**: the 5 lines of source around the leaf frame's line/column, with a `^` caret at the exact column. Fetched on demand and cached — only shown when the resource URL is same-origin fetchable.

### Stats bar

A summary row shows total sample count and a per-lane breakdown, updated on every run.

---

## What changed in Chromium (from Victor's work)

The JS Self-Profiling API's `ProfilerSample.marker` field was previously gated entirely behind Cross-Origin Isolation. This CL moves filtering to runtime — `layout` and `style` markers are now available in all contexts because their timing is already observable through existing APIs (`getBoundingClientRect`, `getComputedStyle`, etc.), while `gc`, `paint`, and `script` remain behind COI.

| Context | `layout` | `style` | `gc` | `paint` | `script` |
|---------|----------|---------|------|---------|----------|
| Non-isolated (no COOP/COEP) | ✓ | ✓ | — | — | — |
| Cross-Origin Isolated | ✓ | ✓ | ✓ | ✓ | ✓ |

> **Note on `paint`:** despite being defined in the spec and the Chromium CL, we have not been able to observe `paint` markers in practice — neither in this demo nor in Victor's original. The marker lane is kept in the timeline for completeness, but don't expect to see it fire.

---

## Running the demo

### 1. Start the server

```bash
node test-server.cjs
```

| Route | COI | Expected explicit markers |
|-------|-----|--------------------------|
| `http://localhost:8123/no-coi` | ✗ | `layout`, `style` |
| `http://localhost:8123/coi` | ✓ | `layout`, `style`, `gc`, `paint`, `script` |

### 2. Launch Chrome Canary with the required flags

```bash
/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary \
  --enable-features=ExperimentalJSProfilerMarkers \
  --enable-experimental-web-platform-features \
  http://localhost:8123/no-coi \
  http://localhost:8123/coi
```

### 3. Click "Run Profiling Test" on either page

The timeline appears below the button once profiling completes. Hover any dot to inspect its stack and source.

---

## Links

- **Original demo:** [victorhuangwq/js-profiler-markers-demo](https://github.com/victorhuangwq/js-profiler-markers-demo) by [Victor Huang](https://github.com/victorhuangwq)
- **Chromium CL:** [chromium-review.googlesource.com/c/chromium/src/+/6012522](https://chromium-review.googlesource.com/c/chromium/src/+/6012522)
- **Spec PR:** [WICG/js-self-profiling#85](https://github.com/WICG/js-self-profiling/pull/85)
- **Edge Explainer:** [MSEdgeExplainers/ConditionalMarkersExposure](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/ConditionalMarkersExposure/explainer.md)
- **Security discussion:** [WICG/js-self-profiling#61](https://github.com/WICG/js-self-profiling/issues/61)
