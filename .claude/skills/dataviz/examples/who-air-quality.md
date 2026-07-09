# Example: WHO Air Quality Dashboard

This example shows how the dataviz skill was used to build a PM2.5 air quality dashboard from the WHO Ambient Air Quality dataset.

## Dataset

**WHO Ambient Air Quality Database** -- global city-level measurements of PM2.5, PM10, and NO2 concentrations.

- ~8,000 rows covering cities worldwide
- Key fields: `city`, `country`, `who_region`, `year`, `pm25_concentration`, `pm10_concentration`, `no2_concentration`

## Story (Phase 1 answers)

| Question | Answer |
|----------|--------|
| **Audience** | General public and policy makers |
| **Decision** | Which regions need the most attention for air quality improvement? |
| **Key takeaway** | Most of the world exceeds WHO safe PM2.5 guidelines (5 ug/m3) |
| **Questions** | How does PM2.5 vary by region? Which cities are worst? Is it improving over time? |

## Chart Plan (Phase 3)

| Question | Chart type | Why |
|----------|-----------|-----|
| Regional PM2.5 overview | Horizontal bar | Categorical ranking of regions |
| City-level worst offenders | Horizontal bar (top N) | Ranking with direct labels |
| Trend over time | Line chart | Ordered time axis, single metric |
| Distribution by region | Box/violin plot | Shows spread within each region |

## WHO Severity Tiers

The skill applied domain-specific color encoding:

| Level | PM2.5 Range | Color |
|-------|------------|-------|
| Safe | <= 5 ug/m3 | Green (#2d7a00) |
| Moderate | 5-15 ug/m3 | Blue (#0777b3) |
| Unhealthy | 15-35 ug/m3 | Orange (#e18727) |
| Hazardous | > 35 ug/m3 | Red (#bc1200) |

A reference line at 5 ug/m3 (WHO guideline) was added to all relevant charts.

## Result

The dashboard followed the F-pattern layout:
1. Title with the key takeaway as a subtitle
2. KPI cards showing global averages and worst regions
3. Primary trend chart (largest, top-left)
4. Supporting comparison charts
5. Detail table for drill-down
