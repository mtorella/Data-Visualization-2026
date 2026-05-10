"use strict";

const DATA_URL = "../../data/df_panel.csv";
const YEAR_MAX = 2021;
const DEFAULT_YEAR = 2021;
const DEFAULT_ISO = "KEN";
const REGION_COLOR = {
  "Europe & Central Asia": "#7bb3d4",
  "East Asia & Pacific": "#6bc9a8",
  "North America": "#efbd52",
  "Middle East & North Africa": "#d98a73",
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

const state = { rows: [], years: [], year: DEFAULT_YEAR, lens: 52, iso: DEFAULT_ISO };

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
  els.yearSelect.addEventListener("change", () => { state.year = +els.yearSelect.value; populateCountries(); render(); });
  els.lensSlider.addEventListener("input", () => { state.lens = +els.lensSlider.value; render(); });
  els.countrySelect.addEventListener("change", () => { state.iso = els.countrySelect.value; render(); });
}
function populateYears() { els.yearSelect.innerHTML = state.years.map((y) => `<option value="${y}" ${y === state.year ? "selected" : ""}>${y}</option>`).join(""); }
function populateCountries() {
  const rows = yearRows().sort((a, b) => a.country_name_ghg.localeCompare(b.country_name_ghg));
  if (!rows.some((d) => d.iso3 === state.iso)) state.iso = rows[0]?.iso3 || "";
  els.countrySelect.innerHTML = rows.map((d) => `<option value="${d.iso3}" ${d.iso3 === state.iso ? "selected" : ""}>${esc(d.country_name_ghg)}</option>`).join("");
}

function render() {
  const rows = yearRows();
  const ranks = buildRanks(rows);
  const nodes = rows.map((d) => decorate(d, ranks));
  els.coverageNote.textContent = `${nodes.length} walkers balance on the rope in ${state.year}. Drag the lens to shift what counts as a convincing low-carbon position.`;
  els.lensNote.textContent = state.lens < 35 ? "The lens is stricter about access and capacity." : state.lens > 65 ? "The lens is more willing to credit renewable and lower-carbon progress." : "The lens is balanced between the two readings.";
  draw(nodes);
  renderDetail(nodes);
}

function draw(nodes) {
  const width = 1220;
  const height = 760;
  const svg = d3.select(els.chart).html("").append("svg").attr("viewBox", `0 0 ${width} ${height}`);
  const xLeft = 120, xRight = 1100, ropeY = 170;
  const sagScale = d3.scaleLinear().domain(d3.extent(nodes, (d) => d.ghg_per_capita)).range([70, 360]);

  const line = d3.line().curve(d3.curveBasis);
  const ropePoints = d3.range(0, 1.01, 0.1).map((t) => [lerp(xLeft, xRight, t), ropeY + Math.sin(t * Math.PI) * 42]);
  svg.append("path").attr("class", "rope").attr("d", line(ropePoints));
  svg.append("rect").attr("class", "pole").attr("x", 92).attr("y", 140).attr("width", 18).attr("height", 500).attr("rx", 8);
  svg.append("rect").attr("class", "pole").attr("x", 1110).attr("y", 140).attr("width", 18).attr("height", 500).attr("rx", 8);
  svg.append("text").attr("class", "pole-label").attr("x", 62).attr("y", 118).text("Low by necessity");
  svg.append("text").attr("class", "pole-label").attr("x", 915).attr("y", 118).text("Transition with capacity");

  nodes.forEach((d) => {
    const t = d.balance;
    const x = lerp(xLeft, xRight, t);
    const yRope = ropeY + Math.sin(t * Math.PI) * 42;
    d.x = x;
    d.y = yRope + sagScale(d.ghg_per_capita);
  });

  const g = svg.append("g");
  const walkers = g.selectAll(".walker").data(nodes).join("g").attr("transform", (d) => `translate(${d.x} ${d.y})`);
  walkers.append("line").attr("class", "walker-stick").attr("x1", 0).attr("y1", -42).attr("x2", 0).attr("y2", -8);
  walkers.append("line").attr("class", "walker-stick").attr("x1", 0).attr("y1", -26).attr("x2", (d) => -8 - d.tilt).attr("y2", -12);
  walkers.append("line").attr("class", "walker-stick").attr("x1", 0).attr("y1", -26).attr("x2", (d) => 8 + d.tilt).attr("y2", -12);
  walkers.append("line").attr("class", "walker-stick").attr("x1", 0).attr("y1", -8).attr("x2", -10).attr("y2", 10);
  walkers.append("line").attr("class", "walker-stick").attr("x1", 0).attr("y1", -8).attr("x2", 10).attr("y2", 10);
  walkers.append("circle")
    .attr("class", "walker-body")
    .attr("cy", -54)
    .attr("r", (d) => 5 + d.totalRank * 12)
    .attr("fill", (d) => d.iso3 === state.iso ? "#d0a34f" : (REGION_COLOR[d.region] || "#7bb3d4"))
    .on("mouseenter", (_, d) => { state.iso = d.iso3; els.countrySelect.value = d.iso3; renderDetail(nodes); })
    .on("click", (_, d) => { state.iso = d.iso3; els.countrySelect.value = d.iso3; render(); });

  g.selectAll(".walker-label")
    .data(nodes.filter((d) => d.iso3 === state.iso || d.balance < 0.12 || d.balance > 0.88))
    .join("text")
    .attr("class", "walker-label")
    .attr("x", (d) => d.x + 10)
    .attr("y", (d) => d.y - 64)
    .text((d) => d.iso3);
}

function renderDetail(nodes) {
  const d = nodes.find((row) => row.iso3 === state.iso) || nodes[0];
  if (!d) return;
  els.detail.innerHTML = `
    <div class="detail-card">
      <h3>${esc(d.country_name_ghg)}</h3>
      <p>${esc(d.note)}</p>
      <p><strong>Balance:</strong> ${Math.round(d.balance * 100)} / 100 toward transition</p>
      <p><strong>GHG per capita:</strong> ${fmt(d.ghg_per_capita, 1)} t</p>
      <p><strong>Access:</strong> ${fmt(d.electricity_access_pct, 1)}%</p>
      <p><strong>Renewables:</strong> ${fmt(d.renewable_pct, 1)}%</p>
    </div>
  `;
}

function decorate(d, ranks) {
  const clean = 1 - pct(ranks.ghg, d.ghg_per_capita);
  const gdp = pct(ranks.gdp, d.gdp_per_capita_ppp);
  const ren = pct(ranks.renewable, d.renewable_pct);
  const access = d.electricity_access_pct / 100;
  const leftPull = avg([clean, 1 - gdp, 1 - access]);
  const rightPull = avg([clean, ren, access, gdp]);
  const lens = state.lens / 100;
  const balance = clamp(0.5 + (rightPull * lens - leftPull * (1 - lens)) * 0.9, 0.02, 0.98);
  const totalRank = pct(ranks.total, d.ghg_total_mt);
  const tilt = (ren - 0.5) * 14;
  const note = balance > 0.5
    ? "The walker leans toward a transition reading because cleaner performance is supported by access, renewables, or income."
    : "The walker stays closer to the necessity side because low emissions are less strongly backed by access or capacity.";
  return { ...d, balance, totalRank, tilt, note };
}

function buildRanks(rows) {
  return {
    ghg: rows.map((d) => d.ghg_per_capita).sort(d3.ascending),
    gdp: rows.map((d) => d.gdp_per_capita_ppp).sort(d3.ascending),
    renewable: rows.map((d) => d.renewable_pct).sort(d3.ascending),
    total: rows.map((d) => d.ghg_total_mt).sort(d3.ascending),
  };
}
function yearRows() { return state.rows.filter((d) => d.year === state.year); }
function pct(sorted, value) { return d3.bisectLeft(sorted, value) / Math.max(sorted.length - 1, 1); }
function avg(arr) { return d3.mean(arr) || 0; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function fmt(v, d) { return d3.format(`,.${d}f`)(v); }
function esc(v) { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function num(v) { return v === "" ? NaN : +v; }
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
