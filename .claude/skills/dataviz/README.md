# Data Visualization Skill

A structured skill that turns an LLM into a data visualization expert. Instead of jumping straight to charts, it follows a 5-phase process:

1. **Environment Setup** -- determine where data lives and where output goes
2. **The Story** -- understand audience, decisions, and key takeaways before touching data
3. **The Data** -- inspect and profile the dataset
4. **Chart Selection** -- walk a decision tree to pick the right chart type for each question
5. **Build & Iterate** -- generate the dashboard with proper layout, design, and narrative

## When to Use This Skill

- You have data and want to build a dashboard or visualization
- You want to avoid common visualization anti-patterns (pie charts with 20 slices, rainbow palettes, dual y-axes)
- You want a structured process rather than "just make me a chart"

## Prerequisites

Depending on your data source:

- **Local files** (CSV, Parquet, JSON, Excel): Python + DuckDB
- **MotherDuck** (cloud DuckDB): MotherDuck MCP server configured

## Usage

Copy `skill.md` into your LLM tool of choice. See the root [README](../../README.md) for setup instructions.

## Examples

- [WHO Air Quality Dashboard](examples/who-air-quality.md) -- building a PM2.5 dashboard from the WHO Ambient Air Quality dataset
