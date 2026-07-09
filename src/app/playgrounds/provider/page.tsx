import { Tag } from '@/components/primitives'
import { ProviderPlayground } from './ProviderPlayground'

export default function ProviderPlaygroundPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Tag tone="yellow">local-only</Tag>
          <Tag>dr-providers facade</Tag>
        </div>
        <h1 className="font-display text-[30px] leading-tight font-bold text-[var(--text-primary)]">
          Provider playground
        </h1>
        <p className="mt-1.5 max-w-[72ch] text-[15px] text-[var(--text-secondary)]">
          Build a provider request, preview the exact wire payload, send it,
          and read the response with conformance violations called out.
          Variance mode fans one prompt across models × N samples and reports
          output dispersion. Runs against the local dr-providers facade —
          fixture provider by default, live only with your own keys.
        </p>
      </header>
      <ProviderPlayground />
    </div>
  )
}
