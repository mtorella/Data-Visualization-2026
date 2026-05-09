# Viz 05: Country Profile Card Explanation

## Purpose

The country profile card is designed to answer one focused question:

**How does one country compare to its regional and global context in terms of emissions intensity, economic position, and total climate footprint?**

Instead of showing many weak or incomplete indicators, the card focuses on the variables that are both analytically meaningful and consistently available in `df_panel.csv`:

- `ghg_per_capita`
- `gdp_per_capita_ppp`
- `ghg_total_mt`
- `population`

The visualization is interactive: the user selects a country and a year, and the whole profile updates automatically.

## Why We Removed Renewables and Electricity Access

The original plan included `renewable_pct` and `electricity_access_pct`, but they weakened the profile card.

`renewable_pct` has poor coverage in the latest years. For example, many countries have no renewable energy value for 2022 or 2023, so the card often displayed `No data`. This made the profile feel incomplete.

`electricity_access_pct` is available more often, but it is not very informative for many countries because values are frequently close to or exactly `100%`. For high-income countries, it does not create a meaningful comparison.

For this reason, the card now focuses on emissions, wealth, population, and total footprint. Renewable energy and electricity access would work better in separate visualizations where their limitations can be handled directly.

## Main Analysis

The card separates emissions into two ideas:

**Emissions intensity** means how much greenhouse gas is emitted per person. This is shown with `ghg_per_capita`.

**Emissions scale** means how large the country's total footprint is. This is shown with `ghg_total_mt`, alongside population.

This distinction matters because a country can have:

- high emissions per person but a small total footprint
- low emissions per person but a huge total footprint
- high GDP and high emissions, suggesting wealth is linked to consumption or production patterns
- falling emissions intensity over time, suggesting some decarbonization progress

The profile card therefore avoids saying simply "good" or "bad." It shows whether a country is high-emitting relative to its region and the world, and whether that situation is improving.

## Graph 1: Emissions Gap Timeline

The main chart is the **Emissions Gap Timeline**.

It does not plot raw emissions lines. Instead, it shows the difference between the selected country's `ghg_per_capita` and its regional average for each year.

The calculation is:

```text
country gap = (country ghg_per_capita - regional average ghg_per_capita) / regional average ghg_per_capita
```

This is shown as a percentage.

How to read it:

- Bars above the zero line mean the country emits more per person than its region.
- Bars below the zero line mean the country emits less per person than its region.
- The selected year is highlighted.
- The gold marker shows where the global average sits relative to the same regional baseline.

This chart is useful because it turns the time series into a comparison story. Instead of asking only whether emissions went up or down, it asks whether the country is becoming more or less unusual within its regional context.

## Graph 2: Indexed Triangular Profile

The lower visualization combines the three selected-year variables into one indexed triangular profile.

It uses:

- one axis for `ghg_per_capita`
- one axis for `gdp_per_capita_ppp`
- one axis for `ghg_total_mt`

Each axis is converted into an index where the regional average equals `100%`.

It plots three shapes:

- the selected country
- the regional average
- the global average

How to read it:

- The green triangle is the regional baseline.
- If the country shape extends outside the green triangle, the country is above its region for that variable.
- If the country shape sits inside the green triangle, the country is below its region for that variable.
- The gold shape shows how the global average compares with the same regional baseline.

This is more useful than three separate bar charts because it creates a single visual fingerprint. It can show, for example, that a country is below the region for emissions per person, close to the region for GDP per person, but above the region for total footprint.

This section supports the main chart by explaining the selected year in more detail. It shows whether the country's emissions profile is driven by intensity, wealth, total scale, or a combination of the three.

## Interpretation Panel

The interpretation panel summarizes the card in three short analytical statements:

**Intensity** compares the selected country's emissions per person against the global average.

**Direction** explains whether emissions per person have risen or fallen since the first available year for that country.

**Scale** compares the country's total footprint and GDP per person against the regional average.

These statements are generated from the data, so they update when the user changes the country or year.

## Design Choice

The visualization was redesigned away from a standard multi-line chart because line charts with several series can become visually familiar but not very explanatory. The stronger question for this card is not simply "what are the lines doing?" but:

**Is this country above or below its regional emissions context, and how has that gap changed over time?**

That is why the final design uses a gap chart as the main visual. It makes the comparison more direct and gives the country profile a clearer analytical role in the full project.

## Summary

The final country profile card is a compact JavaScript visualization that:

- works across all countries in `df_panel.csv`
- defaults each country to its latest available year
- handles missing values without breaking
- compares countries against regional and global averages
- focuses on reliable variables
- explains emissions intensity, economic context, total footprint, and change over time

Its role in the project is to support non-expert users who want a quick but meaningful profile of a single country.
