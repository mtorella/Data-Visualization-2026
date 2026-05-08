const DATA_URL = "../df_panel.csv";

const metrics = [
  {
    key: "ghg_per_capita",
    label: "GHG per capita",
    unit: "t CO2e / person",
    format: (value) => `${formatNumber(value, 1)} t`,
    higherIs: "risk",
  },
  {
    key: "gdp_per_capita_ppp",
    label: "GDP per capita PPP",
    unit: "current international $",
    format: (value) => `$${formatNumber(value, 0)}`,
    higherIs: "context",
  },
  {
    key: "ghg_total_mt",
    label: "Total GHG footprint",
    unit: "Mt CO2e",
    format: (value) => `${formatNumber(value * 1000, 0)} Mt`,
    higherIs: "risk",
  },
];

const els = {
  countryInput: document.querySelector("#country-search"),
  countryOptions: document.querySelector("#country-options"),
  countryToggle: document.querySelector(".country-toggle"),
  yearInput: document.querySelector("#year-search"),
  yearOptions: document.querySelector("#year-options"),
  yearToggle: document.querySelector(".year-toggle"),
  country: document.querySelector("#profile-country"),
  region: document.querySelector("#profile-region"),
  year: document.querySelector("#profile-year"),
  statusLabel: document.querySelector("#status-label"),
  statusDetail: document.querySelector("#status-detail"),
  populationValue: document.querySelector("#population-value"),
  insightList: document.querySelector("#insight-list"),
  trendChart: document.querySelector("#trend-chart"),
  metricList: document.querySelector("#metric-list"),
  cardNote: document.querySelector("#card-note"),
};

const state = {
  rows: [],
  countries: [],
  selectedCountry: "",
  selectedYear: "",
  countryMenuOpen: false,
  yearMenuOpen: false,
  availableYears: [],
};

fetch(DATA_URL)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load ${DATA_URL}`);
    }
    return response.text();
  })
  .then((text) => {
    state.rows = parseCsv(text).map(coerceRow);
    state.countries = getCountries(state.rows);
    state.selectedCountry = pickInitialCountry(state.countries, "Italy");
    populateCountries();
    selectCountry(state.selectedCountry);
    requestAnimationFrame(() => {
      document.body.classList.add("is-data-ready");
    });
  })
  .catch((error) => {
    els.statusLabel.textContent = "Data unavailable";
    els.statusDetail.textContent = error.message;
    els.cardNote.textContent = "Run this page from a local web server so JavaScript can fetch df_panel.csv.";
    document.body.classList.add("is-data-ready");
  });

els.countryInput.addEventListener("focus", () => {
  renderCountryOptions("");
  openCountryMenu();
});

els.countryInput.addEventListener("input", () => {
  const country = resolveCountryName(els.countryInput.value);
  if (country && country !== state.selectedCountry) {
    selectCountry(country);
  } else {
    renderCountryOptions(els.countryInput.value);
    openCountryMenu();
  }
});

els.countryInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCountryMenu();
  }

  if (event.key === "Enter") {
    const country = resolveCountryName(els.countryInput.value) || firstVisibleCountry();
    if (country) {
      event.preventDefault();
      selectCountry(country);
      closeCountryMenu();
    }
  }
});

els.countryToggle.addEventListener("click", () => {
  els.countryInput.focus();
  if (state.countryMenuOpen) {
    closeCountryMenu();
  } else {
    renderCountryOptions("");
    openCountryMenu();
  }
});

els.countryOptions.addEventListener("pointerdown", (event) => {
  const option = event.target.closest("[data-country]");
  if (!option) return;

  event.preventDefault();
  selectCountry(option.dataset.country);
  closeCountryMenu();
});

document.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".country-combobox") || event.target.closest(".year-combobox")) return;
  closeCountryMenu();
  closeYearMenu();
});

els.yearInput.addEventListener("focus", () => {
  renderYearOptions("");
  openYearMenu();
});

els.yearInput.addEventListener("input", () => {
  const year = resolveYear(els.yearInput.value);
  if (year) {
    selectYear(year);
  } else {
    renderYearOptions(els.yearInput.value);
    openYearMenu();
  }
});

els.yearInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeYearMenu();
  }

  if (event.key === "Enter") {
    const year = resolveYear(els.yearInput.value) || firstVisibleYear();
    if (year) {
      event.preventDefault();
      selectYear(year);
      closeYearMenu();
    }
  }
});

els.yearToggle.addEventListener("click", () => {
  els.yearInput.focus();
  if (state.yearMenuOpen) {
    closeYearMenu();
  } else {
    renderYearOptions("");
    openYearMenu();
  }
});

els.yearOptions.addEventListener("pointerdown", (event) => {
  const option = event.target.closest("[data-year]");
  if (!option) return;

  event.preventDefault();
  selectYear(Number(option.dataset.year));
  closeYearMenu();
});

function selectCountry(countryName) {
  state.selectedCountry = countryName;
  els.countryInput.value = countryName;
  renderCountryOptions(countryName);

  const countryRows = getCountryRows(countryName);
  const years = countryRows.map((row) => row.year).sort((a, b) => b - a);
  const preferredYear = years.includes(state.selectedYear) ? state.selectedYear : years[0];

  state.availableYears = years;

  state.selectedYear = preferredYear;
  els.yearInput.value = preferredYear;
  renderYearOptions("");
  render();
}

function selectYear(year) {
  if (!state.availableYears.includes(Number(year))) return;
  state.selectedYear = Number(year);
  els.yearInput.value = state.selectedYear;
  renderYearOptions("");
  render();
}

function render() {
  const row = getCountryRows(state.selectedCountry).find((item) => item.year === state.selectedYear);
  if (!row) return;

  const countryRows = getCountryRows(state.selectedCountry);
  const availableYears = countryRows.map((item) => item.year);
  const missingMetrics = metrics.filter((metric) => !isFiniteNumber(row[metric.key]));

  els.country.textContent = row.country_name_ghg;
  els.region.textContent = row.region;
  els.year.textContent = row.year;
  els.populationValue.textContent = isFiniteNumber(row.population) ? compactNumber(row.population) : "No data";

  renderStatus(row);
  renderTrend(row);
  renderInsights(row);
  renderMetrics(row);

  const yearRange = `${Math.min(...availableYears)}-${Math.max(...availableYears)}`;
  const missingNote = missingMetrics.length
    ? ` Missing in this row: ${missingMetrics.map((metric) => metric.label).join(", ")}.`
    : "";
  els.cardNote.textContent = `Country coverage in df_panel.csv: ${yearRange}. Regional and global averages use all countries with data for ${row.year}.${missingNote}`;
}

function renderStatus(row) {
  const ghg = row.ghg_per_capita;
  const regionAverage = averageFor(row.year, row.region, "ghg_per_capita");
  const globalAverage = averageFor(row.year, null, "ghg_per_capita");

  if (!isFiniteNumber(ghg)) {
    els.statusLabel.textContent = "No emissions data";
    els.statusDetail.textContent = "Choose another available year for this country.";
    return;
  }

  const globalDelta = percentDifference(ghg, globalAverage);
  const regionDelta = percentDifference(ghg, regionAverage);
  els.statusLabel.textContent = describeEmissions(globalDelta);
  els.statusDetail.textContent = `${signedPercent(globalDelta)} vs global avg, ${signedPercent(regionDelta)} vs regional avg.`;
}

function renderTrend(row) {
  const width = 1040;
  const height = 430;
  const margin = { top: 42, right: 36, bottom: 64, left: 70 };
  const years = [...new Set(state.rows.map((item) => item.year))].sort((a, b) => a - b);
  const countryRows = getCountryRows(row.country_name_ghg);
  const series = years
    .map((year) => {
      const country = countryRows.find((item) => item.year === year)?.ghg_per_capita ?? null;
      const region = averageFor(year, row.region, "ghg_per_capita");
      const global = averageFor(year, null, "ghg_per_capita");
      return {
        year,
        country,
        region,
        global,
        countryDelta: percentDifference(country, region),
        globalDelta: percentDifference(global, region),
      };
    })
    .filter((item) => isFiniteNumber(item.countryDelta));
  const maxAbs = Math.max(
    20,
    ...series.flatMap((item) => [Math.abs(item.countryDelta), Math.abs(item.globalDelta || 0)])
  ) * 1.15;
  const chartWidth = width - margin.left - margin.right;
  const step = chartWidth / years.length;
  const barWidth = Math.min(56, step * 0.58);
  const x = (year) => {
    const index = years.indexOf(year);
    return margin.left + index * step + step / 2;
  };
  const y = (value) => {
    return margin.top + ((maxAbs - value) / (maxAbs * 2)) * (height - margin.top - margin.bottom);
  };
  const baseline = y(0);
  const ticks = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs];
  const grid = ticks
    .map((tick) => {
      const yPos = y(tick);
      return `
        <line class="trend-grid" x1="${margin.left}" y1="${yPos}" x2="${width - margin.right}" y2="${yPos}"></line>
        <text class="chart-tick" x="${margin.left - 12}" y="${yPos + 4}" text-anchor="end">${signedPercent(tick)}</text>
      `;
    })
    .join("");
  const bars = series
    .map((item) => {
      const isSelected = item.year === row.year;
      const top = Math.min(y(item.countryDelta), baseline);
      const heightValue = Math.abs(y(item.countryDelta) - baseline);
      const className = item.countryDelta >= 0 ? "gap-bar is-above" : "gap-bar is-below";
      const globalY = isFiniteNumber(item.globalDelta) ? y(item.globalDelta) : null;

      return `
        <rect class="${className}${isSelected ? " is-selected" : ""}" x="${round(x(item.year) - barWidth / 2)}" y="${round(top)}" width="${round(barWidth)}" height="${round(Math.max(2, heightValue))}" rx="7"></rect>
        ${globalY ? `<rect class="global-gap-marker" x="${round(x(item.year) - barWidth / 2)}" y="${round(globalY - 2)}" width="${round(barWidth)}" height="4" rx="2"></rect>` : ""}
        ${isSelected ? `<text class="selected-gap-label" x="${round(x(item.year))}" y="${item.countryDelta >= 0 ? round(top - 10) : round(top + heightValue + 20)}" text-anchor="middle">${signedPercent(item.countryDelta)}</text>` : ""}
      `;
    })
    .join("");
  const yearLabels = years
    .filter((year, index) => index === 0 || index === years.length - 1 || year === row.year)
    .map((year) => `<text class="chart-tick" x="${round(x(year))}" y="${height - 18}" text-anchor="middle">${year}</text>`)
    .join("");

  els.trendChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(row.country_name_ghg)} yearly emissions gap versus regional average">
      ${grid}
      <line class="gap-baseline" x1="${margin.left}" y1="${baseline}" x2="${width - margin.right}" y2="${baseline}"></line>
      ${bars}
      ${yearLabels}
      <text class="chart-note" x="${margin.left}" y="22">Country GHG per capita gap versus regional average</text>
      <text class="chart-note" x="${width - margin.right}" y="22" text-anchor="end">Gold hash = global average gap</text>
    </svg>
    <div class="chart-legend" aria-hidden="true">
      <span><i class="above-swatch"></i>Above region</span>
      <span><i class="below-swatch"></i>Below region</span>
      <span><i class="global-swatch"></i>Global avg</span>
    </div>
  `;
}

function renderInsights(row) {
  const countryRows = getCountryRows(row.country_name_ghg)
    .filter((item) => isFiniteNumber(item.ghg_per_capita) && item.year <= row.year)
    .sort((a, b) => a.year - b.year);
  const firstRow = countryRows[0];
  const trendDelta = firstRow ? percentDifference(row.ghg_per_capita, firstRow.ghg_per_capita) : null;
  const regionGhg = averageFor(row.year, row.region, "ghg_per_capita");
  const globalGhg = averageFor(row.year, null, "ghg_per_capita");
  const totalRegion = averageFor(row.year, row.region, "ghg_total_mt");
  const gdpRegion = averageFor(row.year, row.region, "gdp_per_capita_ppp");

  const insights = [
    {
      title: "Intensity",
      body: isFiniteNumber(globalGhg)
        ? `${row.country_name_ghg} is ${signedPercent(percentDifference(row.ghg_per_capita, globalGhg))} relative to the global average for emissions per person.`
        : "There is not enough global comparison data for this year.",
    },
    {
      title: "Direction",
      body: isFiniteNumber(trendDelta)
        ? `Since ${firstRow.year}, emissions per person have ${trendDelta <= 0 ? "fallen" : "risen"} by ${formatNumber(Math.abs(trendDelta), 0)}%.`
        : "The time series is too short to describe a direction.",
    },
    {
      title: "Scale",
      body: isFiniteNumber(row.ghg_total_mt) && isFiniteNumber(totalRegion)
        ? `Its total footprint is ${signedPercent(percentDifference(row.ghg_total_mt, totalRegion))} versus the regional average, while GDP per person is ${signedPercent(percentDifference(row.gdp_per_capita_ppp, gdpRegion))}.`
        : "Total footprint or GDP comparison data is missing for this row.",
    },
  ];

  els.insightList.innerHTML = insights
    .map((insight) => {
      return `
        <article class="insight">
          <strong>${escapeHtml(insight.title)}</strong>
          <p>${escapeHtml(insight.body)}</p>
        </article>
      `;
    })
    .join("");
}

function renderMetrics(row) {
  const width = 1220;
  const height = 700;
  const centerX = 500;
  const centerY = 365;
  const radius = 250;
  const profileMetrics = metrics.map((metric, index) => {
    const regionAverage = averageFor(row.year, row.region, metric.key);
    const globalAverage = averageFor(row.year, null, metric.key);
    const countryRatio = ratioToRegion(row[metric.key], regionAverage);
    const globalRatio = ratioToRegion(globalAverage, regionAverage);
    return {
      ...metric,
      angle: -Math.PI / 2 + index * ((Math.PI * 2) / metrics.length),
      countryValue: row[metric.key],
      regionValue: regionAverage,
      globalValue: globalAverage,
      countryRatio,
      regionRatio: 1,
      globalRatio,
    };
  });
  const maxRatio = Math.max(
    1.28,
    ...profileMetrics.flatMap((metric) => [metric.countryRatio, metric.globalRatio].filter(isFiniteNumber))
  ) * 1.02;
  const scaleRatio = (ratio) => {
    if (!isFiniteNumber(ratio)) return 0;
    return Math.min(ratio, maxRatio) / maxRatio;
  };
  const pointsFor = (key) => {
    return profileMetrics
      .map((metric) => {
        const point = polarPoint(metric.angle, scaleRatio(metric[key]) * radius, centerX, centerY);
        return `${point.x},${point.y}`;
      })
      .join(" ");
  };
  const rings = [0.5, 1, maxRatio]
    .map((ratio) => {
      const points = profileMetrics
        .map((metric) => {
          const point = polarPoint(metric.angle, scaleRatio(ratio) * radius, centerX, centerY);
          return `${point.x},${point.y}`;
        })
        .join(" ");
      const label = ratio === 1 ? "Region = 100%" : "";
      const labelPoint = polarPoint(-Math.PI / 2, scaleRatio(ratio) * radius, centerX, centerY);
      return `
        <polygon class="${ratio === 1 ? "profile-baseline-ring" : "profile-ring"}" points="${points}"></polygon>
        ${label ? `<text class="profile-ring-label" x="${labelPoint.x + 18}" y="${labelPoint.y + 6}">${label}</text>` : ""}
      `;
    })
    .join("");
  const axes = profileMetrics
    .map((metric) => {
      const end = polarPoint(metric.angle, radius + 18, centerX, centerY);
      return `<line class="profile-axis-spoke" x1="${centerX}" y1="${centerY}" x2="${end.x}" y2="${end.y}"></line>`;
    })
    .join("");
  const calloutPositions = [
    { x: centerX, y: 44, anchor: "middle" },
    { x: 770, y: 565, anchor: "start" },
    { x: 82, y: 565, anchor: "start" },
  ];
  const callouts = profileMetrics
    .map((metric, index) => {
      const position = calloutPositions[index];
      const delta = percentDifference(metric.countryValue, metric.regionValue);
      return `
        <g class="profile-callout">
          <text class="profile-axis-label" x="${position.x}" y="${position.y}" text-anchor="${position.anchor}">${escapeHtml(metric.label)}</text>
          <text class="profile-axis-value" x="${position.x}" y="${position.y + 34}" text-anchor="${position.anchor}">${safeFormat(metric, metric.countryValue)}</text>
          <text class="${metric.higherIs === "risk" && delta > 0 ? "profile-axis-delta is-high" : "profile-axis-delta"}" x="${position.x}" y="${position.y + 62}" text-anchor="${position.anchor}">${signedPercent(delta)} vs region</text>
        </g>
      `;
    })
    .join("");
  const vertices = profileMetrics
    .map((metric) => {
      const point = polarPoint(metric.angle, scaleRatio(metric.countryRatio) * radius, centerX, centerY);
      return `
        <circle class="profile-vertex-halo" cx="${point.x}" cy="${point.y}" r="12"></circle>
        <circle class="profile-vertex" cx="${point.x}" cy="${point.y}" r="5"></circle>
      `;
    })
    .join("");

  els.metricList.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(row.country_name_ghg)} indexed triangular profile for emissions intensity, wealth, and total footprint">
      <defs>
        <radialGradient id="profileGlow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stop-color="#d9674f" stop-opacity="0.1"></stop>
          <stop offset="100%" stop-color="#d9674f" stop-opacity="0"></stop>
        </radialGradient>
      </defs>
      <circle class="profile-glow" cx="${centerX}" cy="${centerY}" r="${radius + 8}"></circle>
      ${rings}
      ${axes}
      ${callouts}
      <polygon class="profile-area-global" points="${pointsFor("globalRatio")}"></polygon>
      <polygon class="profile-area-region" points="${pointsFor("regionRatio")}"></polygon>
      <polygon class="profile-area-country" points="${pointsFor("countryRatio")}"></polygon>
      ${vertices}
      <g class="profile-radar-legend" transform="translate(850 165)">
        <text class="reading-title" x="0" y="0">How to read</text>
        <text class="reading-copy" x="0" y="36">Every axis is indexed to the regional average.</text>
        <text class="reading-copy" x="0" y="66">Outside green = above region.</text>
        <text class="reading-copy" x="0" y="96">Inside green = below region.</text>
        <rect class="legend-line country" x="0" y="144" width="46" height="6" rx="3"></rect>
        <text class="reading-copy" x="62" y="151">${escapeHtml(row.country_name_ghg)}</text>
        <rect class="legend-line region" x="0" y="182" width="46" height="6" rx="3"></rect>
        <text class="reading-copy" x="62" y="189">Region avg</text>
        <rect class="legend-line global" x="0" y="220" width="46" height="6" rx="3"></rect>
        <text class="reading-copy" x="62" y="227">Global avg</text>
      </g>
    </svg>
  `;
}

function populateCountries() {
  renderCountryOptions("");
}

function renderCountryOptions(query) {
  const cleanQuery = query.trim().toLowerCase();
  const matches = state.countries
    .filter((country) => {
      return (
        !cleanQuery ||
        country.name.toLowerCase().includes(cleanQuery) ||
        country.iso3.toLowerCase().includes(cleanQuery)
      );
    });

  els.countryOptions.innerHTML = matches.length
    ? matches
        .map((country) => {
          const selected = country.name === state.selectedCountry ? " is-selected" : "";
          return `
            <button class="country-option${selected}" type="button" role="option" data-country="${escapeHtml(country.name)}" aria-selected="${selected ? "true" : "false"}">
              <span>${escapeHtml(country.name)}</span>
              <small>${escapeHtml(country.iso3)}</small>
            </button>
          `;
        })
        .join("")
    : `<div class="country-option is-empty">No matching country</div>`;
}

function openCountryMenu() {
  state.countryMenuOpen = true;
  els.countryInput.setAttribute("aria-expanded", "true");
  els.countryOptions.classList.add("is-open");
}

function closeCountryMenu() {
  state.countryMenuOpen = false;
  els.countryInput.setAttribute("aria-expanded", "false");
  els.countryOptions.classList.remove("is-open");
}

function firstVisibleCountry() {
  return els.countryOptions.querySelector("[data-country]")?.dataset.country || "";
}

function renderYearOptions(query) {
  const cleanQuery = query.trim();
  const matches = state.availableYears.filter((year) => !cleanQuery || String(year).includes(cleanQuery));

  els.yearOptions.innerHTML = matches.length
    ? matches
        .map((year) => {
          const selected = year === state.selectedYear ? " is-selected" : "";
          return `
            <button class="year-option${selected}" type="button" role="option" data-year="${year}" aria-selected="${selected ? "true" : "false"}">
              <span>${year}</span>
            </button>
          `;
        })
        .join("")
    : `<div class="year-option is-empty">No matching year</div>`;
}

function openYearMenu() {
  state.yearMenuOpen = true;
  els.yearInput.setAttribute("aria-expanded", "true");
  els.yearOptions.classList.add("is-open");
}

function closeYearMenu() {
  state.yearMenuOpen = false;
  els.yearInput.setAttribute("aria-expanded", "false");
  els.yearOptions.classList.remove("is-open");
}

function firstVisibleYear() {
  const year = els.yearOptions.querySelector("[data-year]")?.dataset.year;
  return year ? Number(year) : null;
}

function resolveYear(value) {
  const year = Number(String(value).trim());
  return state.availableYears.includes(year) ? year : null;
}

function getCountries(rows) {
  const countries = new Map();
  rows.forEach((row) => {
    if (!countries.has(row.country_name_ghg)) {
      countries.set(row.country_name_ghg, {
        name: row.country_name_ghg,
        iso3: row.iso3,
      });
    }
  });
  return [...countries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getCountryRows(countryName) {
  return state.rows.filter((row) => row.country_name_ghg === countryName);
}

function resolveCountryName(input) {
  const cleanInput = input.trim().toLowerCase();
  const match = state.countries.find((country) => {
    return country.name.toLowerCase() === cleanInput || country.iso3.toLowerCase() === cleanInput;
  });
  return match?.name || "";
}

function pickInitialCountry(countries, preferredName) {
  return countries.find((country) => country.name === preferredName)?.name || countries[0]?.name || "";
}

function averageFor(year, region, key) {
  const values = state.rows
    .filter((row) => row.year === year && (!region || row.region === region))
    .map((row) => row[key])
    .filter(isFiniteNumber);

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratioToRegion(value, regionAverage) {
  if (!isFiniteNumber(value) || !isFiniteNumber(regionAverage) || regionAverage === 0) return null;
  return value / regionAverage;
}

function polarPoint(angle, distance, centerX, centerY) {
  return {
    x: round(centerX + Math.cos(angle) * distance),
    y: round(centerY + Math.sin(angle) * distance),
  };
}

function coerceRow(row) {
  return {
    ...row,
    year: Number(row.year),
    ghg_per_capita: parseValue(row.ghg_per_capita),
    gdp_per_capita_ppp: parseValue(row.gdp_per_capita_ppp),
    fossil_fuel_pct: parseValue(row.fossil_fuel_pct),
    population: parseValue(row.population),
    ghg_total_mt: parseValue(row.ghg_total_mt),
  };
}

function parseValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((values) => {
    return headers.reduce((entry, header, index) => {
      entry[header] = values[index] || "";
      return entry;
    }, {});
  });
}

function describeEmissions(delta) {
  if (!isFiniteNumber(delta)) return "Comparable profile";
  if (delta >= 25) return "High emitter";
  if (delta <= -25) return "Below-average emitter";
  return "Near global average";
}

function percentDifference(value, baseline) {
  if (!isFiniteNumber(value) || !isFiniteNumber(baseline) || baseline === 0) return null;
  return ((value - baseline) / baseline) * 100;
}

function signedPercent(value) {
  if (!isFiniteNumber(value)) return "No data";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 0)}%`;
}

function safeFormat(metric, value) {
  return isFiniteNumber(value) ? metric.format(value) : "no data";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char];
  });
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function formatNumber(value, digits) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function compactNumber(value) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
