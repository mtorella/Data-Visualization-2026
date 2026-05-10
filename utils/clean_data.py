import pandas as pd

INPUT_FILE  = "data/raw_data/API_5_DS2_en_csv_v2_5693.csv"
OUTPUT_FILE = "data/energy-and-mining-2025.csv"

# STEP 1: Load  
# World Bank CSVs have 4 header rows before the actual data
df = pd.read_csv(INPUT_FILE, skiprows=4)

# Drop the trailing empty column World Bank exports often add
df = df.drop(columns=[c for c in df.columns if c.startswith("Unnamed")], errors="ignore")
# Drop the Indicator Code column — not present in target format
df = df.drop(columns=["Indicator Code"], errors="ignore")

# STEP 2: Identify year columns 
year_cols = [c for c in df.columns if c.isdigit()]

# STEP 3: Melt wide → long 
df_long = df.melt(
    id_vars=["Country Name", "Country Code", "Indicator Name"],
    value_vars=year_cols,
    var_name="Year",
    value_name="Value"
)
df_long["Year"] = df_long["Year"].astype(int)

# STEP 4: Pivot long → wide (indicators become columns) 
df_wide = df_long.pivot_table(
    index=["Country Name", "Country Code", "Year"],
    columns="Indicator Name",
    values="Value",
    aggfunc="mean"          # in case of duplicates; normally no effect
).reset_index()
df_wide.columns.name = None  # remove MultiIndex name

# STEP 5: Add "average_value_" prefix to match target format 
meta_cols = ["Country Name", "Country Code", "Year"]
indicator_cols = [c for c in df_wide.columns if c not in meta_cols]

df_wide = df_wide.rename(columns={c: f"average_value_{c}" for c in indicator_cols})

# STEP 6: Sort & save 
df_wide = df_wide.sort_values(["Country Code", "Year"]).reset_index(drop=True)

df_wide.to_csv(OUTPUT_FILE, index=False)

# ---------------------------------------------------------------------------------------
# ---------------------------------------------------------------------------------------

INPUT_FILE  = "data/raw_data/API_3_DS2_en_csv_v2_17489.csv"
OUTPUT_FILE = "data/economy-and-growth-2025.csv"

# STEP 1: Load
# World Bank CSVs have 4 header rows before the actual data
df = pd.read_csv(INPUT_FILE, skiprows=4)

# Drop the trailing empty column World Bank exports often add
df = df.drop(columns=[c for c in df.columns if c.startswith("Unnamed")], errors="ignore")
# Drop Indicator Code — not present in target format
df = df.drop(columns=["Indicator Code"], errors="ignore")

# STEP 2: Identify year columns 
year_cols = [c for c in df.columns if c.isdigit()]

# STEP 3: Melt wide → long 
df_long = df.melt(
    id_vars=["Country Name", "Country Code", "Indicator Name"],
    value_vars=year_cols,
    var_name="Year",
    value_name="Value"
)
df_long["Year"] = df_long["Year"].astype(int)

# Drop rows where Value is NaN to keep file size manageable
# (rows are still present in the output as NaN cells once pivoted)
df_long = df_long.dropna(subset=["Value"])

# STEP 4: Pivot long → wide (indicators become columns) 
df_wide = df_long.pivot_table(
    index=["Country Name", "Country Code", "Year"],
    columns="Indicator Name",
    values="Value",
    aggfunc="mean"          # handles duplicates if any; normally no effect
).reset_index()
df_wide.columns.name = None

# STEP 5: Add "average_value_" prefix to match target format 
meta_cols = ["Country Name", "Country Code", "Year"]
indicator_cols = [c for c in df_wide.columns if c not in meta_cols]
df_wide = df_wide.rename(columns={c: f"average_value_{c}" for c in indicator_cols})

# STEP 6: Sort & save
df_wide = df_wide.sort_values(["Country Code", "Year"]).reset_index(drop=True)

df_wide.to_csv(OUTPUT_FILE, index=False)


# ---------------------------------------------------------------------------------------
# ---------------------------------------------------------------------------------------

INPUT_FILE  = "data/raw_data/WB_WDI_SP_POP_TOTL.csv"
OUTPUT_FILE = "data/population-2025.csv"

# STEP 1: Load — already in long format (one row per country-year)
pop_raw = pd.read_csv(INPUT_FILE)

# STEP 2: Extract and rename the three relevant columns
pop = (
    pop_raw[['REF_AREA', 'TIME_PERIOD', 'OBS_VALUE']]
    .rename(columns={
        'REF_AREA':    'iso3',
        'TIME_PERIOD': 'year',
        'OBS_VALUE':   'population'
    })
    .dropna(subset=['population'])
)
pop['year']       = pop['year'].astype(int)
pop['population'] = pop['population'].astype(float)

# STEP 3: Sort & save
pop = pop.sort_values(['iso3', 'year']).reset_index(drop=True)
pop.to_csv(OUTPUT_FILE, index=False)
