'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { cn } from '@/lib/cn'
import { TEST_EXPERIMENT_BLACKLIST } from '@/lib/test-experiment-filter'

type HideTestExperimentsToggleProps<T> = {
  hideTestExperiments: boolean
  buildHref: (next: T) => string
  applyToggle: (current: T, hide: boolean) => T
  current: T
  isPending?: boolean
}

export function HideTestExperimentsToggle<T>({
  hideTestExperiments,
  buildHref,
  applyToggle,
  current,
  isPending = false,
}: HideTestExperimentsToggleProps<T>) {
  const router = useRouter()
  const [navPending, startTransition] = useTransition()
  const pending = isPending || navPending

  const onChange = (checked: boolean) => {
    startTransition(() => router.push(buildHref(applyToggle(current, checked))))
  }

  const blacklistHint = TEST_EXPERIMENT_BLACKLIST.join(', ')

  return (
    <label
      className={cn(
        'mb-3 flex cursor-pointer items-start gap-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5',
        pending && 'opacity-60',
      )}
      title={`Hides experiments whose id or name contains: ${blacklistHint}`}
    >
      <input
        type="checkbox"
        checked={hideTestExperiments}
        onChange={event => onChange(event.target.checked)}
        className="mt-0.5 accent-[var(--accent)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-[var(--text-primary)]">
          Hide test experiments
        </span>
        <span className="text-[12px] text-[var(--text-muted)]">
          Excludes ids/names matching: {blacklistHint}
        </span>
      </span>
    </label>
  )
}
