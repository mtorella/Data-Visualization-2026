"use strict";

const DATA_URL = "../../data/df_panel.csv";
const DEFAULT_YEAR = 2021;
const MAX_COUNTRIES = 4;

const countryPalette = ["#d9674f", "#1f6b57", "#d7a944", "#3f7da8"];

const poles = [
  {
    id: "emissions",
    key: "ghg_per_capita",
    label: "Carbon pressure",
    note: "high GHG per person",
    color: "#d9674f",
    format: (value) => `${fmtN(value, 1)} t`,
    score: (row, ranks) => percentile(ranks.ghg_per_capita, row.ghg_per_capita),
  },
  {
    id: "capacity",
    key: "gdp_per_capita_ppp",
    label: "Capacity to act",
    note: "high GDP per person",
    color: "#3f7da8",
    format: (value) => `$${fmtN(value, 0)}`,
    score: (row, ranks) => percentile(ranks.gdp_per_capita_ppp, row.gdp_per_capita_ppp),
  },
  {
    id: "renewable_gap",
    key: "renewable_pct",
    label: "Renewable gap",
    note: "larger when renewable share is lower",
    color: "#1f6b57",
    format: (value) => `${fmtN(value, 1)}% renewables`,
    score: (row, ranks) => {
      const renewableRank = percentile(ranks.renewable_pct, row.renewable_pct);
      return Number.isFinite(renewableRank) ? 1 - renewableRank : null;
    },
  },
  {
    id: "access_gap",
    key: "electricity_access_pct",
    label: "Energy access gap",
    note: "larger when electricity access is lower",
    color: "#d7a944",
    format: (value) => `${fmtN(value, 1)}%`,
    score: (row) => Number.isFinite(row.electricity_access_pct) ? 1 - row.electricity_access_pct / 100 : null,
  },
];

const els = {
  yearSelect: document.querySelector("#year-select"),
  countryGrid: document.querySelector("#country-grid"),
  chart: document.querySelector("#pressure-field"),
  coverageNote: document.querySelector("#coverage-note"),
  detailPanel: document.querySelector("#detail-panel"),
  poleLegend: document.querySelector("#pole-legend"),
};

const state = {
  rows: [],
  years: [],
  countries: [],
  selectedYear: DEFAULT_YEAR,
  selectedCountries: ["Italy", "Denmark", "Estonia", "Germany"],
};

const tip = d3.select("body")
  .append("div")
  .attr("class", "field-tooltip")
  .style("opacity", 0)
  .style("pointer-events", "none");

d3.csv(DATA_URL, coerceRow).then((rows) => {
  state.rows = rows;
  state.years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
  state.countries = getCountries(rows);
  populateYears();
  renderCountryChips();
  renderLegend();
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
  const yearRows = rowsInYear(state.selectedYear);
  const chips = state.countries
    .map((country) => {
      const row = yearRows.find((item) => item.country_name_ghg === country.name);
      const complete = row && poles.every((pole) => Number.isFinite(row[pole.key]));
      return { ...country, complete };
    })
    .sort((a, b) => Number(b.complete) - Number(a.complete) || a.name.localeCompare(b.name));

  els.countryGrid.innerHTML = chips.map((country) => {
    const index = state.selectedCountries.indexOf(country.name);
    const selected = index >= 0;
    return `
      <button
        class="country-chip ${selected ? "is-selected" : ""}"
        style="--chip-color:${selected ? countryPalette[index] : "#fffdf8"}"
        type="button"
        data-country="${escHtml(country.name)}"
        title="${country.complete ? "Complete four-variable data" : "One or more dimensions missing this year"}"
      >
        ${escHtml(country.name)}
      </button>
    `;
  }).join("");
}

function renderLegend() {
  els.poleLegend.innerHTML = poles.map((pole) => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${pole.color}"></span>
      <span class="legend-name">${escHtml(pole.label)}</span>
      <span class="legend-note">${escHtml(pole.note)}</span>
    </div>
  `).join("");
}

function render() {
  const yearRows = rowsInYear(state.selectedYear);
  const completeCount = yearRows.filter((row) => poles.every((pole) => Number.isFinite(row[pole.key]))).length;
  els.coverageNote.textContent = `${completeCount} of ${yearRows.length} countries have complete four-variable data in ${state.selectedYear}. Missing values weaken that country's pull toward the affected pole.`;

  const ranks = buildRanks(yearRows);
  const nodes = buildNodes(yearRows, ranks);
  const selectedNodes = state.selectedCountries
    .map((country) => nodes.find((node) => node.country_name_ghg === country))
    .filter(Boolean);

  drawField(nodes, selectedNodes);
  renderDetails(selectedNodes);
}

function drawField(nodes, selectedNodes) {
  const width = 1180;
  const height = 880;
  const margin = 54;
  const center = { x: width / 2, y: height / 2 + 18 };
  const selectedSet = new Set(selectedNodes.map((node) => node.country_name_ghg));
  const polePositions = [
    { x: margin + 120, y: margin + 112 },
    { x: width - margin - 120, y: margin + 112 },
    { x: margin + 120, y: height - margin - 112 },
    { x: width - margin - 120, y: height - margin - 112 },
  ];

  poles.forEach((pole, index) => {
    pole.x = polePositions[index].x;
    pole.y = polePositions[index].y;
  });

  nodes.forEach((node, index) => {
    const target = targetFromScores(node, center);
    node.tx = target.x;
    node.ty = target.y;
    node.r = 4 + node.pressure * 16;
    node.x = target.x + Math.sin(index * 12.9898) * 22;
    node.y = target.y + Math.cos(index * 78.233) * 22;
  });

  d3.forceSimulation(nodes)
    .force("x", d3.forceX((node) => node.tx).strength(0.28))
    .force("y", d3.forceY((node) => node.ty).strength(0.28))
    .force("collide", d3.forceCollide((node) => node.r + (selectedSet.has(node.country_name_ghg) ? 10 : 2)).iterations(3))
    .stop()
    .tick(260);

  nodes.forEach((node) => {
    node.x = clamp(node.x, margin + node.r, width - margin - node.r);
    node.y = clamp(node.y, margin + node.r, height - margin - node.r);
  });

  const svg = d3.select(els.chart)
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `Climate pressure field for ${state.selectedYear}`);

  svg.append("rect")
    .attr("class", "field-bg")
    .attr("x", margin)
    .attr("y", margin)
    .attr("width", width - margin * 2)
    .attr("height", height - margin * 2)
    .attr("rx", 28);

  svg.append("circle")
    .attr("class", "pressure-vortex")
    .attr("cx", center.x)
    .attr("cy", center.y)
    .attr("r", 128);

  svg.selectAll(".pressure-ring")
    .data([190, 280, 370])
    .join("circle")
    .attr("class", "pressure-ring")
    .attr("cx", center.x)
    .attr("cy", center.y)
    .attr("r", (d) => d);

  svg.selectAll(".pole-ray")
    .data(poles)
    .join("line")
    .attr("class", "pole-ray")
    .attr("x1", center.x)
    .attr("y1", center.y)
    .attr("x2", (pole) => pole.x)
    .attr("y2", (pole) => pole.y)
    .attr("stroke", (pole) => pole.color);

  const pole = svg.selectAll(".pole")
    .data(poles)
    .join("g")
    .attr("class", "pole")
    .attr("transform", (d) => `translate(${d.x} ${d.y})`);

  pole.append("circle")
    .attr("class", "pole-node")
    .attr("r", 34)
    .attr("fill", (d) => d.color);

  pole.append("text")
    .attr("class", "pole-title")
    .attr("text-anchor", "middle")
    .attr("y", 58)
    .text((d) => d.label);

  pole.append("text")
    .attr("class", "pole-subtitle")
    .attr("text-anchor", "middle")
    .attr("y", 78)
    .text((d) => d.note);

  svg.append("text")
    .attr("class", "pole-title")
    .attr("text-anchor", "middle")
    .attr("x", center.x)
    .attr("y", center.y - 10)
    .text("compound");

  svg.append("text")
    .attr("class", "pole-subtitle")
    .attr("text-anchor", "middle")
    .attr("x", center.x)
    .attr("y", center.y + 12)
    .text("multiple pressures at once");

  const node = svg.append("g")
    .attr("class", "node-layer")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("class", (d) => `country-node ${selectedSet.has(d.country_name_ghg) ? "is-selected" : ""}`)
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", (d) => selectedSet.has(d.country_name_ghg) ? d.r + 6 : d.r)
    .attr("fill", (d) => d.dominant.color)
    .attr("opacity", (d) => selectedSet.has(d.country_name_ghg) ? 0.98 : 0.48)
    .on("mouseover", (event, d) => {
      d3.select(event.currentTarget)
        .attr("opacity", 1)
        .attr("stroke-width", 4);
      showTip(event, d);
    })
    .on("mousemove", moveTip)
    .on("mouseleave", (event, d) => {
      d3.select(event.currentTarget)
        .attr("opacity", selectedSet.has(d.country_name_ghg) ? 0.98 : 0.48)
        .attr("stroke-width", selectedSet.has(d.country_name_ghg) ? 4 : 1.4);
      hideTip();
    });

  node.append("title")
    .text((d) => `${d.country_name_ghg}: ${fmtN(d.pressure * 100, 0)} pressure`);

  const labels = svg.append("g")
    .attr("class", "label-layer")
    .selectAll("g")
    .data(selectedNodes)
    .join("g")
    .attr("transform", (d) => `translate(${d.x} ${d.y})`);

  labels.append("text")
    .attr("class", "country-label")
    .attr("x", 18)
    .attr("y", -14)
    .text((d) => d.country_name_ghg);

  labels.append("text")
    .attr("class", "country-score")
    .attr("x", 18)
    .attr("y", 4)
    .text((d) => `${fmtN(d.pressure * 100, 0)} pressure, ${d.dominant.label}`);
}

function targetFromScores(node, center) {
  const total = d3.sum(node.components, (component) => component.score);
  if (!total) return center;

  const emphasis = 2.2;
  const weightedTotal = d3.sum(node.components, (component) => Math.pow(component.score, emphasis));
  const x = d3.sum(node.components, (component) => Math.pow(component.score, emphasis) * component.pole.x) / weightedTotal;
  const y = d3.sum(node.components, (component) => Math.pow(component.score, emphasis) * component.pole.y) / weightedTotal;
  const dominance = node.dominant.score / total;
  const pressurePull = d3.scaleLinear().domain([0.25, 0.72]).range([0.52, 1.04]).clamp(true)(dominance);

  return {
    x: center.x + (x - center.x) * pressurePull,
    y: center.y + (y - center.y) * pressurePull,
  };
}

function renderDetails(nodes) {
  els.detailPanel.innerHTML = nodes.map((node, index) => {
    const color = countryPalette[index] || node.dominant.color;
    const values = poles.map((pole) => {
      const raw = Number.isFinite(node[pole.key]) ? pole.format(node[pole.key]) : "No data";
      const score = node.components.find((component) => component.id === pole.id)?.score || 0;
      return `<p>${escHtml(pole.label)}: <strong>${escHtml(raw)}</strong> <span>${fmtN(score * 100, 0)}/100</span></p>`;
    }).join("");

    return `
      <article class="detail-card" style="border-left:4px solid ${color}; border-color:${color}">
        <strong style="color:${color}">${escHtml(node.country_name_ghg)}</strong>
        <p class="profile-reading">${escHtml(profileReading(node))}</p>
        <p>Combined pressure: <strong>${fmtN(node.pressure * 100, 0)} / 100</strong></p>
        ${values}
      </article>
    `;
  }).join("");
}

function buildNodes(rows, ranks) {
  return rows
    .map((row) => {
      const components = poles.map((pole) => {
        const rawScore = pole.score(row, ranks);
        return {
          ...pole,
          pole,
          rawValue: row[pole.key],
          score: Number.isFinite(rawScore) ? rawScore : 0,
          missing: !Number.isFinite(row[pole.key]),
        };
      });
      const valid = components.filter((component) => !component.missing);
      const dominant = [...components].sort((a, b) => d3.descending(a.score, b.score))[0];

      return {
        ...row,
        components,
        dominant,
        pressure: valid.length ? d3.mean(valid, (component) => component.score) : 0,
        missingCount: components.filter((component) => component.missing).length,
      };
    })
    .filter((node) => node.components.some((component) => !component.missing));
}

function profileReading(node) {
  if (node.pressure >= 0.72) return `High compound pressure, led by ${node.dominant.label.toLowerCase()}.`;
  if (node.pressure >= 0.55) return `Mixed pressure profile, strongest pull is ${node.dominant.label.toLowerCase()}.`;
  return `Lower combined pressure; strongest visible pull is ${node.dominant.label.toLowerCase()}.`;
}

function showTip(event, node) {
  const lines = node.components.map((component) => {
    const raw = Number.isFinite(component.rawValue) ? component.format(component.rawValue) : "No data";
    return `${component.label}: ${raw} (${fmtN(component.score * 100, 0)}/100)`;
  }).join("<br>");

  tip.style("opacity", 1).html(`
    <div class="tt-country">${escHtml(node.country_name_ghg)}</div>
    <div class="tt-dominant" style="color:${node.dominant.color}">${escHtml(node.dominant.label)}</div>
    <div class="tt-score">${fmtN(node.pressure * 100, 0)} / 100</div>
    <div class="tt-note">${lines}</div>
  `);
  moveTip(event);
}

function moveTip(event) {
  tip.style("left", `${event.clientX + 16}px`).style("top", `${event.clientY - 10}px`);
}

function hideTip() {
  tip.style("opacity", 0);
}

function buildRanks(rows) {
  const ranks = {};
  poles.forEach((pole) => {
    ranks[pole.key] = rows
      .map((row) => row[pole.key])
      .filter(Number.isFinite)
      .sort(d3.ascending);
  });
  return ranks;
}

function percentile(values, value) {
  if (!Number.isFinite(value) || !values.length) return null;
  return d3.bisectRight(values, value) / values.length;
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
