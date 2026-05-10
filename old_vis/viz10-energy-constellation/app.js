"use strict";

const PANEL_URL = "../../data/df_panel.csv";
const SLOPE_URL = "../df_slope.csv";
const DEFAULT_YEAR = 2021;
const DEFAULT_LENS = 58;
const YEAR_MAX = 2021;

const REGION_COLOR = {
  "Europe & Central Asia": "#7cc6fe",
  "East Asia & Pacific": "#6ee7b7",
  "North America": "#ffd166",
  "Middle East & North Africa": "#ff8f70",
  "Latin America & Caribbean": "#9b87f5",
  "Sub-Saharan Africa": "#f6bd60",
  "South Asia": "#7bdff2",
};

const els = {
  yearSelect: document.querySelector("#year-select"),
  lensSlider: document.querySelector("#lens-slider"),
  lensValue: document.querySelector("#lens-value"),
  lensNote: document.querySelector("#lens-note"),
  countrySelect: document.querySelector("#country-select"),
  coverageNote: document.querySelector("#coverage-note"),
  summaryStrip: document.querySelector("#summary-strip"),
  detailPanel: document.querySelector("#detail-panel"),
  chart: document.querySelector("#constellation-chart"),
};

const state = {
  rows: [],
  rowsByIso: new Map(),
  slopeByIso: new Map(),
  years: [],
  year: DEFAULT_YEAR,
  lens: DEFAULT_LENS,
  spotlightIso: "ITA",
  currentNodes: [],
};

const tooltip = d3.select("body")
  .append("div")
  .attr("class", "constellation-tooltip")
  .style("opacity", 0)
  .style("pointer-events", "none");

Promise.all([
  d3.csv(PANEL_URL, coercePanelRow),
  d3.csv(SLOPE_URL, coerceSlopeRow),
]).then(([panelRows, slopeRows]) => {
  state.rows = panelRows.filter((row) =>
    row.year <= YEAR_MAX &&
    Number.isFinite(row.ghg_per_capita) &&
    Number.isFinite(row.gdp_per_capita_ppp) &&
    Number.isFinite(row.renewable_pct) &&
    Number.isFinite(row.electricity_access_pct) &&
    Number.isFinite(row.ghg_total_mt)
  );
  state.years = [...new Set(state.rows.map((row) => row.year))].sort((a, b) => a - b);
  state.rowsByIso = d3.group(state.rows, (row) => row.iso3);
  state.slopeByIso = new Map(slopeRows.map((row) => [row.iso3, row]));

  if (!state.years.includes(state.year)) {
    state.year = state.years.at(-1);
  }

  const firstIso = state.rows.find((row) => row.year === state.year)?.iso3;
  if (!state.rowsByIso.has(state.spotlightIso) && firstIso) {
    state.spotlightIso = firstIso;
  }

  populateYears();
  populateCountries();
  syncLensText();
  bindEvents();
  render();
});

function bindEvents() {
  els.yearSelect.addEventListener("change", () => {
    state.year = Number(els.yearSelect.value);
    populateCountries();
    render();
  });

  els.lensSlider.addEventListener("input", () => {
    state.lens = Number(els.lensSlider.value);
    syncLensText();
    render();
  });

  els.countrySelect.addEventListener("change", () => {
    state.spotlightIso = els.countrySelect.value;
    render();
  });
}

function populateYears() {
  els.yearSelect.innerHTML = state.years
    .map((year) => `<option value="${year}" ${year === state.year ? "selected" : ""}>${year}</option>`)
    .join("");
}

function populateCountries() {
  const yearRows = rowsInYear(state.year).sort((a, b) => a.country_name_ghg.localeCompare(b.country_name_ghg));
  if (!yearRows.some((row) => row.iso3 === state.spotlightIso)) {
    state.spotlightIso = yearRows[0]?.iso3 || "";
  }

  els.countrySelect.innerHTML = yearRows
    .map((row) => `<option value="${row.iso3}" ${row.iso3 === state.spotlightIso ? "selected" : ""}>${escHtml(row.country_name_ghg)}</option>`)
    .join("");
}

function syncLensText() {
  els.lensValue.textContent = `${state.lens}`;
  const mode = state.lens / 100;
  els.lensNote.textContent = mode < 0.34
    ? "The sky reads low-emission countries skeptically, pulling limited-access profiles left."
    : mode > 0.66
      ? "The sky rewards renewable progress and broad access, pushing genuine transitions right."
      : "The sky is balanced between caution and optimism, so mixed profiles gather near the middle.";
}

function render() {
  const yearRows = rowsInYear(state.year);
  const stats = buildStats(yearRows);
  const nodes = yearRows.map((row) => buildNode(row, stats, state.lens / 100));
  runLayout(nodes);
  state.currentNodes = nodes;

  els.coverageNote.textContent =
    `${nodes.length} countries have complete GHG, GDP, access, and renewable data in ${state.year}. ` +
    "This view stays in 2014–2021 because renewable coverage falls sharply afterward.";

  renderSummary(nodes);
  renderDetailPanel(nodes);
  drawChart(nodes);
}

function renderSummary(nodes) {
  const scarcity = nodes.filter((node) => node.story === "constraint").length;
  const transition = nodes.filter((node) => node.story === "transition").length;
  const burden = nodes.filter((node) => node.story === "burden").length;

  els.summaryStrip.innerHTML = `
    <div class="summary-card">
      <h3>${burden} stars in carbon-heavy abundance</h3>
      <p>High per-capita emissions push these countries toward the upper sky even when capacity is strong.</p>
    </div>
    <div class="summary-card">
      <h3>${transition} stars read as genuine transition</h3>
      <p>High access and stronger renewable performance shift these countries toward the right-hand nebula.</p>
    </div>
    <div class="summary-card">
      <h3>${scarcity} stars read as low-carbon by constraint</h3>
      <p>Lower emissions alone are not enough when electricity access and economic capacity remain limited.</p>
    </div>
  `;
}

function renderDetailPanel(nodes) {
  const spotlight = nodes.find((node) => node.iso3 === state.spotlightIso) || nodes[0];
  if (!spotlight) {
    els.detailPanel.innerHTML = "";
    return;
  }

  const slope = state.slopeByIso.get(spotlight.iso3);
  const changeLine = slope
    ? `${fmtSigned(slope.ghg_change_pct, 1)}% per-capita emissions change from 2014 to 2023`
    : "No complete endpoint trend is available in df_slope.csv";

  els.detailPanel.innerHTML = `
    <div class="detail-card">
      <h3>${escHtml(spotlight.country_name_ghg)}</h3>
      <p>${spotlight.storyText}</p>
      <div class="metric-grid">
        <div class="metric">
          <span class="metric-label">GHG per person</span>
          <span class="metric-value">${fmtN(spotlight.ghg_per_capita, 1)} t</span>
        </div>
        <div class="metric">
          <span class="metric-label">GDP per person</span>
          <span class="metric-value">$${fmtN(spotlight.gdp_per_capita_ppp, 0)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Electricity access</span>
          <span class="metric-value">${fmtN(spotlight.electricity_access_pct, 1)}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Renewable share</span>
          <span class="metric-value">${fmtN(spotlight.renewable_pct, 1)}%</span>
        </div>
      </div>
    </div>
    <div class="detail-card">
      <h3>Why this star sits here</h3>
      <p>${spotlight.rationale}</p>
      <p style="margin-top:10px">${changeLine}.</p>
    </div>
  `;
}

function drawChart(nodes) {
  const width = 1280;
  const height = 920;
  const margin = 54;
  const plot = {
    left: margin,
    right: width - margin,
    top: margin,
    bottom: height - margin,
  };

  const svg = d3.select(els.chart)
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `Energy constellation for ${state.year}`);

  const defs = svg.append("defs");

  const glow = defs.append("filter")
    .attr("id", "star-glow")
    .attr("x", "-120%")
    .attr("y", "-120%")
    .attr("width", "340%")
    .attr("height", "340%");
  glow.append("feGaussianBlur").attr("stdDeviation", 10).attr("result", "blur");
  glow.append("feMerge").call((merge) => {
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");
  });

  const shell = svg.append("g");
  shell.append("rect")
    .attr("class", "sky-shell")
    .attr("x", plot.left)
    .attr("y", plot.top)
    .attr("width", plot.right - plot.left)
    .attr("height", plot.bottom - plot.top)
    .attr("rx", 34);

  drawNebulas(shell, plot);
  drawGuides(shell, plot);
  drawSpotlightTrail(shell, plot);

  const stars = shell.append("g").attr("class", "stars");
  const star = stars.selectAll(".star")
    .data(nodes, (d) => d.iso3)
    .join("g")
    .attr("class", "star")
    .attr("transform", (d) => `translate(${d.x} ${d.y})`);

  star.each(function drawStar(node) {
    const group = d3.select(this);
    const burstCount = 4 + Math.round(node.renewableRank * 10);
    const orbitRadius = node.radius + 6 + node.populationRank * 14;
    const tailDx = (node.trendSign >= 0 ? 1 : -1) * (10 + node.trendStrength * 28);
    const tailDy = -6 - node.trendStrength * 18;

    group.append("line")
      .attr("class", "star-tail")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", -tailDx)
      .attr("y2", -tailDy)
      .attr("stroke", node.trendSign >= 0 ? "#ff8f70" : "#73d8c8")
      .attr("stroke-width", 1.5 + node.trendStrength * 2.2);

    group.append("circle")
      .attr("r", orbitRadius)
      .attr("class", "star-orbit")
      .attr("opacity", 0.2 + node.accessScore * 0.28);

    const burst = d3.range(burstCount).map((index) => {
      const angle = (Math.PI * 2 * index) / burstCount;
      const inner = node.radius + 2;
      const outer = inner + 4 + node.renewableRank * 18;
      return {
        x1: Math.cos(angle) * inner,
        y1: Math.sin(angle) * inner,
        x2: Math.cos(angle) * outer,
        y2: Math.sin(angle) * outer,
      };
    });

    group.selectAll(".star-burst")
      .data(burst)
      .join("line")
      .attr("class", "star-burst")
      .attr("x1", (d) => d.x1)
      .attr("y1", (d) => d.y1)
      .attr("x2", (d) => d.x2)
      .attr("y2", (d) => d.y2)
      .attr("stroke-width", 1.1 + node.renewableRank * 1.8);

    group.append("circle")
      .attr("r", node.radius * 2.6)
      .attr("fill", node.color)
      .attr("opacity", 0.12 + node.totalRank * 0.16)
      .attr("filter", "url(#star-glow)");

    group.append("circle")
      .attr("class", "star-core")
      .attr("r", node.radius)
      .attr("fill", node.color)
      .attr("opacity", 0.46 + node.accessScore * 0.42);

    if (node.iso3 === state.spotlightIso || node.radius > 9.2) {
      group.append("text")
        .attr("class", "star-label")
        .attr("x", 12)
        .attr("y", -10)
        .text(node.iso3);
    }
  });

  star
    .on("mouseenter", function handleEnter(event, node) {
      state.spotlightIso = node.iso3;
      els.countrySelect.value = node.iso3;
      renderDetailPanel(nodes);
      d3.select(this).raise();
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${escHtml(node.country_name_ghg)}</strong>` +
          `<p>${escHtml(node.storyText)}</p>`
        );
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", `${event.clientX + 18}px`)
        .style("top", `${event.clientY + 18}px`);
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    })
    .on("click", (_, node) => {
      state.spotlightIso = node.iso3;
      els.countrySelect.value = node.iso3;
      render();
    });
}

function drawNebulas(shell, plot) {
  const clouds = [
    {
      x: plot.left + 220,
      y: plot.bottom - 170,
      rx: 220,
      ry: 146,
      fill: "rgba(255, 143, 112, 0.12)",
      label: "Low Carbon by Constraint",
      note: "lighter emissions, weaker access",
      anchor: "start",
      tx: plot.left + 110,
      ty: plot.bottom - 220,
    },
    {
      x: plot.right - 240,
      y: plot.bottom - 170,
      rx: 230,
      ry: 156,
      fill: "rgba(115, 216, 200, 0.12)",
      label: "Transition with Capacity",
      note: "cleaner profiles with stronger access",
      anchor: "end",
      tx: plot.right - 110,
      ty: plot.bottom - 220,
    },
    {
      x: (plot.left + plot.right) / 2,
      y: plot.top + 190,
      rx: 280,
      ry: 170,
      fill: "rgba(243, 191, 98, 0.12)",
      label: "Carbon-heavy Abundance",
      note: "wealth and emissions rise together",
      anchor: "middle",
      tx: (plot.left + plot.right) / 2,
      ty: plot.top + 104,
    },
  ];

  shell.selectAll(".zone-cloud")
    .data(clouds)
    .join("ellipse")
    .attr("class", "zone-cloud")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("rx", (d) => d.rx)
    .attr("ry", (d) => d.ry)
    .attr("fill", (d) => d.fill);

  shell.selectAll(".zone-label")
    .data(clouds)
    .join("text")
    .attr("class", "zone-label")
    .attr("x", (d) => d.tx)
    .attr("y", (d) => d.ty)
    .attr("text-anchor", (d) => d.anchor)
    .text((d) => d.label);

  shell.selectAll(".zone-note")
    .data(clouds)
    .join("text")
    .attr("class", "zone-note")
    .attr("x", (d) => d.tx)
    .attr("y", (d) => d.ty + 18)
    .attr("text-anchor", (d) => d.anchor)
    .text((d) => d.note);
}

function drawGuides(shell, plot) {
  const midX = (plot.left + plot.right) / 2;
  const ghgLineY = plot.top + 250;
  const balanceY = plot.bottom - 180;

  shell.append("line")
    .attr("class", "guide-line")
    .attr("x1", plot.left + 40)
    .attr("x2", plot.right - 40)
    .attr("y1", ghgLineY)
    .attr("y2", ghgLineY);

  shell.append("text")
    .attr("class", "guide-text")
    .attr("x", plot.right - 50)
    .attr("y", ghgLineY - 10)
    .attr("text-anchor", "end")
    .text("More carbon pressure");

  shell.append("line")
    .attr("class", "guide-line")
    .attr("x1", midX)
    .attr("x2", midX)
    .attr("y1", plot.top + 66)
    .attr("y2", plot.bottom - 46);

  shell.append("text")
    .attr("class", "guide-text")
    .attr("x", midX)
    .attr("y", balanceY)
    .attr("text-anchor", "middle")
    .text("The truth lens tilts this balance");
}

function drawSpotlightTrail(shell, plot) {
  const series = (state.rowsByIso.get(state.spotlightIso) || [])
    .filter((row) => state.years.includes(row.year))
    .sort((a, b) => a.year - b.year);

  if (series.length < 2) return;

  const trailNodes = series.map((row) => buildNode(row, buildStats(rowsInYear(row.year)), state.lens / 100));
  runLayout(trailNodes, true);

  const line = d3.line()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(d3.curveCatmullRom.alpha(0.5));

  shell.append("path")
    .attr("class", "trail-path")
    .attr("d", line(trailNodes));

  const trail = shell.append("g");
  trail.selectAll(".trail-year")
    .data(trailNodes)
    .join("circle")
    .attr("class", "trail-year")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", 4.2);

  trail.selectAll(".trail-label")
    .data(trailNodes.filter((node) => node.year === state.years[0] || node.year === state.year))
    .join("text")
    .attr("class", "trail-label")
    .attr("x", (d) => d.x + 8)
    .attr("y", (d) => d.y - 8)
    .text((d) => d.year);
}

function rowsInYear(year) {
  return state.rows.filter((row) => row.year === year);
}

function buildStats(rows) {
  return {
    ghg: rows.map((row) => row.ghg_per_capita).sort(d3.ascending),
    gdp: rows.map((row) => row.gdp_per_capita_ppp).sort(d3.ascending),
    renewable: rows.map((row) => row.renewable_pct).sort(d3.ascending),
    access: rows.map((row) => row.electricity_access_pct).sort(d3.ascending),
    total: rows.map((row) => row.ghg_total_mt).sort(d3.ascending),
    population: rows.map((row) => row.population).sort(d3.ascending),
  };
}

function buildNode(row, stats, lens) {
  const ghgRank = percentile(stats.ghg, row.ghg_per_capita);
  const gdpRank = percentile(stats.gdp, row.gdp_per_capita_ppp);
  const renewableRank = percentile(stats.renewable, row.renewable_pct);
  const accessScore = row.electricity_access_pct / 100;
  const totalRank = percentile(stats.total, row.ghg_total_mt);
  const populationRank = percentile(stats.population, row.population);

  const transitionScore = mean([1 - ghgRank, renewableRank, accessScore, gdpRank]);
  const constraintScore = mean([1 - ghgRank, 1 - accessScore, 1 - gdpRank]);
  const burdenScore = mean([ghgRank, gdpRank, 1 - renewableRank]);

  const xScore = clamp(0.5 + (transitionScore * lens - constraintScore * (1 - lens)) * 0.92, 0.06, 0.94);
  const yScore = clamp(0.08 + ghgRank * 0.75 + gdpRank * 0.12 + (1 - renewableRank) * 0.1, 0.06, 0.94);

  const slope = state.slopeByIso.get(row.iso3);
  const trend = slope?.ghg_change_pct ?? 0;
  const trendSign = trend >= 0 ? 1 : -1;
  const trendStrength = clamp(Math.abs(trend) / 50, 0.08, 1);

  const story = burdenScore > Math.max(transitionScore, constraintScore) * 0.95 && ghgRank > 0.58
    ? "burden"
    : transitionScore >= constraintScore
      ? "transition"
      : "constraint";

  return {
    ...row,
    ghgRank,
    gdpRank,
    renewableRank,
    accessScore,
    totalRank,
    populationRank,
    transitionScore,
    constraintScore,
    burdenScore,
    xScore,
    yScore,
    color: REGION_COLOR[row.region] || "#c7d2fe",
    radius: 3.8 + totalRank * 13,
    trendSign,
    trendStrength,
    story,
    storyText: storyLabel(story, row.country_name_ghg),
    rationale: rationaleText(story, row, { ghgRank, gdpRank, renewableRank, accessScore }, lens),
  };
}

function runLayout(nodes, trailOnly = false) {
  const width = 1280;
  const height = 920;
  const margin = 82;
  const x = d3.scaleLinear().domain([0, 1]).range([margin, width - margin]);
  const y = d3.scaleLinear().domain([0, 1]).range([height - margin, margin]);

  nodes.forEach((node) => {
    node.tx = x(node.xScore);
    node.ty = y(node.yScore);
    node.x = node.tx;
    node.y = node.ty;
  });

  if (trailOnly) {
    return;
  }

  d3.forceSimulation(nodes)
    .force("x", d3.forceX((d) => d.tx).strength(0.7))
    .force("y", d3.forceY((d) => d.ty).strength(0.7))
    .force("collide", d3.forceCollide((d) => d.radius + 5).iterations(2))
    .stop()
    .tick(160);
}

function storyLabel(story, country) {
  if (story === "transition") {
    return `${country} reads as a lower-carbon system with stronger capacity and access.`;
  }
  if (story === "constraint") {
    return `${country} looks low-carbon, but the lens reads that calm partly as limited access or capacity.`;
  }
  return `${country} sits in the carbon-heavy zone where wealth and emissions still reinforce each other.`;
}

function rationaleText(story, row, scores, lens) {
  const lensLabel = lens < 0.34 ? "constraint-heavy" : lens > 0.66 ? "transition-heavy" : "balanced";
  if (story === "transition") {
    return `Under a ${lensLabel} lens, high electricity access and stronger renewable performance outweigh the country's remaining emissions pressure.`;
  }
  if (story === "constraint") {
    return `Under a ${lensLabel} lens, low emissions are not enough to move right because access or economic capacity still lag behind the richer, cleaner cases.`;
  }
  return `Under a ${lensLabel} lens, high per-capita emissions keep the star elevated even when income and infrastructure are strong.`;
}

function coercePanelRow(row) {
  return {
    iso3: row.iso3,
    country_name_ghg: row.country_name_ghg,
    region: row.region,
    year: Number(row.year),
    ghg_per_capita: num(row.ghg_per_capita),
    gdp_per_capita_ppp: num(row.gdp_per_capita_ppp),
    renewable_pct: num(row.renewable_pct),
    electricity_access_pct: num(row.electricity_access_pct),
    fossil_fuel_pct: num(row.fossil_fuel_pct),
    population: num(row.population),
    ghg_total_mt: num(row.ghg_total_mt),
  };
}

function coerceSlopeRow(row) {
  return {
    iso3: row.iso3,
    ghg_2014: num(row.ghg_2014),
    ghg_2023: num(row.ghg_2023),
    ghg_change_pct: num(row.ghg_change_pct),
    ghg_change_abs: num(row.ghg_change_abs),
    country_name_ghg: row.country_name_ghg,
    region: row.region,
  };
}

function percentile(sorted, value) {
  if (!sorted.length || !Number.isFinite(value)) return 0;
  const bisect = d3.bisectLeft(sorted, value);
  return clamp(bisect / Math.max(sorted.length - 1, 1), 0, 1);
}

function mean(values) {
  return d3.mean(values.filter(Number.isFinite)) ?? 0;
}

function num(value) {
  return value === "" || value == null ? NaN : Number(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fmtN(value, digits) {
  return d3.format(`,.${digits}f`)(value);
}

function fmtSigned(value, digits) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmtN(value, digits)}`;
}

function escHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
