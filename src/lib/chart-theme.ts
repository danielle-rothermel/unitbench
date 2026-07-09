/**
 * Token-mapped chart theme for visx charts. Colors reference the OKLCH
 * tokens in `src/app/globals.css` via CSS variables — SVG resolves
 * `var(--…)` in fill/stroke/color attributes, so charts restyle with
 * the token sheet and never hard-code colors.
 */
export const CHART_THEME = {
  axis: {
    stroke: 'var(--border-strong)',
    tickStroke: 'var(--border-strong)',
    labelColor: 'var(--text-secondary)',
    tickLabelColor: 'var(--text-muted)',
    labelFontSize: 11,
    tickFontSize: 10,
    fontFamily: 'var(--font-mono)',
  },
  grid: {
    stroke: 'var(--border-subtle)',
  },
  point: {
    fill: 'var(--accent)',
    fillOpacity: 0.7,
    stroke: 'var(--bg-primary)',
    radius: 4,
  },
  series: [
    'var(--accent)',
    'var(--blue)',
    'var(--red)',
    'var(--yellow)',
    'var(--green)',
  ],
} as const

export const CHART_AXIS_LABEL_PROPS = {
  fill: CHART_THEME.axis.labelColor,
  fontSize: CHART_THEME.axis.labelFontSize,
  fontFamily: CHART_THEME.axis.fontFamily,
} as const

export const CHART_TICK_LABEL_PROPS = {
  fill: CHART_THEME.axis.tickLabelColor,
  fontSize: CHART_THEME.axis.tickFontSize,
  fontFamily: CHART_THEME.axis.fontFamily,
} as const
