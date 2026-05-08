# Energy Constellation

## Core idea

This visualisation turns countries into stars inside a moral night sky rather than placing them in a standard scatterplot.

The goal is to challenge the easy reading that **low emissions always mean sustainability**. In this constellation, countries can drift toward:

- **Carbon-heavy abundance**: high emissions and high capacity
- **Transition with capacity**: lower emissions with stronger access and cleaner energy signals
- **Low carbon by constraint**: lower emissions, but also weaker electricity access or economic capacity

## Why it is creative

Instead of bars, lines, or dots on Cartesian axes, the chart uses:

- a **constellation metaphor**
- **glowing star bodies** sized by total emissions
- **green energy rays** that expand with renewable share
- a **morphing truth lens** that shifts interpretation between scarcity and transition
- a **country trail** showing how one selected nation moves across the sky over time

This makes the figure feel more memorable while still preserving a clear encoding logic.

## Data used

Main file:

- `df_panel.csv`

Supporting trend file:

- `df_slope.csv`

The implementation focuses on **2014–2021** because renewable energy coverage drops sharply after 2021 in the cleaned panel.

## Interactive features

- **Truth lens slider**: changes the interpretive balance between “low carbon by constraint” and “low carbon by transition”
- **Spotlight country selector**: reveals the path of one country through the constellation across years
- **Hover and click**: update the narrative reading panel for each country

## Visual encoding

- **Vertical position**: more GHG pressure per capita places a country higher in the sky
- **Horizontal position**: shifts between scarcity-driven and transition-driven readings
- **Halo size**: larger total emissions
- **Green rays**: higher renewable energy share
- **Tail colour and length**: direction and magnitude of 2014 to 2023 emissions change
