# Data-Visualisation-2026
**Who Pollutes, Who Pays?**: A data visualization project exploring GHG emissions, wealth, and energy access across 90 countries from 2014 to 2023.

---

## Requirements

Python 3.9 or later. Install dependencies with:

```bash
pip install pandas numpy matplotlib seaborn
```

No internet connection is required: all data files are bundled locally in `data/`.

---

## Project Structure

```
Data-Visualisation-2026/
├── data/
│   ├── raw_data/                      # Original source files (not modified)
│   │   ├── OECD.csv                   # OECD GHG emissions per capita
│   │   ├── API_5_DS2_en_csv_v2_5693.csv  # World Bank raw export — energy & mining
│   │   ├── API_3_DS2_en_csv_v2_17489.csv # World Bank raw export — economy & growth
│   │   └── WB_WDI_SP_POP_TOTL.csv    # World Bank raw export — population
│   ├── energy-and-mining-2025.csv     # Cleaned energy data (output of clean_data.py)
│   ├── economy-and-growth-2025.csv    # Cleaned economy data (output of clean_data.py)
│   ├── population-2025.csv            # Cleaned population data (output of clean_data.py)
│   └── df_panel.csv                   # Output: full joined panel (2014–2023)
├── utils/
│   └── clean_data.py                  # Converts raw World Bank exports to analysis-ready CSVs
├── preprocessing.ipynb                # Main pipeline: cleaning, joining, EDA
├── website/
│   ├── Home/                          # Main project webpage
│   ├── Python/                        # Python static ethics visualizations
│   ├── Tableau/                       # Embedded Tableau dashboard
│   ├── Country_profile_card/          # JavaScript explanatory country profile
│   └── Pressure_wheel/                # D3.js creative pressure-wheel visualization
└── README.md
```
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

## Utils

The `utils/clean_data.py` script handles the conversion of raw World Bank API exports into the analysis-ready CSVs consumed by the notebook. The World Bank exports data in a wide format with 4 header rows and one column per year; the script reshapes each file into a long-then-wide tidy format with one row per country-year and one column per indicator.

It processes three files in sequence:

| Input (raw) | Output (cleaned) |
|---|---|
| `data/raw_data/API_5_DS2_en_csv_v2_5693.csv` | `data/energy-and-mining-2025.csv` |
| `data/raw_data/API_3_DS2_en_csv_v2_17489.csv` | `data/economy-and-growth-2025.csv` |
| `data/raw_data/WB_WDI_SP_POP_TOTL.csv` | `data/population-2025.csv` |

**You only need to run this script if you have re-downloaded the raw World Bank files.** The cleaned CSVs are already included in the repository. To re-run it:

```bash
python utils/clean_data.py
```

Run it from the project root before opening the notebook.

---

## How to Run

1. Clone or download the repository.
2. Make sure all four raw files are present inside the `data/raw_data/` folder (see structure above).
3. Open `preprocessing.ipynb` in Jupyter:

```bash
jupyter notebook preprocessing.ipynb
```

4. Run all cells top to bottom via **Kernel → Restart & Run All**.

The notebook will produce `data/df_panel.csv` if not already present: the full joined panel (789 rows × 11 columns).

### Project Website

The live site is hosted on GitHub Pages and can be visited directly at:

**https://mtorella.github.io/Data-Visualisation-2026/**

To run it locally, the JavaScript pages fetch CSV files so they need a small web server from the repository root (opening the HTML files directly via `file://` will not work):

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/website/Home/
```

To kill the local server run:

```bash
kill $(lsof -ti :8000)
```