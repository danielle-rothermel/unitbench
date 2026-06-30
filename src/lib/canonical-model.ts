import { quoteIdentifier } from '@/lib/sql-identifiers'

const ENCDEC_ARROW = ' -> '

/**
 * Collapse enc-dec labels like "openai/foo -> openai/foo" to "openai/foo"
 * so direct and enc-dec runs for the same model aggregate together.
 * When encoder and decoder differ, keep the full "encoder -> decoder" label.
 */
export function normalizeModelLabel(model: string): string {
  if (!model.includes(ENCDEC_ARROW)) return model
  const [encoder, decoder] = model.split(ENCDEC_ARROW).map(part => part.trim())
  if (!encoder || !decoder) return model
  if (encoder === decoder) return encoder
  return model
}

/** SQL expression referencing the "model" column; fixed fragment only. */
export const CANONICAL_MODEL_SQL = `CASE
  WHEN position('${ENCDEC_ARROW}' in ${quoteIdentifier('model')}) > 0
    AND split_part(${quoteIdentifier('model')}, '${ENCDEC_ARROW}', 1)
      = split_part(${quoteIdentifier('model')}, '${ENCDEC_ARROW}', 2)
  THEN split_part(${quoteIdentifier('model')}, '${ENCDEC_ARROW}', 1)
  ELSE ${quoteIdentifier('model')}
END`

export function modelGroupBySelectSql(): string {
  return `${CANONICAL_MODEL_SQL} AS ${quoteIdentifier('model')}`
}

export function modelGroupBySql(): string {
  return CANONICAL_MODEL_SQL
}

export function modelFilterSql(): string {
  return CANONICAL_MODEL_SQL
}
