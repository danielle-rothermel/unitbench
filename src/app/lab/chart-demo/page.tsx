import { DemoScatter } from './DemoScatter'

export default function ChartDemoPage() {
  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <header className="mb-8">
        <h1 className="font-display text-[30px] leading-tight font-bold text-[var(--text-primary)]">
          Chart theme demo
        </h1>
        <p className="mt-1.5 max-w-[72ch] text-[15px] text-[var(--text-secondary)]">
          visx scatter styled entirely from the OKLCH tokens via
          `src/lib/chart-theme.ts`. Fixture data — correctness vs compression
          shaped like the stage-5 dashboard plot.
        </p>
      </header>
      <DemoScatter />
    </div>
  )
}
