import type { Metadata } from 'next'
import { DEMO_TRACES, GALLERY_TRACES } from '@/components/pipeline-flow/demo-traces'
import { PipelineFlow } from '@/components/pipeline-flow/PipelineFlow'
import { SECTION_LABEL } from '@/components/primitives'

export const metadata: Metadata = {
  title: 'Pipeline flow · dev demo',
}

export default function PipelineFlowDevPage() {
  return (
    <div className="flex w-full flex-col gap-10">
      <header className="max-w-[1280px]">
        <h1 className="font-display text-[22px] leading-tight font-semibold text-[var(--text-primary)]">
          Pipeline flow
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          Per-stage trace visualizer (REL-5) rendered against deterministic fake
          data from <span className="font-mono">makePipelineTrace</span>. Dev
          demo only — not wired to real predictions yet.
        </p>
      </header>

      {DEMO_TRACES.map(demo => (
        <section key={demo.id} className="flex max-w-[1280px] flex-col gap-2.5">
          <span className={SECTION_LABEL}>{demo.title}</span>
          <p className="text-[13px] text-[var(--text-secondary)]">
            {demo.description}
          </p>
          <PipelineFlow trace={demo.trace} />
        </section>
      ))}

      <section className="flex max-w-[1280px] flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className={SECTION_LABEL}>Sample gallery</span>
          <p className="text-[13px] text-[var(--text-secondary)]">
            A few more seeds, models, and layouts to show generator variance.
          </p>
        </div>
        {GALLERY_TRACES.map(trace => (
          <PipelineFlow key={trace.identity.prediction_id} trace={trace} />
        ))}
      </section>
    </div>
  )
}
