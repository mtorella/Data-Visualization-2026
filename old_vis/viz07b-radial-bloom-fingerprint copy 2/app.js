"use strict";

const DATA_URL = "../../data/df_panel.csv";
const DEFAULT_YEAR = 2021;
const MAX_COUNTRIES = 4;

const countryPalette = ["#d9674f", "#1f6b57", "#d7a944", "#3f7da8"];

const variables = [
  {
    id: "emissions",
    key: "ghg_per_capita",
    label: "Emissions pressure",
    short: "GHG",
    color: "#d9674f",
    description: "higher GHG per person",
    format: (value) => `${fmtN(value, 1)} t`,
    score: (row, ranks) => percentileFromRanks(ranks.ghg_per_capita, row.ghg_per_capita),
  },
  {
    id: "capacity",
    key: "gdp_per_capita_ppp",
    label: "Economic capacity",
    short: "GDP",
    color: "#3f7da8",
    description: "higher GDP per person",
    format: (value) => `$${fmtN(value, 0)}`,
    score: (row, ranks) => percentileFromRanks(ranks.gdp_per_capita_ppp, row.gdp_per_capita_ppp),
  },
  {
    id: "access",
    key: "electricity_access_pct",
    label: "Energy access",
    short: "Access",
    color: "#d7a944",
    description: "more people connected to electricity",
    format: (value) => `${fmtN(value, 1)}%`,
    score: (row) => Number.isFinite(row.electricity_access_pct) ? row.electricity_access_pct / 100 : null,
  },
  {
    id: "renewable_gap",
    key: "renewable_pct",
    label: "Renewable gap",
    short: "Gap",
    valueLabel: "Renewable share",
    color: "#1f6b57",
    description: "larger when renewable share is lower",
    format: (value) => `${fmtN(value, 1)}% renewables`,
    score: (row, ranks) => {
      const renewableRank = percentileFromRanks(ranks.renewable_pct, row.renewable_pct);
      return Number.isFinite(renewableRank) ? 1 - renewableRank : null;
    },
  },
];

const els = {
  yearSelect: document.querySelector("#year-select"),
  countryGrid: document.querySelector("#country-grid"),
  chart: document.querySelector("#fingerprint-chart"),
  coverageNote: document.querySelector("#coverage-note"),
  detailPanel: document.querySelector("#detail-panel"),
  axisLegend: document.querySelector("#axis-legend"),
};

const state = {
  rows: [],
  years: [],
  countries: [],
  selectedYear: DEFAULT_YEAR,
  selectedCountries: ["Italy", "Denmark", "Estonia", "Germany"],
  activeVariable: null,
};

const tip = d3.select("body")
  .append("div")
  .attr("class", "fp-tooltip")
  .style("opacity", 0)
  .style("pointer-events", "none");

d3.csv(DATA_URL, coerceRow).then((rows) => {
  state.rows = rows;
  state.years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
  state.countries = getCountries(rows);
  buildAxisLegend();
  populateYears();
  renderChips();
  render();
});

els.yearSelect.addEventListener("change", () => {
  state.selectedYear = Number(els.yearSelect.value);
  renderChips();
  render();
});

els.countryGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-country]");
  if (!button) return;

  const name = button.dataset.country;
  if (state.selectedCountries.includes(name)) {
    state.selectedCountries = state.selectedCountries.filter((country) => country !== name);
  } else if (state.selectedCountries.length < MAX_COUNTRIES) {
    state.selectedCountries = [...state.selectedCountries, name];
  } else {
    state.selectedCountries = [...state.selectedCountries.slice(1), name];
  }

  renderChips();
  render();
});

els.axisLegend.addEventListener("click", (event) => {
  const button = event.target.closest("[data-variable]");
  if (!button) return;

  const variable = button.dataset.variable;
  state.activeVariable = variable === "all" || state.activeVariable === variable ? null : variable;
  buildAxisLegend();
  render();
});

function buildAxisLegend() {
  const allSelected = state.activeVariable === null;
  els.axisLegend.innerHTML = `
    <button class="dim-legend-row ${allSelected ? "is-active" : ""}" type="button" data-variable="all">
      <span class="dim-dot dim-dot-all"></span>
      <span>All signals</span>
      <span class="dim-note">full transition pressure stack</span>
    </button>
    ${variables.map((variable) => `
    <button class="dim-legend-row ${state.activeVariable === variable.id ? "is-active" : ""}" type="button" data-variable="${variable.id}">
      <span class="dim-dot" style="background:${variable.color}"></span>
      <span>${escHtml(variable.label)}</span>
      <span class="dim-note">${escHtml(variable.description)}</span>
    </button>
  `).join("")}`;
}

function populateYears() {
  els.yearSelect.innerHTML = state.years
    .map((year) => `<option value="${year}" ${year === state.selectedYear ? "selected" : ""}>${year}</option>`)
    .join("");
}

function renderChips() {
  const yearRows = rowsInYear(state.selectedYear);
  const chips = state.countries
    .map((country) => {
      const row = yearRows.find((item) => item.country_name_ghg === country.name);
      const complete = row && variables.every((variable) => Number.isFinite(row[variable.key]));
      return { ...country, complete };
    })
    .sort((a, b) => Number(b.complete) - Number(a.complete) || a.name.localeCompare(b.name));

  els.countryGrid.innerHTML = chips.map((country) => {
    const index = state.selectedCountries.indexOf(country.name);
    const selected = index >= 0;
    return `<button
      class="country-chip ${selected ? "is-selected" : ""}"
      style="--chip-color:${selected ? countryPalette[index] : "#fffdf8"}"
      type="button"
      data-country="${escHtml(country.name)}"
      title="${country.complete ? "Complete data for all four dimensions" : "One or more dimensions missing this year"}"
    >${escHtml(country.name)}</button>`;
  }).join("");
}

function render() {
  const yearRows = rowsInYear(state.selectedYear);
  const completeCount = yearRows.filter((row) => variables.every((variable) => Number.isFinite(row[variable.key]))).length;
  els.coverageNote.textContent =
    `${completeCount} of ${yearRows.length} countries have complete pressure-wheel data in ${state.selectedYear}.` +
    (state.selectedYear > 2021 ? " Renewable energy coverage drops sharply after 2021." : "");

  const ranks = buildRanks(yearRows);
  const wheelRows = buildPressureRows(yearRows, ranks);
  const activeVariable = getActiveVariable();
  const visibleRows = activeVariable
    ? [...wheelRows].sort((a, b) => d3.descending(componentScore(a, activeVariable.id), componentScore(b, activeVariable.id)) || a.country_name_ghg.localeCompare(b.country_name_ghg))
    : wheelRows;
  const selectedRows = state.selectedCountries
    .map((country) => visibleRows.find((row) => row.country_name_ghg === country))
    .filter(Boolean);

  drawChart(visibleRows, selectedRows);
  renderDetails(selectedRows);
}

function drawChart(rows, selectedRows) {
  const width = 1240;
  const height = 1220;
  const cx = width / 2;
  const cy = height / 2 + 34;
  const activeVariable = getActiveVariable();
  const visibleVariables = activeVariable ? [activeVariable] : variables;
  const maxSignalCount = activeVariable ? 1 : variables.length;
  const innerRadius = activeVariable ? 260 : 230;
  const segmentMax = activeVariable ? 226 : 58;
  const selectedSet = new Set(selectedRows.map((row) => row.country_name_ghg));

  const angle = d3.scaleBand()
    .domain(rows.map((row) => row.country_name_ghg))
    .range([0, Math.PI * 2])
    .align(0)
    .paddingInner(0.12);

  const arc = d3.arc()
    .startAngle((d) => angle(d.country) || 0)
    .endAngle((d) => (angle(d.country) || 0) + angle.bandwidth())
    .innerRadius((d) => d.r0)
    .outerRadius((d) => d.r1)
    .cornerRadius(2);

  const svg = d3.select(els.chart)
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `Transition pressure wheel for ${state.selectedYear}`);

  const defs = svg.append("defs");
  const glow = defs.append("filter")
    .attr("id", "selected-glow")
    .attr("x", "-60%")
    .attr("y", "-60%")
    .attr("width", "220%")
    .attr("height", "220%");
  glow.append("feGaussianBlur").attr("stdDeviation", 5).attr("result", "blur");
  glow.append("feMerge").call((merge) => {
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");
  });

  const wheel = svg.append("g")
    .attr("class", "pressure-wheel")
    .attr("transform", `translate(${cx} ${cy})`);

  wheel.append("circle")
    .attr("class", "wheel-core")
    .attr("r", innerRadius - 24);

  wheel.append("text")
    .attr("class", "wheel-title")
    .attr("text-anchor", "middle")
    .attr("y", -18)
    .text(activeVariable ? activeVariable.short : "Transition");

  wheel.append("text")
    .attr("class", "wheel-title")
    .attr("text-anchor", "middle")
    .attr("y", 20)
    .text(activeVariable ? "Only" : "Pressure");

  wheel.append("text")
    .attr("class", "wheel-subtitle")
    .attr("text-anchor", "middle")
    .attr("y", 54)
    .text(activeVariable ? "countries re-sorted by this signal" : "larger stack = stronger case for action");

  wheel.selectAll(".reference-ring")
    .data(activeVariable ? [0.25, 0.5, 0.75, 1] : [1, 2, 3, 4])
    .join("circle")
    .attr("class", "reference-ring")
    .attr("r", (d) => innerRadius + d * segmentMax);

  const segments = rows.flatMap((row) => {
    let r0 = innerRadius;
    return visibleVariables.map((variable) => row.components.find((component) => component.id === variable.id)).map((component) => {
      const thickness = component.score * segmentMax;
      const segment = {
        country: row.country_name_ghg,
        row,
        component,
        r0,
        r1: r0 + thickness,
        selected: selectedSet.has(row.country_name_ghg),
      };
      r0 += thickness;
      return segment;
    });
  });

  wheel.append("g")
    .attr("class", "pressure-bars")
    .selectAll("path")
    .data(segments)
    .join("path")
    .attr("class", (d) => `pressure-segment ${d.selected ? "is-selected" : ""} component-${d.component.id}`)
    .attr("d", arc)
    .attr("fill", (d) => d.component.color)
    .attr("opacity", (d) => d.selected ? 0.98 : 0.38)
    .attr("filter", (d) => d.selected ? "url(#selected-glow)" : null)
    .on("mouseover", (event, d) => {
      d3.select(event.currentTarget).attr("opacity", 1);
      showTip(event, d);
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      state.activeVariable = state.activeVariable === d.component.id ? null : d.component.id;
      hideTip();
      buildAxisLegend();
      render();
    })
    .on("mousemove", moveTip)
    .on("mouseleave", (event, d) => {
      d3.select(event.currentTarget).attr("opacity", d.selected ? 0.98 : 0.38);
      hideTip();
    });

  drawSelectedLabels(wheel, selectedRows, angle, innerRadius, segmentMax);
  drawTopPressureLabels(wheel, rows.slice(0, 8), angle, innerRadius, segmentMax, maxSignalCount);
  drawLegend(svg, activeVariable);
}

function drawSelectedLabels(wheel, selectedRows, angle, innerRadius, segmentMax) {
  const activeVariable = getActiveVariable();
  const minLabelRadius = innerRadius + (activeVariable ? 56 : segmentMax * 3.6);
  const maxLabelRadius = innerRadius + segmentMax * (activeVariable ? 1.12 : variables.length + 0.42);
  const lineGap = activeVariable ? 6 : 10;
  const labelGap = activeVariable ? 28 : 36;

  const labels = wheel.append("g")
    .attr("class", "selected-labels")
    .selectAll("g")
    .data(selectedRows)
    .join("g")
    .attr("transform", (row) => {
      const a = (angle(row.country_name_ghg) || 0) + angle.bandwidth() / 2;
      const point = polar(a, selectedLabelRadius(row, innerRadius, segmentMax, activeVariable, minLabelRadius, maxLabelRadius, labelGap));
      return `translate(${point.x} ${point.y})`;
    });

  labels.append("line")
    .attr("class", "label-tick")
    .attr("x1", (row) => {
      const a = midAngle(row, angle);
      const labelRadius = selectedLabelRadius(row, innerRadius, segmentMax, activeVariable, minLabelRadius, maxLabelRadius, labelGap);
      const lineStart = polar(a, selectedOuterRadius(row, innerRadius, segmentMax, activeVariable) + lineGap);
      const labelPoint = polar(a, labelRadius);
      return lineStart.x - labelPoint.x;
    })
    .attr("y1", (row) => {
      const a = midAngle(row, angle);
      const labelRadius = selectedLabelRadius(row, innerRadius, segmentMax, activeVariable, minLabelRadius, maxLabelRadius, labelGap);
      const lineStart = polar(a, selectedOuterRadius(row, innerRadius, segmentMax, activeVariable) + lineGap);
      const labelPoint = polar(a, labelRadius);
      return lineStart.y - labelPoint.y;
    })
    .attr("x2", 0)
    .attr("y2", 0)
    .attr("stroke", (row) => countryPalette[state.selectedCountries.indexOf(row.country_name_ghg)] || "#17211f");

  labels.append("text")
    .attr("class", "selected-country-label")
    .attr("text-anchor", (row) => labelAnchor(midAngle(row, angle)))
    .attr("x", (row) => labelAnchor(midAngle(row, angle)) === "start" ? 8 : -8)
    .attr("y", -6)
    .text((row) => row.country_name_ghg);

  labels.append("text")
    .attr("class", "selected-score-label")
    .attr("text-anchor", (row) => labelAnchor(midAngle(row, angle)))
    .attr("x", (row) => labelAnchor(midAngle(row, angle)) === "start" ? 8 : -8)
    .attr("y", 14)
    .text((row) => {
      const activeVariable = getActiveVariable();
      const score = activeVariable ? componentScore(row, activeVariable.id) : row.pressure;
      return `${fmtN(score * 100, 0)} ${activeVariable ? activeVariable.short : "pressure"}`;
    });
}

function drawTopPressureLabels(wheel, rows, angle, innerRadius, segmentMax, maxSignalCount) {
  wheel.append("g")
    .attr("class", "top-markers")
    .selectAll("circle")
    .data(rows)
    .join("circle")
    .attr("cx", (row) => polar(midAngle(row, angle), innerRadius + segmentMax * (maxSignalCount + 0.16)).x)
    .attr("cy", (row) => polar(midAngle(row, angle), innerRadius + segmentMax * (maxSignalCount + 0.16)).y)
    .attr("r", 5.5);
}

function drawLegend(svg, activeVariable) {
  const legend = svg.append("g")
    .attr("class", "wheel-legend")
    .attr("transform", "translate(56 54)");

  legend.append("text")
    .attr("class", "legend-title")
    .text(activeVariable ? "Active signal" : "Stack ingredients");

  legend.selectAll("g")
    .data(activeVariable ? [activeVariable] : variables)
    .join("g")
    .attr("class", "svg-legend-item")
    .attr("transform", (d, i) => `translate(0 ${30 + i * 28})`)
    .call((groups) => {
      groups.append("rect")
        .attr("width", 18)
        .attr("height", 12)
        .attr("rx", 3)
        .attr("fill", (d) => d.color);

      groups.append("text")
        .attr("x", 28)
        .attr("y", 11)
        .text((d) => d.label);
    });
}

function renderDetails(rows) {
  const activeVariable = getActiveVariable();
  els.detailPanel.innerHTML = rows.map((row) => {
    const visibleVariables = activeVariable ? [activeVariable] : variables;
    const values = visibleVariables.map((variable) => `
      <p>${escHtml(variable.valueLabel || variable.short)}:
        <strong>${Number.isFinite(row[variable.key]) ? variable.format(row[variable.key]) : "No data"}</strong>
      </p>
    `).join("");

    const color = countryPalette[state.selectedCountries.indexOf(row.country_name_ghg)] || "#17211f";
    return `<article class="detail-card" style="border-left:4px solid ${color}; border-color:${color}">
      <strong style="color:${color}">${escHtml(row.country_name_ghg)}</strong>
      <p class="pressure-reading">${pressureReading(row)}</p>
      <p>${activeVariable ? escHtml(activeVariable.label) : "Transition pressure"}: <strong>${fmtN((activeVariable ? componentScore(row, activeVariable.id) : row.pressure) * 100, 0)} / 100</strong></p>
      ${values}
    </article>`;
  }).join("");
}

function pressureReading(row) {
  if (row.pressure >= 0.72) return "High pressure profile: strong climate responsibility signal.";
  if (row.pressure >= 0.55) return "Medium pressure profile: mixed development and emissions signal.";
  return "Lower pressure profile: interpret carefully, especially if access or GDP is low.";
}

function buildPressureRows(yearRows, ranks) {
  return yearRows
    .map((row) => {
      const components = variables.map((variable) => {
        const rawScore = variable.score(row, ranks);
        return {
          ...variable,
          rawValue: row[variable.key],
          score: Number.isFinite(rawScore) ? Math.max(0.015, rawScore) : 0,
          missing: !Number.isFinite(row[variable.key]),
        };
      });
      const validScores = components.filter((component) => !component.missing).map((component) => component.score);
      return {
        ...row,
        components,
        pressure: validScores.length ? d3.mean(validScores) : 0,
        missingCount: components.filter((component) => component.missing).length,
      };
    })
    .filter((row) => row.components.some((component) => !component.missing))
    .sort((a, b) => d3.descending(a.pressure, b.pressure) || a.country_name_ghg.localeCompare(b.country_name_ghg));
}

function buildRanks(rows) {
  const ranks = {};
  variables.forEach((variable) => {
    ranks[variable.key] = rows
      .map((row) => row[variable.key])
      .filter(Number.isFinite)
      .sort(d3.ascending);
  });
  return ranks;
}

function percentileFromRanks(values, value) {
  if (!Number.isFinite(value) || !values.length) return null;
  return d3.bisectRight(values, value) / values.length;
}

function getActiveVariable() {
  return variables.find((variable) => variable.id === state.activeVariable) || null;
}

function componentScore(row, variableId) {
  const component = row.components.find((item) => item.id === variableId);
  return component ? component.score : 0;
}

function showTip(event, d) {
  const raw = d.component.missing ? "No data" : d.component.format(d.component.rawValue);
  const note = d.component.id === "renewable_gap"
    ? `Gap contribution: ${fmtN(d.component.score * 100, 0)} / 100`
    : `Segment contribution: ${fmtN(d.component.score * 100, 0)} / 100`;
  tip.style("opacity", 1).html(`
    <div class="fp-tt-country">${escHtml(d.country)}</div>
    <div class="fp-tt-dim" style="color:${d.component.color}">${escHtml(d.component.label)}</div>
    <div class="fp-tt-val">${escHtml(raw)}</div>
    <div class="fp-tt-note">${escHtml(note)}</div>
  `);
  moveTip(event);
}

function moveTip(event) {
  tip.style("left", `${event.clientX + 16}px`).style("top", `${event.clientY - 10}px`);
}

function hideTip() {
  tip.style("opacity", 0);
}

function selectedOuterRadius(row, innerRadius, segmentMax, activeVariable) {
  const totalScore = activeVariable
    ? componentScore(row, activeVariable.id)
    : row.components.reduce((sum, component) => sum + component.score, 0);
  return innerRadius + totalScore * segmentMax;
}

function selectedLabelRadius(row, innerRadius, segmentMax, activeVariable, minLabelRadius, maxLabelRadius, labelGap) {
  return clamp(
    selectedOuterRadius(row, innerRadius, segmentMax, activeVariable) + labelGap,
    minLabelRadius,
    maxLabelRadius
  );
}

function midAngle(row, angle) {
  return (angle(row.country_name_ghg) || 0) + angle.bandwidth() / 2;
}

function labelAnchor(angle) {
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
  return normalized > Math.PI ? "end" : "start";
}

function polar(angle, radius) {
  return {
    x: Math.sin(angle) * radius,
    y: -Math.cos(angle) * radius,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
    ghg_per_capita: parseVal(row.ghg_per_capita),
    gdp_per_capita_ppp: parseVal(row.gdp_per_capita_ppp),
    renewable_pct: parseVal(row.renewable_pct),
    electricity_access_pct: parseVal(row.electricity_access_pct),
  };
}

function parseVal(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function fmtN(value, digits) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function escHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]
  );
}
