# Planning Docs

How planning skills should create and consume versioned planning artifacts in this repo.

## Layout

Versioned efforts live under `docs/planning/<effort>/`:

```text
docs/planning/<effort>/
├── README.md
├── v0/
│   ├── plan.md
│   └── reviews/
│       ├── fable-prompt.md
│       ├── fable-findings.md
│       ├── codex-prompt.md
│       ├── codex-findings.md
│       └── unified-feedback.md
└── v1/
    ├── plan.md
    └── reviews/
```

The effort `README.md` is the index. It names the current version and status, links the tracker map, records the review scope for each version, and links each plan and unified feedback artifact.

## Version lifecycle

- **draft** — mutable plan under active investigation or grilling
- **in-review** — plan frozen while prompts and findings accumulate
- **reviewed** — unified feedback complete; version immutable
- **superseded** — a successor version exists; version immutable

Create a successor by copying the reviewed plan into the next version and applying accepted feedback there. Never edit an `in-review`, `reviewed`, or `superseded` plan.

## Artifact ownership

- **Issue tracker map and tickets:** live questions and detailed decision resolutions. A decision lives in one ticket; indexes only gist and link it.
- **Version packet:** immutable snapshot of one plan and the reviews that evaluated it.
- **`CONTEXT.md` and `docs/adr/`:** living canonical language and accepted architectural decisions. Link them; do not copy them into version packets.
- **Reports, prototypes, and handoffs:** temporary working artifacts. Capture their conclusions in a ticket, active draft plan, glossary, or ADR.

Review prompts must point at the exact versioned plan they evaluate and record the code revision/date used for factual claims.

## When no planning config exists

Do not invent an effort directory silently. If the task clearly belongs to a multi-session planning effort, ask whether to use the standard layout or run `/setup-matt-pocock-skills`. Otherwise continue with the tracker or artifacts the user supplied.
