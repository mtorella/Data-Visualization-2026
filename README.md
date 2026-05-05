# Data-Visualisation-2026
**Who Pollutes, Who Pays?**: A data visualization project exploring GHG emissions, wealth, and energy access across 90 countries from 2014 to 2023.

---

## Project Structure

```
Data-Visualisation-2026/
├── data/                        # Raw source files (not modified)
│   ├── OECD.csv                 # OECD GHG emissions per capita
│   ├── economy-and-growth-2025.csv   # World Bank GDP data
│   ├── energy-and-mining-2025.csv    # World Bank energy indicators
│   └── population-2025.csv          # World Bank total population
├── preprocessing.ipynb          # Main pipeline: cleaning, joining, EDA
├── df_panel.csv                 # Output: full joined panel (2014–2023)
├── df_slope.csv                 # Output: country endpoints for slope chart
└── README.md
```

---

## Requirements

Python 3.9 or later. Install dependencies with:

```bash
pip install pandas numpy matplotlib seaborn
```

No internet connection is required: all data files are bundled locally in `data/`.

---

## How to Run

1. Clone or download the repository.
2. Make sure all four raw files are present inside the `data/` folder (see structure above).
3. Open `preprocessing.ipynb` in Jupyter:

```bash
jupyter notebook preprocessing.ipynb
```

4. Run all cells top to bottom via **Kernel → Restart & Run All**.

The notebook will produce two output CSV files in the project root:

| File | Description | Used by |
|------|-------------|---------|
| `df_panel.csv` | Full joined panel — 789 rows × 11 columns, one row per country-year | Vizzes 01, 02, 04, 05, 06, 07, 08 |
| `df_slope.csv` | One row per country with 2014 and 2023 GHG values and % change | Viz 03 (slope chart) |

---

## Data Sources

| Dataset | Source | Key variables |
|---------|--------|---------------|
| GHG Emissions | [OECD Air Emissions](https://stats.oecd.org/) | GHG per capita (kg CO₂-eq/person), 1988–2023 |
| Economy & Growth | [World Bank WDI](https://databank.worldbank.org/) | GDP per capita, PPP (current intl $), 1960–2023 |
| Energy & Mining | [World Bank WDI](https://databank.worldbank.org/) | Renewable energy share, electricity access, fossil fuel share, 1960–2023 |
| Population | [World Bank WDI](https://databank.worldbank.org/) | Total population (persons), 1960–2023 |
| Region metadata | World Bank 7-region classification | Manually mapped by ISO-3 code, embedded in notebook |

---

## Visualizations

The project produces 8 visualizations spanning Power Tableu, Python (Plotly, Altair), JavaScript, and D3.js:

| # | Title | Tool |
|---|-------|------|
| 01 | Choropleth map | Tableu |
| 02 | Bubble scatter: GDP vs GHG | Tableu |
| 03 | Slope chart: 2014→2023 change | Python / Plotly |
| 04 | Diverging dot plot: GHG vs renewables | Python / Altair |
| 05 | Country profile card | JavaScript |
| 06 | Scatter: electricity access vs GHG | Tableu |
| 07 ★ | Radial Emission Fingerprint | D3.js |
| 08 | White hat / Black hat maps | Tableu |

---

## Notes on Missing Data

Missing values in `df_panel.csv` are structural: they reflect countries absent from source databases, not collection errors. No imputation was applied. See the **Limitations** section in `preprocessing.ipynb` (cell 11) for a full breakdown.
