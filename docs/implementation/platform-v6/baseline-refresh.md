# Platform v6 refreshed baseline

The implementation stack is rooted on canonical Unitbench commit `b0b6556314778eaa08cd29f38196a5a824a4f548`. Its R1-R6 visualization patches are patch-equivalent to the reviewed branch and are not replayed.

The final two-plane matrices include:

| Surface | Plane | Final source |
| --- | --- | --- |
| Sweep dashboard | Analysis | `sweep_metrics`, `failure_metrics` |
| Bootstrap variance | Analysis | `predictions` |
| Headroom heatmap | Analysis | `predictions`, `sweep_metrics` |
| Compression summary | Analysis | stable summary projection |
| Extraction flow | Detail | one exact root-closed Detail bundle |
| Pipeline trace | Detail | one exact root-closed Detail bundle |
| Per-prediction compression evidence | Detail | one exact root-closed Detail bundle |

The six `/dev/*` galleries remain fixture-only and must render without either store. The real pages fail closed independently for missing Analysis and Detail configuration. Harness failure remains distinct from model-test failure, but the legacy Python publisher and its synthetic status encoding are not carried forward.
