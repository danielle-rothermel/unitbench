/**
 * Substring blacklist for test/scratch experiments. Matching is case-insensitive;
 * e.g. "temp" also matches "temperature" in an experiment id or display name.
 */
export const TEST_EXPERIMENT_BLACKLIST = [
  'mock',
  'smoke',
  'temp',
  'test',
  'debug',
  'scratch',
  'sandbox',
] as const

export const INCLUDE_TEST_EXPS_PARAM = 'includeTestExps'

export type SearchParamsRecord = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function testExperimentPatterns(): string[] {
  return TEST_EXPERIMENT_BLACKLIST.map(term => `%${term}%`)
}

/** Default true: hide test experiments unless includeTestExps=1 (or true). */
export function parseHideTestExperiments(input: SearchParamsRecord): boolean {
  const include = firstValue(input[INCLUDE_TEST_EXPS_PARAM])?.trim().toLowerCase()
  if (include === '1' || include === 'true') return false
  return true
}

export function appendIncludeTestExpsParam(
  params: URLSearchParams,
  hide: boolean,
): void {
  if (!hide) params.set(INCLUDE_TEST_EXPS_PARAM, '1')
}

export type TestExperimentWhereOptions = {
  hide: boolean
  paramOffset: number
  experimentIdExpr: string
  displayNameExpr?: string
}

export type TestExperimentWhereParts = {
  conditions: string[]
  params: unknown[]
}

export function buildTestExperimentWhereParts(
  options: TestExperimentWhereOptions,
): TestExperimentWhereParts {
  if (!options.hide) {
    return { conditions: [], params: [] }
  }

  const patterns = testExperimentPatterns()
  const matches = (expression: string) => patterns.map((_, index) =>
    `${expression} ILIKE $${options.paramOffset + index + 1}`,
  ).join(' OR ')
  const idMatch = `(${matches(options.experimentIdExpr)})`

  if (options.displayNameExpr) {
    return {
      conditions: [
        `NOT (${idMatch} OR (${matches(options.displayNameExpr)}))`,
      ],
      params: patterns,
    }
  }

  return { conditions: [`NOT (${idMatch})`], params: patterns }
}
