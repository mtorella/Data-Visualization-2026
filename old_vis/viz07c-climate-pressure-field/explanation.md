# Viz 07C: Climate Pressure Field

## Purpose

This is an alternative creative D3.js visualization for the project. It answers:

**What kind of climate-development pressure profile does each country have, and which pressure dominates?**

The target audience is non-expert users. The visualization turns abstract indicators into a memorable spatial metaphor: countries behave like particles pulled by four climate-development forces.

## Variables

The visualization uses four variables from `df_panel.csv`:

- `ghg_per_capita`
- `gdp_per_capita_ppp`
- `renewable_pct`
- `electricity_access_pct`

Each variable becomes a pressure score from 0 to 100:

- Carbon pressure = percentile rank of GHG per capita.
- Capacity to act = percentile rank of GDP per capita PPP.
- Renewable gap = reversed percentile rank of renewable energy share.
- Energy access gap = `1 - electricity_access_pct / 100`.

## How to Read It

Each dot is one country in the selected year.

- A country is pulled toward a pole when it scores highly on that pressure.
- Dot size shows combined pressure across all available variables.
- Dot color shows the strongest pressure in that country profile.
- Countries near a corner are dominated by one pressure.
- Countries near the center are pulled by multiple pressures at once.

## Design Rationale

This is inspired by D3 force-directed layouts, but it is not a network graph. There are no fake links between countries. Instead, the force metaphor is used to show how country profiles settle between competing climate-development pressures.

The main insight is that emissions alone are not enough. Low-emission countries may be low because of lower development or limited energy access, while high-capacity countries with high emissions and low renewables face stronger transition responsibility.

## Limitations

The force layout is metaphorical. It is useful for pattern recognition and comparison, not exact measurement. Exact values are available in the tooltip and detail cards.

Renewable energy has poor coverage after 2021, so the visualization defaults to 2021.
