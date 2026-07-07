import {
  COMPRESSION_METHODS,
  FIXTURE_MODELS,
  FIXTURE_TARGET_RATIOS,
  fixtureTaskIds,
  makeSampleIdentity,
  type CompressionMethod,
  type ResultState,
  type SampleIdentity,
} from '@/fixtures/primitives'
import { chance, createRng, floatBetween, intBetween, round, type Rng } from '@/fixtures/rng'

/** compression.py CompressionMetric — byte-based, one per method, all methods present. */
export type CompressionMetric = {
  method: CompressionMethod
  ground_truth_bytes: number
  /** IR / encoded-description bytes. */
  representation_bytes: number
  /** After the method; 'raw' = representation_bytes. */
  compressed_bytes: number
  /** compressed_bytes / ground_truth_bytes; lower is better. */
  ratio_to_ground_truth: number | null
  percent_reduction_vs_ground_truth: number | null
}

/**
 * Target vs achieved compression for one sample (R3). Sources:
 * dimensions.compression_target (legacy budget_ratio),
 * metrics_json.realized_compression_ratio, HumanEvalScoreResult.
 * best_compression_ratio, and per-stage TextMetricsPayload.character_count.
 */
export type CompressionResultRow = {
  identity: SampleIdentity
  /** The knob; null for direct runs. */
  target_compression_ratio: number | null
  /** max(50, round(target * ground-truth chars)) — spec_builder.py. */
  encoder_char_budget: number | null
  achieved_compression_ratio: number | null
  best_compression_ratio: number | null
  ground_truth_char_count: number
  encoded_char_count: number | null
  generated_char_count: number | null
  compression_metrics: CompressionMetric[]
  result_state: ResultState
  score: number | null
}

export type CompressionFixtureOptions = {
  seed?: number
  models?: readonly string[]
  taskCount?: number
  targetRatios?: readonly number[]
  samplesPerTarget?: number
}

const MIN_ENCODER_CHAR_BUDGET = 50

/** Compressibility per method, roughly ordered as the real codecs behave. */
const METHOD_FACTORS: Record<CompressionMethod, number> = {
  raw: 1,
  zlib: 0.92,
  gzip: 0.94,
  bz2: 0.96,
  lzma: 0.9,
  zstd: 0.88,
}

function makeCompressionMetrics(
  groundTruthBytes: number,
  representationBytes: number,
): CompressionMetric[] {
  return COMPRESSION_METHODS.map(method => {
    const compressedBytes = Math.max(1, Math.round(representationBytes * METHOD_FACTORS[method]))
    const ratio = round(compressedBytes / groundTruthBytes, 4)
    return {
      method,
      ground_truth_bytes: groundTruthBytes,
      representation_bytes: representationBytes,
      compressed_bytes: compressedBytes,
      ratio_to_ground_truth: ratio,
      percent_reduction_vs_ground_truth: round((1 - ratio) * 100, 2),
    }
  })
}

function makeRow(
  rng: Rng,
  task_id: string,
  model: string,
  target: number,
  sample_index: number,
): CompressionResultRow {
  const identity = makeSampleIdentity({ layout: 'encdec', task_id, model, sample_index })
  const groundTruthChars = intBetween(rng, 120, 900)
  const budget = Math.max(MIN_ENCODER_CHAR_BUDGET, Math.round(target * groundTruthChars))
  const encodedChars = Math.max(20, Math.round(budget * floatBetween(rng, 0.7, 1.05)))
  const metrics = makeCompressionMetrics(groundTruthChars, encodedChars)
  const ratios = metrics
    .map(metric => metric.ratio_to_ground_truth)
    .filter((ratio): ratio is number => ratio !== null)
  // Achieved ratio drops with tighter budgets; passing gets harder as it drops
  const achieved = metrics[0].ratio_to_ground_truth
  const passed = chance(rng, Math.min(0.9, 0.25 + target * 0.45))
  return {
    identity,
    target_compression_ratio: target,
    encoder_char_budget: budget,
    achieved_compression_ratio: achieved,
    best_compression_ratio: round(Math.min(...ratios), 4),
    ground_truth_char_count: groundTruthChars,
    encoded_char_count: encodedChars,
    generated_char_count: Math.round(groundTruthChars * floatBetween(rng, 0.8, 1.3)),
    compression_metrics: metrics,
    result_state: passed ? 'passed' : 'failed',
    score: passed ? 1.0 : 0.0,
  }
}

export function makeCompressionResultRows(
  options: CompressionFixtureOptions = {},
): CompressionResultRow[] {
  const {
    seed = 1,
    models = FIXTURE_MODELS.slice(0, 2),
    taskCount = 6,
    targetRatios = FIXTURE_TARGET_RATIOS,
    samplesPerTarget = 3,
  } = options
  const rng = createRng(seed)
  const rows: CompressionResultRow[] = []
  for (const task_id of fixtureTaskIds(taskCount)) {
    for (const model of models) {
      for (const target of targetRatios) {
        for (let sample = 0; sample < samplesPerTarget; sample += 1) {
          rows.push(makeRow(rng, task_id, model, target, sample))
        }
      }
    }
  }
  return rows
}
