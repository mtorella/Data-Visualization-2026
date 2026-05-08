"use strict";

const DATA_URL = "../df_panel.csv";
const YEAR_MAX = 2021;
const DEFAULT_YEAR = 2021;
const REGION_COLOR = {
  all: "#d8cfbf",
  "Europe & Central Asia": "#7bb3d4",
  "East Asia & Pacific": "#69c4a0",
  "North America": "#efbd52",
  "Middle East & North Africa": "#d98a73",
  "Latin America & Caribbean": "#9a82d8",
  "Sub-Saharan Africa": "#c99855",
  "South Asia": "#77c9d4",
};

const els = {
  yearSelect: document.querySelector("#year-select"),
  sortSelect: document.querySelector("#sort-select"),
  regionSelect: document.querySelector("#region-select"),
  coverageNote: document.querySelector("#coverage-note"),
  wall: document.querySelector("#wall"),
  compare: document.querySelector("#compare"),
};

const state = { rows: [], years: [], year: DEFAULT_YEAR, sort: "story", region: "All regions", selected: [] };

d3.csv(DATA_URL, coerce).then((rows) => {
  state.rows = rows.filter((d) => d.year <= YEAR_MAX && [d.ghg_per_capita, d.gdp_per_capita_ppp, d.renewable_pct, d.electricity_access_pct].every(Number.isFinite));
  state.years = [...new Set(state.rows.map((d) => d.year))].sort((a, b) => a - b);
  populateYears();
  populateRegions();
  bind();
  render();
});

function bind() {
  els.yearSelect.addEventListener("change", () => { state.year = +els.yearSelect.value; render(); });
  els.sortSelect.addEventListener("change", () => { state.sort = els.sortSelect.value; render(); });
  els.regionSelect.addEventListener("change", () => { state.region = els.regionSelect.value; render(); });
}

function populateYears() {
  els.yearSelect.innerHTML = state.years.map((year) => `<option value="${year}" ${year === state.year ? "selected" : ""}>${year}</option>`).join("");
}

function populateRegions() {
  const regions = ["All regions", ...new Set(state.rows.map((d) => d.region).filter(Boolean))];
  els.regionSelect.innerHTML = regions.map((region) => `<option value="${esc(region)}">${esc(region)}</option>`).join("");
}

function render() {
  const rows = filteredRows();
  const ranks = buildRanks(rows);
  const cards = rows.map((d) => decorate(d, ranks));
  cards.sort(sorter());
  els.coverageNote.textContent = `${cards.length} country passports shown for ${state.year}. Click any two to compare them side by side.`;
  drawWall(cards);
  drawCompare(cards);
}

function filteredRows() {
  return state.rows.filter((d) => d.year === state.year && (state.region === "All regions" || d.region === state.region));
}

function drawWall(cards) {
  const sel = d3.select(els.wall).selectAll(".passport").data(cards, (d) => d.iso3);
  const enter = sel.enter().append("article").attr("class", "passport");
  enter.merge(sel)
    .classed("is-selected", (d) => state.selected.includes(d.iso3))
    .html((d) => `
      <div class="passport-head">
        <div>
          <div class="passport-iso">${esc(d.iso3)}</div>
          <div class="passport-title">${esc(d.country_name_ghg)}</div>
        </div>
        <div class="passport-iso">${esc(d.region || "Region n/a")}</div>
      </div>
      <span class="story-tag" style="background:${tagBg(d.story)};color:${tagFg(d.story)}">${esc(storyLabel(d.story))}</span>
      <div class="passport-band" style="width:${35 + d.gdpRank * 65}%"></div>
      <div class="passport-grid">
        <div><span class="mini-label">GHG</span><span class="mini-value">${fmt(d.ghg_per_capita, 1)} t</span></div>
        <div><span class="mini-label">GDP</span><span class="mini-value">$${fmt(d.gdp_per_capita_ppp, 0)}</span></div>
        <div><span class="mini-label">Access</span><span class="mini-value">${fmt(d.electricity_access_pct, 1)}%</span></div>
        <div><span class="mini-label">Renewables</span><span class="mini-value">${fmt(d.renewable_pct, 1)}%</span></div>
      </div>
      <div class="seal" style="background:${REGION_COLOR[d.region] || "#7bb3d4"}">${Math.round(d.renewable_pct)}%</div>
    `)
    .on("click", (_, d) => {
      if (state.selected.includes(d.iso3)) {
        state.selected = state.selected.filter((iso) => iso !== d.iso3);
      } else if (state.selected.length < 2) {
        state.selected = [...state.selected, d.iso3];
      } else {
        state.selected = [state.selected[1], d.iso3];
      }
      render();
    });
  sel.exit().remove();
}

function drawCompare(cards) {
  const chosen = state.selected.map((iso) => cards.find((d) => d.iso3 === iso)).filter(Boolean);
  if (!chosen.length) {
    els.compare.innerHTML = `<div class="compare-card"><p>Select up to two passports to compare narrative identities, not just raw values.</p></div>`;
    return;
  }
  els.compare.innerHTML = chosen.map((d) => `
    <div class="compare-card">
      <h3>${esc(d.country_name_ghg)}</h3>
      <p>${esc(d.note)}</p>
      <p><strong>GHG:</strong> ${fmt(d.ghg_per_capita, 1)} t</p>
      <p><strong>GDP:</strong> $${fmt(d.gdp_per_capita_ppp, 0)}</p>
      <p><strong>Access:</strong> ${fmt(d.electricity_access_pct, 1)}%</p>
      <p><strong>Renewables:</strong> ${fmt(d.renewable_pct, 1)}%</p>
    </div>
  `).join("");
}

function decorate(d, ranks) {
  const clean = 1 - pct(ranks.ghg, d.ghg_per_capita);
  const gdpRank = pct(ranks.gdp, d.gdp_per_capita_ppp);
  const renRank = pct(ranks.renewable, d.renewable_pct);
  const access = d.electricity_access_pct / 100;
  const transition = avg([clean, gdpRank, renRank, access]);
  const constraint = avg([clean, 1 - gdpRank, 1 - access]);
  const burden = avg([1 - clean, gdpRank]);
  const story = burden > 0.62 ? "burden" : transition >= constraint ? "transition" : "constraint";
  const note = story === "transition"
    ? "This passport reads as lower-carbon with stronger supporting conditions."
    : story === "constraint"
      ? "This passport looks light partly because capacity or electricity access remain weaker."
      : "This passport combines wealth with relatively heavy per-person emissions.";
  return { ...d, story, note, gdpRank, renRank };
}

function sorter() {
  if (state.sort === "ghg") return (a, b) => d3.descending(a.ghg_per_capita, b.ghg_per_capita);
  if (state.sort === "renewable") return (a, b) => d3.descending(a.renewable_pct, b.renewable_pct);
  if (state.sort === "access") return (a, b) => d3.descending(a.electricity_access_pct, b.electricity_access_pct);
  return (a, b) => storyOrder(a.story) - storyOrder(b.story) || a.country_name_ghg.localeCompare(b.country_name_ghg);
}

function buildRanks(rows) {
  return {
    ghg: rows.map((d) => d.ghg_per_capita).sort(d3.ascending),
    gdp: rows.map((d) => d.gdp_per_capita_ppp).sort(d3.ascending),
    renewable: rows.map((d) => d.renewable_pct).sort(d3.ascending),
  };
}
function storyOrder(s) { return ({ transition: 0, constraint: 1, burden: 2 })[s] ?? 9; }
function storyLabel(s) { return ({ transition: "Transition", constraint: "Constraint", burden: "Carbon-heavy" })[s]; }
function tagBg(s) { return ({ transition: "#d8efe7", constraint: "#f4dfd4", burden: "#f1e6c9" })[s]; }
function tagFg(s) { return ({ transition: "#1f6d61", constraint: "#9e563f", burden: "#7f5f1b" })[s]; }
function pct(sorted, value) { return d3.bisectLeft(sorted, value) / Math.max(sorted.length - 1, 1); }
function avg(arr) { return d3.mean(arr) || 0; }
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
  };
}
