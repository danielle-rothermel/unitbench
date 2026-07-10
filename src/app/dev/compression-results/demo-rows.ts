/**
 * Hand-authored edge-case rows for the compression-results demo (R3, REL-4).
 *
 * The generator (`makeCompressionResultRows`) never emits these failure paths
 * — it always fills every field and only uses passed/failed — so the rows are
 * written by hand against the frozen fixture type (constructing values of a
 * fixture type is not a fixture modification). Doc:
 * docs/planning/viz-components/v0/workstreams/r3-compression-results.md §4.
 */

import type { CompressionMetric, CompressionResultRow } from '@/fixtures/compression'
import { COMPRESSION_METHODS, makeSampleIdentity } from '@/fixtures/primitives'

export type EdgeCaseRow = {
  label: string
  row: CompressionResultRow
}

function metricsFromRatios(
  groundTruthBytes: number,
  representationBytes: number,
  ratios: Partial<Record<CompressionMetric['method'], number | null>>,
): CompressionMetric[] {
  return COMPRESSION_METHODS.map(method => {
    const ratio = ratios[method] ?? null
    return {
      method,
      ground_truth_bytes: groundTruthBytes,
      representation_bytes: representationBytes,
      compressed_bytes:
        ratio !== null ? Math.round(groundTruthBytes * ratio) : representationBytes,
      ratio_to_ground_truth: ratio,
      percent_reduction_vs_ground_truth: ratio !== null ? Math.round((1 - ratio) * 10000) / 100 : null,
    }
  })
}

const DIRECT_RUN_ROW: CompressionResultRow = {
  identity: makeSampleIdentity({
    layout: 'direct',
    task_id: 'HumanEval/90',
    model: 'openai/gpt-5.5-codex',
    sample_index: 0,
  }),
  // Direct layouts have no compression knob: no target, no encoder budget.
  target_compression_ratio: null,
  encoder_char_budget: null,
  achieved_compression_ratio: 0.62,
  best_compression_ratio: 0.55,
  ground_truth_char_count: 240,
  encoded_char_count: null,
  generated_char_count: 251,
  compression_metrics: metricsFromRatios(240, 149, {
    raw: 0.62,
    zlib: 0.58,
    gzip: 0.59,
    bz2: 0.6,
    lzma: 0.56,
    zstd: 0.55,
  }),
  result_state: 'passed',
  score: 1.0,
}

const FAILED_BEFORE_ENCODE_ROW: CompressionResultRow = {
  identity: makeSampleIdentity({
    layout: 'encdec',
    task_id: 'HumanEval/91',
    model: 'anthropic/claude-sonnet-5',
    sample_index: 1,
  }),
  target_compression_ratio: 0.5,
  encoder_char_budget: 160,
  // Sample died before encode/decode: nothing measured, no metrics recorded.
  achieved_compression_ratio: null,
  best_compression_ratio: null,
  ground_truth_char_count: 320,
  encoded_char_count: null,
  generated_char_count: null,
  compression_metrics: [],
  result_state: 'failed',
  score: 0.0,
}

const ERROR_STATE_ROW: CompressionResultRow = {
  identity: makeSampleIdentity({
    layout: 'encdec',
    task_id: 'HumanEval/92',
    model: 'anthropic/claude-haiku-4-5',
    sample_index: 2,
  }),
  target_compression_ratio: 0.25,
  encoder_char_budget: 50,
  achieved_compression_ratio: 0.31,
  best_compression_ratio: 0.28,
  ground_truth_char_count: 180,
  encoded_char_count: 56,
  generated_char_count: null,
  // zstd's ratio is null: '—' cells, and it never wins the best highlight.
  compression_metrics: metricsFromRatios(180, 56, {
    raw: 0.31,
    zlib: 0.29,
    gzip: 0.3,
    bz2: 0.31,
    lzma: 0.28,
    zstd: null,
  }),
  result_state: 'error',
  score: null,
}

const EXPANSION_ROW: CompressionResultRow = {
  identity: makeSampleIdentity({
    layout: 'encdec',
    task_id: 'HumanEval/93',
    model: 'google/gemini-3-flash',
    sample_index: 0,
  }),
  // Loose budget (2.0×): the "compressed" IR is bigger than the ground truth.
  target_compression_ratio: 2.0,
  encoder_char_budget: 300,
  achieved_compression_ratio: 1.4,
  best_compression_ratio: 1.23,
  ground_truth_char_count: 150,
  encoded_char_count: 210,
  generated_char_count: 168,
  compression_metrics: metricsFromRatios(150, 210, {
    raw: 1.4,
    zlib: 1.29,
    gzip: 1.32,
    bz2: 1.34,
    lzma: 1.26,
    zstd: 1.23,
  }),
  result_state: 'passed',
  score: 1.0,
}

export const EDGE_CASE_ROWS: EdgeCaseRow[] = [
  {
    label: 'Direct run: no target ratio, no encoder budget',
    row: DIRECT_RUN_ROW,
  },
  {
    label: 'Failed before encode: achieved/encoded/generated all null, no metrics',
    row: FAILED_BEFORE_ENCODE_ROW,
  },
  {
    label: 'Error state: null score, one metric ratio missing',
    row: ERROR_STATE_ROW,
  },
  {
    label: 'Expansion: achieved ratio past 1.0 under a loose 2.0× budget',
    row: EXPANSION_ROW,
  },
]
