"use strict";

const DATA_URL = "../df_panel.csv";
const YEAR_MIN = 2014;
const YEAR_MAX = 2021;
const DEFAULTS = ["NOR", "ITA", "KEN"];
const REGION_COLOR = {
  "Europe & Central Asia": "#86b8d5",
  "East Asia & Pacific": "#6bc9a8",
  "North America": "#efbd52",
  "Middle East & North Africa": "#d98a73",
  "Latin America & Caribbean": "#9a82d8",
  "Sub-Saharan Africa": "#c99855",
  "South Asia": "#77c9d4",
};

const els = {
  yearSlider: document.querySelector("#year-slider"),
  yearReadout: document.querySelector("#year-readout"),
  countryA: document.querySelector("#country-a"),
  countryB: document.querySelector("#country-b"),
  countryC: document.querySelector("#country-c"),
  coverageNote: document.querySelector("#coverage-note"),
  garden: document.querySelector("#garden"),
  detail: document.querySelector("#detail"),
};

const state = { rows: [], year: YEAR_MAX, countries: [...DEFAULTS] };

d3.csv(DATA_URL, coerce).then((rows) => {
  state.rows = rows.filter((d) => d.year >= YEAR_MIN && d.year <= YEAR_MAX && [d.ghg_per_capita, d.gdp_per_capita_ppp, d.renewable_pct, d.electricity_access_pct].every(Number.isFinite));
  populateCountries();
  bind();
  render();
});

function bind() {
  els.yearSlider.addEventListener("input", () => { state.year = +els.yearSlider.value; render(); });
  [els.countryA, els.countryB, els.countryC].forEach((el, index) => {
    el.addEventListener("change", () => { state.countries[index] = el.value; render(); });
  });
}

function populateCountries() {
  const countries = [...new Map(state.rows.map((d) => [d.iso3, d.country_name_ghg])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  [els.countryA, els.countryB, els.countryC].forEach((el, index) => {
    el.innerHTML = countries.map(([iso3, name]) => `<option value="${iso3}" ${iso3 === state.countries[index] ? "selected" : ""}>${esc(name)}</option>`).join("");
  });
}

function render() {
  const selected = state.countries.map((iso) => state.rows.find((d) => d.iso3 === iso && d.year === state.year)).filter(Boolean);
  els.coverageNote.textContent = "This concept focuses on fewer countries at a time so the audience can remember shape and change, not just compare raw numbers.";
  els.yearReadout.textContent = `Year ${state.year}. The same selected countries re-bloom as you scrub across 2014–2021.`;
  draw(selected);
  renderDetail(selected);
}

function draw(selected) {
  const width = 1240;
  const height = 760;
  const svg = d3.select(els.garden).html("").append("svg").attr("viewBox", `0 0 ${width} ${height}`);
  const centers = [{ x: 250, y: 420 }, { x: 620, y: 420 }, { x: 990, y: 420 }];

  svg.append("text").attr("class", "bloom-note").attr("x", 70).attr("y", 90).text("Petal length = GHG per capita");
  svg.append("text").attr("class", "bloom-note").attr("x", 70).attr("y", 110).text("Petal openness = electricity access");
  svg.append("text").attr("class", "bloom-note").attr("x", 70).attr("y", 130).text("Green filaments = renewable share");
  svg.append("text").attr("class", "bloom-note").attr("x", 70).attr("y", 150).text("Core size = GDP per capita");

  const yearRows = state.rows.filter((d) => d.year === state.year);
  const ranks = {
    ghg: yearRows.map((d) => d.ghg_per_capita).sort(d3.ascending),
    gdp: yearRows.map((d) => d.gdp_per_capita_ppp).sort(d3.ascending),
    renewable: yearRows.map((d) => d.renewable_pct).sort(d3.ascending),
  };

  selected.forEach((d, index) => {
    const cx = centers[index].x;
    const cy = centers[index].y;
    const ghgRank = pct(ranks.ghg, d.ghg_per_capita);
    const gdpRank = pct(ranks.gdp, d.gdp_per_capita_ppp);
    const renRank = pct(ranks.renewable, d.renewable_pct);
    const access = d.electricity_access_pct / 100;
    const petals = 12;
    const petalLength = 52 + ghgRank * 82;
    const openScale = 0.46 + access * 0.72;
    const coreRadius = 16 + gdpRank * 24;
    const filaments = 4 + Math.round(renRank * 12);
    const color = REGION_COLOR[d.region] || "#86b8d5";

    const group = svg.append("g").attr("transform", `translate(${cx} ${cy})`);
    for (let i = 0; i < petals; i += 1) {
      const a = (Math.PI * 2 * i) / petals;
      const x = Math.cos(a) * petalLength;
      const y = Math.sin(a) * petalLength * openScale;
      group.append("ellipse")
        .attr("class", "petal")
        .attr("cx", x * 0.52)
        .attr("cy", y * 0.52)
        .attr("rx", 18 + ghgRank * 18)
        .attr("ry", petalLength * 0.42)
        .attr("transform", `rotate(${a * 180 / Math.PI} ${x * 0.52} ${y * 0.52})`)
        .attr("fill", color)
        .attr("stroke", color);
    }

    for (let i = 0; i < filaments; i += 1) {
      const a = (Math.PI * 2 * i) / filaments;
      group.append("line")
        .attr("class", "filament")
        .attr("x1", Math.cos(a) * (coreRadius + 12))
        .attr("y1", Math.sin(a) * (coreRadius + 12))
        .attr("x2", Math.cos(a) * (coreRadius + 30 + renRank * 44))
        .attr("y2", Math.sin(a) * (coreRadius + 30 + renRank * 44))
        .attr("stroke-width", 1.4 + renRank * 2.8);
    }

    group.append("circle").attr("class", "core").attr("r", coreRadius).attr("fill", color);
    group.append("circle").attr("r", 6).attr("fill", "#fff9ef");
    svg.append("text").attr("class", "bloom-label").attr("x", cx).attr("y", 640).attr("text-anchor", "middle").text(d.country_name_ghg);
    svg.append("text").attr("class", "bloom-note").attr("x", cx).attr("y", 664).attr("text-anchor", "middle").text(`${d.iso3}  •  ${fmt(d.ghg_per_capita, 1)} t  •  ${fmt(d.renewable_pct, 1)}% renewables`);
  });
}

function renderDetail(selected) {
  els.detail.innerHTML = selected.map((d) => `
    <div class="detail-card">
      <h3>${esc(d.country_name_ghg)}</h3>
      <p><strong>GHG per capita:</strong> ${fmt(d.ghg_per_capita, 1)} t</p>
      <p><strong>GDP per capita:</strong> $${fmt(d.gdp_per_capita_ppp, 0)}</p>
      <p><strong>Electricity access:</strong> ${fmt(d.electricity_access_pct, 1)}%</p>
      <p><strong>Renewable share:</strong> ${fmt(d.renewable_pct, 1)}%</p>
    </div>
  `).join("");
}

function pct(sorted, value) { return d3.bisectLeft(sorted, value) / Math.max(sorted.length - 1, 1); }
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
