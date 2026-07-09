/**
 * Shared fake-data fixtures for the six viz components (REL-13).
 * Shapes double as the component API contract; field names match the Neon
 * columns / JSONB payload keys so D3's real-data swap is a pass-through.
 * Design doc: docs/plans/05-r0-fixture-shapes.md.
 */
export * from '@/fixtures/primitives'
export * from '@/fixtures/rng'
export * from '@/fixtures/sweep'
export * from '@/fixtures/extraction'
export * from '@/fixtures/compression'
export * from '@/fixtures/pipeline'
export * from '@/fixtures/bootstrap'
export * from '@/fixtures/heatmap'
