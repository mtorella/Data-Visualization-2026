# Viz 07: Climate Constellation

## Purpose

This is the project's creative JavaScript/D3.js visualization. It answers the question:

**Which countries combine economic development, emissions intensity, renewable energy, and electricity access in a more sustainable way?**

The target audience is non-expert users. The goal is to make a country's climate-development profile feel memorable, not like a technical table.

## Variables

The visualization uses four variables from `df_panel.csv`:

- `ghg_per_capita`
- `gdp_per_capita_ppp`
- `renewable_pct`
- `electricity_access_pct`

The chart keeps the two most important tradeoff variables as spatial position:

- Right = higher GDP per capita.
- Up = higher greenhouse gas emissions per person.

The other two variables become visual features of the selected country glyph:

- Green orbit = renewable energy share.
- Gold halo = electricity access.

## How to Read It

Each selected country becomes a planet inside a global constellation of all countries for the selected year.

- The background dots show the global context.
- The selected countries are highlighted as larger annotated planets.
- Dotted tethers connect each planet back to its true position when selected countries are close together.
- The lower-right direction is the desirable direction: higher economic capacity with lower emissions intensity.
- A strong green orbit suggests a larger renewable share.
- A complete gold halo suggests broad electricity access.
- Missing rings indicate missing data for renewables or electricity access.

## Design Rationale

This version avoids a standard radar chart. It uses a scatter-glyph hybrid inspired by constellation maps: the viewer first sees the development/emissions tension through position, then reads renewables and access through the glyph design.

The insight is that emissions cannot be interpreted alone. A country with low emissions per person may be genuinely cleaner, or it may simply have lower GDP or lower electricity access. A country with high GDP and lower emissions is closer to the ideal climate-development profile.

## Data Limitation

The renewable energy variable has poor coverage in the latest years. The visualization therefore defaults to `2021`, because 2020 and 2021 have the strongest four-variable coverage. Years after 2021 remain selectable, but the chart clearly indicates when data is missing.
