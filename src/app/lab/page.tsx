import Link from 'next/link'
import { SECTION_LABEL } from '@/components/primitives'

const LAB_EXPERIMENTS = [
  {
    href: '/lab/chart-demo',
    title: 'Chart theme demo',
    description:
      'Token-mapped visx scatter — the chart theme every promoted chart will use.',
  },
]

export default function LabPage() {
  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <header className="mb-8">
        <h1 className="font-display text-[30px] leading-tight font-bold text-[var(--text-primary)]">
          Lab
        </h1>
        <p className="mt-1.5 max-w-[72ch] text-[15px] text-[var(--text-secondary)]">
          Disposable prototypes. Pages here are exempt from design polish and
          may be deleted without ceremony; nothing outside /lab imports from
          it.
        </p>
      </header>
      <span className={SECTION_LABEL}>Experiments</span>
      <ul className="mt-3 flex flex-col gap-3">
        {LAB_EXPERIMENTS.map(experiment => (
          <li key={experiment.href}>
            <Link
              href={experiment.href}
              className="block rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
            >
              <span className="block text-[15px] font-semibold text-[var(--text-primary)]">
                {experiment.title}
              </span>
              <span className="mt-0.5 block text-sm text-[var(--text-secondary)]">
                {experiment.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
