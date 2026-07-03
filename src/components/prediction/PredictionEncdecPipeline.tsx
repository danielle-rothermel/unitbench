import { TextPanel } from '@/components/panels/TextPanel'
import { SECTION_LABEL } from '@/components/primitives'
import { formatCost } from '@/lib/format'
import type { EncdecPipelineData } from '@/lib/prediction-diagnostics'

type PredictionEncdecPipelineProps = {
  pipeline: EncdecPipelineData
}

export function PredictionEncdecPipeline({
  pipeline,
}: PredictionEncdecPipelineProps) {
  const encoderCost = formatCost(pipeline.encoderCost)
  const decoderCost = formatCost(pipeline.decoderCost)

  return (
    <section className="mb-8 flex max-w-[1280px] flex-col gap-2.5">
      <span className={SECTION_LABEL}>Encoder-decoder pipeline</span>
      {(encoderCost || decoderCost) && (
        <div className="flex flex-wrap gap-4 text-[12px] text-[var(--text-secondary)]">
          {encoderCost && (
            <span>
              <span className="font-semibold text-[var(--text-primary)]">
                Encoder cost:
              </span>{' '}
              <span className="font-mono">{encoderCost}</span>
            </span>
          )}
          {decoderCost && (
            <span>
              <span className="font-semibold text-[var(--text-primary)]">
                Decoder cost:
              </span>{' '}
              <span className="font-mono">{decoderCost}</span>
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 items-start gap-4 max-lg:grid-cols-1">
        <TextPanel label="Prompt" value={pipeline.prompt} />
        <TextPanel
          label="Encoded description"
          value={pipeline.encodedDescription}
        />
        <TextPanel label="Decoded output" value={pipeline.decodedGeneration} />
      </div>
    </section>
  )
}
