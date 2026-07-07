import { Tag } from '@/components/primitives'
import type { ParsedFunction } from '@/fixtures/extraction'
import { cn } from '@/lib/cn'

const SELECTION_RULE_CAPTION =
  'Selected = best_function_name: the parsed function with the most passed cases, ' +
  'tie-broken by name === entry_point (task.py). Arity shown per candidate.'

type FunctionSelectionListProps = {
  parsed_functions: ParsedFunction[]
  best_function_name: string | null
  entry_point: string
}

function SelectionStory({
  best_function_name,
  entry_point,
}: Pick<FunctionSelectionListProps, 'best_function_name' | 'entry_point'>) {
  if (best_function_name === null) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        no function selected
      </p>
    )
  }
  if (best_function_name === entry_point) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        selected <span className="font-mono">&apos;{best_function_name}&apos;</span>{' '}
        matches entry_point
      </p>
    )
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
      <Tag tone="yellow">selection mismatch</Tag>
      <span>
        selected <span className="font-mono">&apos;{best_function_name}&apos;</span> ≠
        entry_point <span className="font-mono">&apos;{entry_point}&apos;</span> —
        outcome-based selection overrode the entry point
      </span>
    </p>
  )
}

export function FunctionSelectionList({
  parsed_functions,
  best_function_name,
  entry_point,
}: FunctionSelectionListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12px] text-[var(--text-muted)]">
        {SELECTION_RULE_CAPTION}
      </p>
      {parsed_functions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
          no top-level functions parsed
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {parsed_functions.map(fn => (
            <li
              key={fn.function_name}
              className={cn(
                'flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2.5',
                fn.is_selected && 'border-l-4 border-l-[var(--accent)]',
              )}
            >
              <code className="font-mono text-[12.5px] text-[var(--text-primary)]">
                {fn.signature_str}
              </code>
              <Tag>arity {fn.arity}</Tag>
              {fn.function_name === entry_point && (
                <Tag tone="blue">entry point</Tag>
              )}
              {fn.is_selected && <Tag tone="green">selected</Tag>}
            </li>
          ))}
        </ul>
      )}
      {parsed_functions.length > 0 && (
        <SelectionStory
          best_function_name={best_function_name}
          entry_point={entry_point}
        />
      )}
    </div>
  )
}
