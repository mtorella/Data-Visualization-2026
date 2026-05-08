"use strict";

const DATA_URL = "../df_panel.csv";
const YEAR_MAX = 2021;
const DEFAULT_YEAR = 2021;
const DEFAULT_ISO = "NOR";
const REGION_COLOR = {
  "Europe & Central Asia": "#7db9de",
  "East Asia & Pacific": "#6bc9a8",
  "North America": "#efbd52",
  "Middle East & North Africa": "#de866b",
  "Latin America & Caribbean": "#9a82d8",
  "Sub-Saharan Africa": "#c99855",
  "South Asia": "#77c9d4",
};

const els = {
  yearSelect: document.querySelector("#year-select"),
  lensSlider: document.querySelector("#lens-slider"),
  lensNote: document.querySelector("#lens-note"),
  countrySelect: document.querySelector("#country-select"),
  coverageNote: document.querySelector("#coverage-note"),
  chart: document.querySelector("#chart"),
  detail: document.querySelector("#detail"),
};

const state = { rows: [], years: [], year: DEFAULT_YEAR, lens: 60, iso: DEFAULT_ISO };

const tooltip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0).style("pointer-events", "none");

d3.csv(DATA_URL, coerce).then((rows) => {
  state.rows = rows.filter((d) => d.year <= YEAR_MAX && [d.ghg_per_capita, d.gdp_per_capita_ppp, d.renewable_pct, d.electricity_access_pct, d.ghg_total_mt].every(Number.isFinite));
  state.years = [...new Set(state.rows.map((d) => d.year))].sort((a, b) => a - b);
  if (!state.years.includes(state.year)) state.year = state.years.at(-1);
  populateYears();
  populateCountries();
  bind();
  render();
});

function bind() {
  els.yearSelect.addEventListener("change", () => { state.year = Number(els.yearSelect.value); populateCountries(); render(); });
  els.lensSlider.addEventListener("input", () => { state.lens = Number(els.lensSlider.value); render(); });
  els.countrySelect.addEventListener("change", () => { state.iso = els.countrySelect.value; render(); });
}

function populateYears() {
  els.yearSelect.innerHTML = state.years.map((year) => `<option value="${year}" ${year === state.year ? "selected" : ""}>${year}</option>`).join("");
}

function populateCountries() {
  const rows = rowsInYear().sort((a, b) => a.country_name_ghg.localeCompare(b.country_name_ghg));
  if (!rows.some((d) => d.iso3 === state.iso)) state.iso = rows[0]?.iso3 || "";
  els.countrySelect.innerHTML = rows.map((d) => `<option value="${d.iso3}" ${d.iso3 === state.iso ? "selected" : ""}>${esc(d.country_name_ghg)}</option>`).join("");
}

function render() {
  const rows = rowsInYear();
  const ranks = buildRanks(rows);
  const nodes = rows.map((d) => buildNode(d, ranks));
  els.coverageNote.textContent = `${nodes.length} countries have the full four-variable ladder profile in ${state.year}. Renewable coverage drops after 2021, so this concept stays inside 2014–2021.`;
  els.lensNote.textContent = lensNote(state.lens);
  draw(nodes);
  renderDetail(nodes);
}

function draw(nodes) {
  const width = 1240;
  const height = 860;
  const svg = d3.select(els.chart).html("").append("svg").attr("viewBox", `0 0 ${width} ${height}`);
  const x1 = 280, y1 = 760, x2 = 960, y2 = 120;
  const railGap = 120;

  svg.append("line").attr("class", "ladder-rail").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2);
  svg.append("line").attr("class", "ladder-rail").attr("x1", x1 + railGap).attr("y1", y1).attr("x2", x2 + railGap).attr("y2", y2);

  const rungs = d3.range(0, 1.01, 0.1);
  svg.selectAll(".ladder-rung")
    .data(rungs)
    .join("line")
    .attr("class", "ladder-rung")
    .attr("x1", (d) => lerp(x1, x2, d))
    .attr("y1", (d) => lerp(y1, y2, d))
    .attr("x2", (d) => lerp(x1 + railGap, x2 + railGap, d))
    .attr("y2", (d) => lerp(y1, y2, d));

  const zones = [
    { x: 110, y: 650, w: 330, h: 140, fill: "#f3d9c9", label: "Low by Constraint" },
    { x: 430, y: 350, w: 350, h: 150, fill: "#efe7cf", label: "Mixed Profiles" },
    { x: 800, y: 120, w: 310, h: 140, fill: "#d6efe9", label: "Transition with Capacity" },
  ];
  svg.selectAll(".ladder-zone")
    .data(zones)
    .join("rect")
    .attr("class", "ladder-zone")
    .attr("x", (d) => d.x)
    .attr("y", (d) => d.y)
    .attr("width", (d) => d.w)
    .attr("height", (d) => d.h)
    .attr("rx", 40)
    .attr("fill", (d) => d.fill);
  svg.selectAll(".zone-label")
    .data(zones)
    .join("text")
    .attr("class", "zone-label")
    .attr("x", (d) => d.x + 22)
    .attr("y", (d) => d.y + 38)
    .text((d) => d.label);

  svg.append("text").attr("class", "guide-note").attr("x", 980).attr("y", 105).text("Stronger access, renewables, and capacity");
  svg.append("text").attr("class", "guide-note").attr("x", 120).attr("y", 810).text("Low emissions can still rest on weaker access or capacity");

  nodes.forEach((d) => {
    const t = d.level;
    const leftX = lerp(x1, x2, t);
    const rightX = lerp(x1 + railGap, x2 + railGap, t);
    d.x = lerp(leftX, rightX, d.shift);
    d.y = lerp(y1, y2, t);
  });

  const group = svg.append("g");
  group.selectAll(".country-dot")
    .data(nodes)
    .join("circle")
    .attr("class", "country-dot")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", (d) => 5 + d.totalRank * 13)
    .attr("fill", (d) => d.iso3 === state.iso ? "#d3a856" : (REGION_COLOR[d.region] || "#98b5c9"))
    .attr("opacity", 0.86)
    .on("mouseenter", (event, d) => {
      state.iso = d.iso3;
      els.countrySelect.value = d.iso3;
      renderDetail(nodes);
      tooltip.style("opacity", 1).html(`<strong>${esc(d.country_name_ghg)}</strong><p>${esc(d.summary)}</p>`);
    })
    .on("mousemove", (event) => tooltip.style("left", `${event.clientX + 16}px`).style("top", `${event.clientY + 16}px`))
    .on("mouseleave", () => tooltip.style("opacity", 0))
    .on("click", (_, d) => { state.iso = d.iso3; els.countrySelect.value = d.iso3; render(); });

  group.selectAll(".country-label")
    .data(nodes.filter((d) => d.iso3 === state.iso || d.level > 0.78 || d.level < 0.16))
    .join("text")
    .attr("class", "country-label")
    .attr("x", (d) => d.x + 10)
    .attr("y", (d) => d.y - 10)
    .text((d) => d.iso3);
}

function renderDetail(nodes) {
  const d = nodes.find((row) => row.iso3 === state.iso) || nodes[0];
  if (!d) return;
  els.detail.innerHTML = `
    <div class="detail-card">
      <h3>${esc(d.country_name_ghg)}</h3>
      <p>${esc(d.summary)}</p>
      <div class="metric-grid">
        <div><span class="metric-label">GHG per capita</span><span class="metric-value">${fmt(d.ghg_per_capita, 1)} t</span></div>
        <div><span class="metric-label">GDP per capita</span><span class="metric-value">$${fmt(d.gdp_per_capita_ppp, 0)}</span></div>
        <div><span class="metric-label">Electricity access</span><span class="metric-value">${fmt(d.electricity_access_pct, 1)}%</span></div>
        <div><span class="metric-label">Renewable share</span><span class="metric-value">${fmt(d.renewable_pct, 1)}%</span></div>
      </div>
    </div>
  `;
}

function buildNode(d, ranks) {
  const clean = 1 - pct(ranks.ghg, d.ghg_per_capita);
  const gdp = pct(ranks.gdp, d.gdp_per_capita_ppp);
  const access = d.electricity_access_pct / 100;
  const ren = pct(ranks.renewable, d.renewable_pct);
  const totalRank = pct(ranks.total, d.ghg_total_mt);
  const transition = avg([clean, gdp, access, ren]);
  const constraint = avg([clean, 1 - gdp, 1 - access]);
  const level = clamp(transition * 0.75 + clean * 0.25, 0.04, 0.96);
  const shift = clamp(0.5 + ((transition * state.lens / 100) - (constraint * (1 - state.lens / 100))) * 0.9, 0.05, 0.95);
  const summary = transition >= constraint
    ? "This country climbs as a cleaner transition case because low emissions are reinforced by access, capacity, or renewable strength."
    : "This country stays on the ladder, but its low-carbon reading is pulled back by weaker access or lower economic capacity.";
  return { ...d, totalRank, level, shift, summary };
}

function buildRanks(rows) {
  return {
    ghg: rows.map((d) => d.ghg_per_capita).sort(d3.ascending),
    gdp: rows.map((d) => d.gdp_per_capita_ppp).sort(d3.ascending),
    renewable: rows.map((d) => d.renewable_pct).sort(d3.ascending),
    total: rows.map((d) => d.ghg_total_mt).sort(d3.ascending),
  };
}

function rowsInYear() { return state.rows.filter((d) => d.year === state.year); }
function pct(sorted, value) { return clamp(d3.bisectLeft(sorted, value) / Math.max(sorted.length - 1, 1), 0, 1); }
function avg(arr) { return d3.mean(arr) || 0; }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmt(v, d) { return d3.format(`,.${d}f`)(v); }
function lensNote(v) { return v < 35 ? "The lens is skeptical: countries need strong access and capacity to climb convincingly." : v > 65 ? "The lens is optimistic: renewable progress and broad access are rewarded more strongly." : "The lens is balanced between caution and optimism."; }
function esc(v) { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function coerce(d) {
  return {
    iso3: d.iso3,
    country_name_ghg: d.country_name_ghg,
    region: d.region,
    year: +d.year,
    ghg_per_capita: num(d.ghg_per_capita),
    gdp_per_capita_ppp: num(d.gdp_per_capita_ppp),
    renewable_pct: num(d.renewable_pct),
    electricity_access_pct: num(d.electricity_access_pct),
    ghg_total_mt: num(d.ghg_total_mt),
  };
}
function num(v) { return v === "" ? NaN : +v; }
