import type { TableConfig, TableName } from '@/lib/table-config'

const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function validateSqlIdentifier(identifier: string): void {
  if (!SQL_IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`)
  }
}

export function quoteIdentifier(identifier: string): string {
  validateSqlIdentifier(identifier)
  return `"${identifier}"`
}

export function qualifiedTableName(table: TableName): string {
  const quotedName = quoteIdentifier(table.name)
  return table.schema
    ? `${quoteIdentifier(table.schema)}.${quotedName}`
    : quotedName
}

export function selectedColumnSql(config: TableConfig): string {
  return config.columns
    .map(column => quoteIdentifier(column.key))
    .join(', ')
}

export function orderByForSort(
  column: string,
  direction: 'asc' | 'desc',
): string {
  const sqlDirection = direction === 'asc' ? 'ASC' : 'DESC'
  return `${quoteIdentifier(column)} ${sqlDirection}`
}

export function orderBySql(config: TableConfig): string {
  return orderByForSort(config.defaultSort.column, config.defaultSort.direction)
}
