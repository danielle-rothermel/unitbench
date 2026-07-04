import { Tag } from '@/components/primitives'
import { ParserPlayground } from './ParserPlayground'

export default function ParserPlaygroundPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Tag tone="yellow">local-only</Tag>
          <Tag>dr-code facade</Tag>
        </div>
        <h1 className="font-display text-[30px] leading-tight font-bold text-[var(--text-primary)]">
          Parser playground
        </h1>
        <p className="mt-1.5 max-w-[72ch] text-[15px] text-[var(--text-secondary)]">
          Paste raw generation text and watch the HumanEval extraction
          pipeline explain itself: unwrap, candidate tree with rejection
          reasons, and the winner rationale. Runs against the local dr-code
          serve facade — nothing leaves this machine.
        </p>
      </header>
      <ParserPlayground />
    </div>
  )
}
