const DATA_URL = "../../data/df_panel.csv";
const DEFAULT_YEAR = 2021;
const MAX_COUNTRIES = 4;

const palette = ["#d9674f", "#1f6b57", "#d7a944", "#3f7da8"];

const metrics = {
  ghg: {
    key: "ghg_per_capita",
    label: "GHG per capita",
    unit: "t CO2e / person",
    format: (value) => `${formatNumber(value, 1)} t`,
  },
  gdp: {
    key: "gdp_per_capita_ppp",
    label: "GDP per capita",
    unit: "current international $",
    format: (value) => `$${formatNumber(value, 0)}`,
  },
  renewables: {
    key: "renewable_pct",
    label: "Renewables",
    unit: "% of final energy use",
    format: (value) => `${formatNumber(value, 1)}%`,
  },
  access: {
    key: "electricity_access_pct",
    label: "Electricity access",
    unit: "% of population",
    format: (value) => `${formatNumber(value, 1)}%`,
  },
};

const els = {
  yearSelect: document.querySelector("#year-select"),
  countryGrid: document.querySelector("#country-grid"),
  chart: document.querySelector("#fingerprint-chart"),
  coverageNote: document.querySelector("#coverage-note"),
  detailPanel: document.querySelector("#detail-panel"),
};

const state = {
  rows: [],
  years: [],
  countries: [],
  selectedYear: DEFAULT_YEAR,
  selectedCountries: ["Italy", "Denmark", "Estonia", "Germany"],
};

d3.csv(DATA_URL, coerceRow).then((rows) => {
  state.rows = rows;
  state.years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
  state.countries = getCountries(rows);
  populateYears();
  renderCountryChips();
  render();
});

els.yearSelect.addEventListener("change", () => {
  state.selectedYear = Number(els.yearSelect.value);
  renderCountryChips();
  render();
});

els.countryGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-country]");
  if (!button) return;

  const country = button.dataset.country;
  if (state.selectedCountries.includes(country)) {
    state.selectedCountries = state.selectedCountries.filter((item) => item !== country);
  } else if (state.selectedCountries.length < MAX_COUNTRIES) {
    state.selectedCountries = [...state.selectedCountries, country];
  } else {
    state.selectedCountries = [...state.selectedCountries.slice(1), country];
  }

  renderCountryChips();
  render();
});

function populateYears() {
  els.yearSelect.innerHTML = state.years
    .map((year) => `<option value="${year}" ${year === state.selectedYear ? "selected" : ""}>${year}</option>`)
    .join("");
}

function renderCountryChips() {
  const rowsForYear = rowsInYear(state.selectedYear);
  const completeCountries = state.countries
    .map((country) => {
      const row = rowsForYear.find((item) => item.country_name_ghg === country.name);
      const complete = row && Object.values(metrics).every((metric) => Number.isFinite(row[metric.key]));
      return { ...country, complete };
    })
    .sort((a, b) => Number(b.complete) - Number(a.complete) || a.name.localeCompare(b.name));

  els.countryGrid.innerHTML = completeCountries
    .slice(0, 32)
    .map((country) => {
      const selectedIndex = state.selectedCountries.indexOf(country.name);
      const selected = selectedIndex >= 0;
      const color = selected ? palette[selectedIndex] : "#fffdf8";
      return `
        <button
          class="country-chip ${selected ? "is-selected" : ""}"
          style="--chip-color: ${color}"
          type="button"
          data-country="${escapeHtml(country.name)}"
          title="${country.complete ? "Complete four-variable data" : "Has missing values for this year"}"
        >
          ${escapeHtml(country.name)}
        </button>
      `;
    })
    .join("");
}

function render() {
  const yearRows = rowsInYear(state.selectedYear);
  const completeCount = yearRows.filter((row) => Object.values(metrics).every((metric) => Number.isFinite(row[metric.key]))).length;
  els.coverageNote.textContent = `${completeCount} countries have complete four-variable data in ${state.selectedYear}. The constellation still plots countries with GDP and GHG data, while missing rings show data gaps.`;

  const selectedRows = state.selectedCountries
    .map((country) => yearRows.find((row) => row.country_name_ghg === country))
    .filter(Boolean);

  renderChart(yearRows, selectedRows);
  renderDetails(selectedRows, yearRows);
}

function renderChart(yearRows, selectedRows) {
  const width = 1160;
  const height = 760;
  const margin = { top: 78, right: 64, bottom: 92, left: 96 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const plottedRows = yearRows.filter((row) => {
    return Number.isFinite(row[metrics.gdp.key]) && Number.isFinite(row[metrics.ghg.key]) && row[metrics.gdp.key] > 0;
  });

  const xExtent = d3.extent(plottedRows, (row) => row[metrics.gdp.key]);
  const yMax = d3.max(plottedRows, (row) => row[metrics.ghg.key]) || 1;
  const globalMedianGdp = d3.median(plottedRows, (row) => row[metrics.gdp.key]);
  const globalMedianGhg = d3.median(plottedRows, (row) => row[metrics.ghg.key]);

  const x = d3.scaleLog()
    .domain([Math.max(300, xExtent[0] || 300), xExtent[1] || 100000])
    .range([margin.left, margin.left + plotWidth])
    .nice();

  const y = d3.scaleLinear()
    .domain([0, yMax * 1.08])
    .range([margin.top + plotHeight, margin.top])
    .nice();

  const renewableScale = d3.scaleLinear()
    .domain([0, 100])
    .range([0, Math.PI * 2])
    .clamp(true);

  const selectedLookup = new Set(selectedRows.map((row) => row.country_name_ghg));
  const selectedData = selectedRows
    .filter((row) => Number.isFinite(row[metrics.gdp.key]) && Number.isFinite(row[metrics.ghg.key]) && row[metrics.gdp.key] > 0)
    .map((row, index) => ({
      row,
      color: palette[index],
      anchorX: x(row[metrics.gdp.key]),
      anchorY: y(row[metrics.ghg.key]),
      x: x(row[metrics.gdp.key]),
      y: y(row[metrics.ghg.key]),
      index,
    }));

  d3.forceSimulation(selectedData)
    .force("x", d3.forceX((d) => d.anchorX).strength(0.22))
    .force("y", d3.forceY((d) => d.anchorY).strength(0.22))
    .force("collide", d3.forceCollide(72).iterations(3))
    .stop()
    .tick(220);

  selectedData.forEach((d) => {
    d.x = clamp(d.x, margin.left + 66, margin.left + plotWidth - 66);
    d.y = clamp(d.y, margin.top + 66, margin.top + plotHeight - 66);
  });

  const svg = d3.select(els.chart)
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `Climate constellation comparing ${state.selectedCountries.join(", ")} in ${state.selectedYear}`);

  const defs = svg.append("defs");
  const glow = defs.append("filter")
    .attr("id", "planet-glow")
    .attr("x", "-70%")
    .attr("y", "-70%")
    .attr("width", "240%")
    .attr("height", "240%");

  glow.append("feGaussianBlur")
    .attr("stdDeviation", 7)
    .attr("result", "blur");
  glow.append("feColorMatrix")
    .attr("in", "blur")
    .attr("type", "matrix")
    .attr("values", "1 0 0 0 0.85  0 1 0 0 0.34  0 0 1 0 0.24  0 0 0 0.55 0")
    .attr("result", "glow");
  glow.append("feMerge")
    .call((merge) => {
      merge.append("feMergeNode").attr("in", "glow");
      merge.append("feMergeNode").attr("in", "SourceGraphic");
    });

  const plot = svg.append("g").attr("class", "constellation-plot");

  plot.append("rect")
    .attr("class", "plot-sky")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", plotWidth)
    .attr("height", plotHeight)
    .attr("rx", 22);

  plot.append("rect")
    .attr("class", "target-zone")
    .attr("x", x(globalMedianGdp))
    .attr("y", y(globalMedianGhg))
    .attr("width", margin.left + plotWidth - x(globalMedianGdp))
    .attr("height", margin.top + plotHeight - y(globalMedianGhg))
    .attr("rx", 18);

  plot.append("text")
    .attr("class", "target-label")
    .attr("x", x(globalMedianGdp) + 20)
    .attr("y", margin.top + plotHeight - 24)
    .text("preferred direction: higher wealth, lower emissions");

  const xAxis = d3.axisBottom(x)
    .tickValues([1000, 5000, 20000, 80000])
    .tickFormat((value) => `$${d3.format("~s")(value).replace("G", "B")}`);

  const yAxis = d3.axisLeft(y)
    .ticks(5)
    .tickFormat((value) => `${value} t`);

  plot.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0 ${margin.top + plotHeight})`)
    .call(xAxis);

  plot.append("g")
    .attr("class", "axis y-axis")
    .attr("transform", `translate(${margin.left} 0)`)
    .call(yAxis);

  plot.append("line")
    .attr("class", "median-line")
    .attr("x1", x(globalMedianGdp))
    .attr("x2", x(globalMedianGdp))
    .attr("y1", margin.top)
    .attr("y2", margin.top + plotHeight);

  plot.append("line")
    .attr("class", "median-line")
    .attr("x1", margin.left)
    .attr("x2", margin.left + plotWidth)
    .attr("y1", y(globalMedianGhg))
    .attr("y2", y(globalMedianGhg));

  plot.append("text")
    .attr("class", "axis-title x-title")
    .attr("x", margin.left + plotWidth / 2)
    .attr("y", height - 28)
    .attr("text-anchor", "middle")
    .text("GDP per capita PPP");

  plot.append("text")
    .attr("class", "axis-title y-title")
    .attr("x", -margin.top - plotHeight / 2)
    .attr("y", 34)
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .text("GHG per capita");

  plot.append("text")
    .attr("class", "quadrant-label high-emission")
    .attr("x", margin.left + 22)
    .attr("y", margin.top + 32)
    .text("higher emissions intensity");

  plot.append("text")
    .attr("class", "quadrant-label high-wealth")
    .attr("x", margin.left + plotWidth - 22)
    .attr("y", margin.top + plotHeight - 22)
    .attr("text-anchor", "end")
    .text("higher economic capacity");

  plot.append("g")
    .attr("class", "star-field")
    .selectAll("circle")
    .data(plottedRows.filter((row) => !selectedLookup.has(row.country_name_ghg)))
    .join("circle")
    .attr("cx", (row) => x(row[metrics.gdp.key]))
    .attr("cy", (row) => y(row[metrics.ghg.key]))
    .attr("r", (row) => backgroundRadius(row))
    .attr("fill", (row) => backgroundColor(row, globalMedianGdp, globalMedianGhg))
    .attr("opacity", 0.46);

  plot.append("g")
    .attr("class", "planet-tethers")
    .selectAll("line")
    .data(selectedData)
    .join("line")
    .attr("x1", (d) => d.anchorX)
    .attr("y1", (d) => d.anchorY)
    .attr("x2", (d) => d.x)
    .attr("y2", (d) => d.y);

  plot.append("g")
    .attr("class", "planet-anchors")
    .selectAll("circle")
    .data(selectedData)
    .join("circle")
    .attr("cx", (d) => d.anchorX)
    .attr("cy", (d) => d.anchorY)
    .attr("r", 5)
    .attr("fill", (d) => d.color);

  const planet = plot.append("g")
    .attr("class", "selected-planets")
    .selectAll("g")
    .data(selectedData)
    .join("g")
    .attr("class", "planet")
    .attr("transform", (d) => `translate(${d.x} ${d.y})`);

  planet.append("circle")
    .attr("class", "planet-shadow")
    .attr("r", 46)
    .attr("fill", (d) => d.color);

  planet.append("circle")
    .attr("class", "planet-access-track")
    .attr("r", 36);

  planet.append("path")
    .attr("class", (d) => `planet-access ${Number.isFinite(d.row[metrics.access.key]) ? "" : "is-missing"}`)
    .attr("d", (d) => accessArc(d.row[metrics.access.key], 36))
    .attr("stroke", "#d7a944");

  planet.append("circle")
    .attr("class", "planet-core")
    .attr("r", 20)
    .attr("fill", (d) => d.color);

  planet.append("path")
    .attr("class", (d) => `planet-renewable ${Number.isFinite(d.row[metrics.renewables.key]) ? "" : "is-missing"}`)
    .attr("d", (d) => renewableArc(d.row[metrics.renewables.key], renewableScale))
    .attr("stroke", "#1f6b57");

  planet.append("circle")
    .attr("class", "planet-dot")
    .attr("r", 5);

  planet.append("line")
    .attr("class", "planet-label-line")
    .attr("x1", 28)
    .attr("x2", (d) => labelOffset(d).x - 8)
    .attr("y1", -24)
    .attr("y2", (d) => labelOffset(d).y + 2);

  const label = planet.append("g")
    .attr("class", "planet-label")
    .attr("transform", (d) => `translate(${labelOffset(d).x} ${labelOffset(d).y})`);

  label.append("text")
    .attr("class", "planet-country")
    .text((d) => d.row.country_name_ghg);

  label.append("text")
    .attr("class", "planet-values")
    .attr("y", 20)
    .text((d) => `${metrics.ghg.format(d.row[metrics.ghg.key])} / ${metrics.gdp.format(d.row[metrics.gdp.key])}`);

  label.append("text")
    .attr("class", "planet-values")
    .attr("y", 38)
    .text((d) => `${formatRingValue("renewables", d.row)} renewables, ${formatRingValue("access", d.row)} access`);

  drawGlyphLegend(svg, width);
}

function drawGlyphLegend(svg, width) {
  const legend = svg.append("g")
    .attr("class", "glyph-legend")
    .attr("transform", `translate(${width - 350} 26)`);

  legend.append("rect")
    .attr("width", 312)
    .attr("height", 150)
    .attr("rx", 18);

  legend.append("text")
    .attr("class", "legend-title")
    .attr("x", 18)
    .attr("y", 30)
    .text("How to read the planet");

  const items = [
    { color: "#d9674f", text: "position = GDP x emissions" },
    { color: "#1f6b57", text: "green orbit = renewables" },
    { color: "#d7a944", text: "gold halo = electricity access" },
    { color: "#61706c", text: "dotted tether = true position" },
  ];

  legend.selectAll(".legend-item")
    .data(items)
    .join("g")
    .attr("class", "legend-item")
    .attr("transform", (d, index) => `translate(18 ${56 + index * 24})`)
    .call((groups) => {
      groups.append("circle")
        .attr("r", 6)
        .attr("fill", (d) => d.color);

      groups.append("text")
        .attr("x", 16)
        .attr("y", 5)
        .text((d) => d.text);
    });
}

function renderDetails(rows, yearRows) {
  const plottedRows = yearRows.filter((row) => {
    return Number.isFinite(row[metrics.gdp.key]) && Number.isFinite(row[metrics.ghg.key]) && row[metrics.gdp.key] > 0;
  });
  const medianGdp = d3.median(plottedRows, (row) => row[metrics.gdp.key]);
  const medianGhg = d3.median(plottedRows, (row) => row[metrics.ghg.key]);

  els.detailPanel.innerHTML = rows.map((row, index) => {
    const reading = countryReading(row, medianGdp, medianGhg);
    const values = Object.values(metrics).map((metric) => {
      return `<p>${escapeHtml(metric.label)}: <strong>${Number.isFinite(row[metric.key]) ? metric.format(row[metric.key]) : "No data"}</strong></p>`;
    }).join("");

    return `
      <article class="detail-card" style="border-color: ${palette[index]}">
        <strong style="color: ${palette[index]}">${escapeHtml(row.country_name_ghg)}</strong>
        <p class="detail-reading">${escapeHtml(reading)}</p>
        ${values}
      </article>
    `;
  }).join("");
}

function countryReading(row, medianGdp, medianGhg) {
  const highGdp = row[metrics.gdp.key] >= medianGdp;
  const highGhg = row[metrics.ghg.key] >= medianGhg;
  const access = row[metrics.access.key];
  const renewables = row[metrics.renewables.key];

  if (highGdp && !highGhg) return "Strong signal: wealth with below-median emissions intensity.";
  if (highGdp && highGhg) return "Risk signal: high economic capacity paired with high emissions intensity.";
  if (!highGdp && !highGhg && Number.isFinite(access) && access < 90) return "Caution: low emissions may partly reflect limited electricity access.";
  if (!highGdp && !highGhg) return "Lower-intensity profile, but with less economic capacity.";
  if (Number.isFinite(renewables) && renewables > 50) return "Transition signal: high emissions, but renewables are relatively prominent.";
  return "Development tension: lower wealth with above-median emissions intensity.";
}

function backgroundRadius(row) {
  if (!Number.isFinite(row[metrics.access.key])) return 2.5;
  return d3.scaleLinear().domain([0, 100]).range([2.4, 5.8]).clamp(true)(row[metrics.access.key]);
}

function backgroundColor(row, medianGdp, medianGhg) {
  const highGdp = row[metrics.gdp.key] >= medianGdp;
  const highGhg = row[metrics.ghg.key] >= medianGhg;
  if (highGdp && !highGhg) return "#1f6b57";
  if (highGdp && highGhg) return "#d9674f";
  if (!highGdp && !highGhg) return "#3f7da8";
  return "#d7a944";
}

function accessArc(value, radius) {
  const fraction = Number.isFinite(value) ? d3.scaleLinear().domain([0, 100]).range([0.02, 1]).clamp(true)(value) : 0.2;
  return d3.arc()
    .innerRadius(radius - 4)
    .outerRadius(radius + 4)
    .startAngle(-Math.PI / 2)
    .endAngle(-Math.PI / 2 + fraction * Math.PI * 2)
    .cornerRadius(8)();
}

function renewableArc(value, scale) {
  const endAngle = Number.isFinite(value) ? scale(value) : Math.PI * 0.45;
  return d3.arc()
    .innerRadius(26)
    .outerRadius(31)
    .startAngle(-Math.PI / 2)
    .endAngle(-Math.PI / 2 + Math.max(0.12, endAngle))
    .cornerRadius(8)();
}

function labelOffset(d) {
  const side = d.x > 760 ? -1 : 1;
  const lift = d.y < 210 ? 64 : -48;
  return { x: side * 58, y: lift };
}

function formatRingValue(key, row) {
  const metric = metrics[key];
  return Number.isFinite(row[metric.key]) ? metric.format(row[metric.key]) : "no data";
}

function rowsInYear(year) {
  return state.rows.filter((row) => row.year === year);
}

function getCountries(rows) {
  const seen = new Map();
  rows.forEach((row) => {
    if (!seen.has(row.country_name_ghg)) {
      seen.set(row.country_name_ghg, { name: row.country_name_ghg, iso3: row.iso3 });
    }
  });
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function coerceRow(row) {
  return {
    ...row,
    year: Number(row.year),
    ghg_per_capita: parseValue(row.ghg_per_capita),
    gdp_per_capita_ppp: parseValue(row.gdp_per_capita_ppp),
    renewable_pct: parseValue(row.renewable_pct),
    electricity_access_pct: parseValue(row.electricity_access_pct),
  };
}

function parseValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
