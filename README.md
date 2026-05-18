# JS Self-Profiling: Safe Markers in Non-Isolated Contexts

Demo for the Chromium change **[\[JS Self-Profiling\] Allow safe markers in non-isolated contexts](https://chromium-review.googlesource.com/c/chromium/src/+/6012522)**.

## What changed

The JS Self-Profiling API's `ProfilerSample.marker` field was previously gated behind Cross-Origin Isolation (COI) via an IDL attribute, meaning **no markers were available** unless the page opted into COOP + COEP headers. In practice, very few production sites can deploy COI, so markers were unusable for most real-world performance monitoring.

This CL moves marker filtering from the IDL layer to **runtime** inside `ProfilerTraceBuilder`. Now, `layout` and `style` markers are available in all contexts (their timing is already observable via existing DOM/CSSOM APIs like `getBoundingClientRect()` and `getComputedStyle()`), while security-sensitive markers (`gc`, `paint`, `script`) remain behind COI.

**The practical impact:** sites no longer need COOP/COEP headers to get useful profiling markers. `layout` and `style` markers work out of the box with just `Document-Policy: js-profiling`.

### Marker availability

| Context | `layout` | `style` | `gc` | `paint` | `script` |
|---------|----------|---------|------|---------|----------|
| Non-isolated (no COOP/COEP) | ✓ | ✓ | — | — | — |
| Cross-Origin Isolated | ✓ | ✓ | ✓ | ✓ | ✓ |

## Running the demo

### 1. Enable the feature flag

The `ExperimentalJSProfilerMarkers` flag must be enabled. Choose one option:

**Option A: Launch Edge Canary with a flag:**
```bash
msedge.exe --enable-features=ExperimentalJSProfilerMarkers
```

**Option B: Enable via browser settings:**

Navigate to `about://flags`, search for **Experimental Web Platform features**, and set it to **Enabled**. Relaunch the browser when prompted.

### 2. Start the test server

```bash
node test-server.cjs
```

This serves `test.html` at two routes with different headers:

| Route | Headers | COI status |
|-------|---------|------------|
| `http://localhost:8123/no-coi` | `Document-Policy: js-profiling` | Not isolated |
| `http://localhost:8123/coi` | `Document-Policy` + `COOP` + `COEP` | Cross-Origin Isolated |

### 3. Open both pages and click "Run Profiling Test"

- **`http://localhost:8123/no-coi`**: should show `layout` and `style` markers; `gc`, `paint`, `script` should be absent.
- **`http://localhost:8123/coi`**: should show all five marker types.

## Links

- **Chromium CL:** [chromium-review.googlesource.com/c/chromium/src/+/6012522](https://chromium-review.googlesource.com/c/chromium/src/+/6012522)
- **Spec PR:** [WICG/js-self-profiling#85](https://github.com/WICG/js-self-profiling/pull/85)
- **Edge Explainer:** [MSEdgeExplainers/ConditionalMarkersExposure](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/ConditionalMarkersExposure/explainer.md)
- **Security discussion:** [WICG/js-self-profiling#61](https://github.com/WICG/js-self-profiling/issues/61)
