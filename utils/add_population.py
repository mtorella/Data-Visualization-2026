import pandas as pd

# Paths
PANEL_FILE  = "df_panel.csv"
POP_FILE    = "data/WB_WDI_SP_POP_TOTL.csv"
OUTPUT_FILE = "df_panel_with_pop.csv"

# STEP 1: Load df_panel 
df_panel = pd.read_csv(PANEL_FILE)

# STEP 2: Load and clean population file 
pop_raw = pd.read_csv(POP_FILE)

pop = (
    pop_raw[['REF_AREA', 'TIME_PERIOD', 'OBS_VALUE']]
    .rename(columns={
        'REF_AREA':    'iso3',
        'TIME_PERIOD': 'year',
        'OBS_VALUE':   'population'
    })
    .dropna(subset=['population'])
)
pop['year'] = pop['year'].astype(int)
pop['population'] = pop['population'].astype(float)

# STEP 3: Merge on iso3 + year 
print("\nMerging...")
df_merged = df_panel.merge(
    pop[['iso3', 'year', 'population']],
    on=['iso3', 'year'],
    how='left'
)

# STEP 4: Calculate absolute emissions 
# ghg_per_capita is in kg CO2-eq per person
# population is in persons
# → ghg_total is in kg CO2-eq total
# → ghg_total_mt converts to megatonnes (÷ 1,000,000,000)
df_merged['ghg_total']    = df_merged['ghg_per_capita'] * df_merged['population']
df_merged['ghg_total_mt'] = df_merged['ghg_total'] / 1_000_000_000

# STEP 5: Save 
df_merged.to_csv(OUTPUT_FILE, index=False)

# SUMMARY 

## Coverage check
pop_coverage = df_merged['population'].notna().sum()
total_rows = len(df_merged)
print(f"   Population coverage: {pop_coverage}/{total_rows} rows ({pop_coverage/total_rows*100:.1f}%)")

print("\n   New columns added:")
print(f"   - population    : {df_merged['population'].notna().sum()} non-null values")
print(f"   - ghg_total     : {df_merged['ghg_total'].notna().sum()} non-null values (kg CO₂-eq)")
print(f"   - ghg_total_mt  : {df_merged['ghg_total_mt'].notna().sum()} non-null values (megatonnes)")

print("\n   Sample — top 5 absolute emitters (latest year available):")
latest = df_merged[df_merged['year'] == df_merged['year'].max()]
top5 = latest.nlargest(5, 'ghg_total_mt')[['iso3', 'year', 'ghg_per_capita', 'population', 'ghg_total_mt']]
print(top5.to_string(index=False))