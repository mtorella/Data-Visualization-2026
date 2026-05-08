"use strict";

const DATA_URL = "../df_slope.csv";

// Region → colour mapping
const REGION_COLOR = {
  "Europe & Central Asia":    "#2d9c93",
  "East Asia & Pacific":      "#3f7da8",
  "North America":            "#d7a944",
  "Middle East & North Africa":"#d9674f",
};

const DIR_COLOR = {
  improving: "#1f6b57",
  worsening: "#d9674f",
};

const els = {
  chart:        document.querySelector("#slope-chart"),
  regionChips:  document.querySelector("#region-chips"),
  modeToggle:   document.querySelector("#mode-toggle"),
  statN:        document.querySelector("#stat-n"),
  statImproved: document.querySelector("#stat-improved"),
  statWorsened: document.querySelector("#stat-worsened"),
  statMedian:   document.querySelector("#stat-median"),
  hoverDetail:  document.querySelector("#hover-detail"),
  hoverContent: document.querySelector("#hover-content"),
  topImprovers: document.querySelector("#top-improvers"),
  topWorsened:  document.querySelector("#top-worsened"),
};

const state = {
  rows:           [],
  regions:        [],
  activeRegion:   null,   // null = show all
  colorMode:      "direction",  // "direction" | "region"
};

// ── Load ──────────────────────────────────────────────────────────────────────

d3.csv(DATA_URL, coerce).then(rows => {
  state.rows    = rows;
  state.regions = [...new Set(rows.map(r => r.region))].sort();
  buildRegionChips();
  buildSidebar();
  draw();
});

// ── Controls ──────────────────────────────────────────────────────────────────

function buildRegionChips() {
  // "All" chip
  const allBtn = document.createElement("button");
  allBtn.className = "region-chip is-active";
  allBtn.textContent = "All";
  allBtn.dataset.region = "";
  allBtn.style.setProperty("--chip-color", "#17211f");
  els.regionChips.appendChild(allBtn);

  state.regions.forEach(r => {
    const btn = document.createElement("button");
    btn.className = "region-chip";
    btn.textContent = r.replace(" & ", " & ").replace("Europe & Central Asia", "Europe & C. Asia");
    btn.dataset.region = r;
    btn.style.setProperty("--chip-color", REGION_COLOR[r] || "#61706c");
    els.regionChips.appendChild(btn);
  });

  els.regionChips.addEventListener("click", e => {
    const chip = e.target.closest(".region-chip");
    if (!chip) return;
    state.activeRegion = chip.dataset.region || null;
    els.regionChips.querySelectorAll(".region-chip").forEach(b => b.classList.toggle("is-active", b === chip));
    draw();
  });
}

els.modeToggle.addEventListener("click", e => {
  const btn = e.target.closest(".mode-btn");
  if (!btn) return;
  state.colorMode = btn.dataset.mode;
  els.modeToggle.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("is-active", b === btn));
  draw();
});

// ── Sidebar stats & rankings ──────────────────────────────────────────────────

function buildSidebar() {
  const rows = state.rows;
  const improved = rows.filter(r => r.ghg_change_abs < 0);
  const worsened = rows.filter(r => r.ghg_change_abs >= 0);
  const median   = d3.median(rows, r => r.ghg_change_pct);

  els.statN.textContent        = rows.length;
  els.statImproved.textContent = improved.length;
  els.statWorsened.textContent = worsened.length;
  els.statMedian.textContent   = `${fmtPct(median)}%`;

  const byImprovement = [...rows].sort((a, b) => a.ghg_change_pct - b.ghg_change_pct);
  const top5 = byImprovement.slice(0, 5);
  const bot5 = byImprovement.slice(-5).reverse();

  els.topImprovers.innerHTML = top5.map(r => `
    <li>
      <span>${escHtml(r.country_name_ghg)}</span>
      <span class="rank-pct">${fmtPct(r.ghg_change_pct)}%</span>
    </li>`).join("");

  els.topWorsened.innerHTML = bot5.map(r => `
    <li>
      <span>${escHtml(r.country_name_ghg)}</span>
      <span class="rank-pct">+${fmtPct(r.ghg_change_pct)}%</span>
    </li>`).join("");
}

// ── Draw ──────────────────────────────────────────────────────────────────────

function draw() {
  const W        = 820;
  const H        = 760;
  const SPINE_L  = 200;   // x of 2014 dots
  const SPINE_R  = 620;   // x of 2023 dots
  const PAD_TOP  = 72;
  const PAD_BOT  = 56;
  const PLOT_H   = H - PAD_TOP - PAD_BOT;

  const visible = state.activeRegion
    ? state.rows.filter(r => r.region === state.activeRegion)
    : state.rows;

  // Sort by absolute change magnitude for animation sequencing
  const sorted = [...state.rows].sort((a, b) =>
    Math.abs(a.ghg_change_abs) - Math.abs(b.ghg_change_abs)
  );

  const allVals  = state.rows.flatMap(r => [r.ghg_2014, r.ghg_2023]);
  const yMax     = Math.ceil(d3.max(allVals) * 1.06);
  const median14 = d3.median(state.rows, r => r.ghg_2014);
  const median23 = d3.median(state.rows, r => r.ghg_2023);

  const y = d3.scaleLinear()
    .domain([0, yMax])
    .range([PAD_TOP + PLOT_H, PAD_TOP]);

  // Colour lookup
  const getColor = r => state.colorMode === "region"
    ? (REGION_COLOR[r.region] || "#61706c")
    : (r.ghg_change_abs < 0 ? DIR_COLOR.improving : DIR_COLOR.worsening);

  // Active set
  const activeSet = new Set(visible.map(r => r.iso3));
  const isActive  = r => !state.activeRegion || activeSet.has(r.iso3);

  // ── SVG ──
  const svg = d3.select(els.chart)
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr("aria-label", `Decarbonisation slope chart 2014 to 2023`);

  const defs = svg.append("defs");

  // Clip path so labels don't overflow
  defs.append("clipPath").attr("id", "chart-clip")
    .append("rect").attr("x", 0).attr("y", 0).attr("width", W).attr("height", H);

  // ── Y-axis grid + tick labels ──
  const ticks = y.ticks(7);

  svg.append("g").attr("class", "grid")
    .selectAll("line")
    .data(ticks)
    .join("line")
    .attr("class", "slope-grid-line")
    .attr("x1", SPINE_L - 20).attr("x2", SPINE_R + 20)
    .attr("y1", d => y(d)).attr("y2", d => y(d));

  svg.append("g").attr("class", "tick-labels")
    .selectAll("text")
    .data(ticks)
    .join("text")
    .attr("class", "axis-tick-label")
    .attr("x", SPINE_L - 28)
    .attr("y", d => y(d) + 4)
    .attr("text-anchor", "end")
    .text(d => `${d} t`);

  // ── Spines ──
  svg.append("line").attr("class", "slope-spine")
    .attr("x1", SPINE_L).attr("x2", SPINE_L)
    .attr("y1", PAD_TOP).attr("y2", PAD_TOP + PLOT_H);

  svg.append("line").attr("class", "slope-spine")
    .attr("x1", SPINE_R).attr("x2", SPINE_R)
    .attr("y1", PAD_TOP).attr("y2", PAD_TOP + PLOT_H);

  // ── Year headings ──
  svg.append("text").attr("class", "col-year")
    .attr("x", SPINE_L).attr("y", PAD_TOP - 18)
    .attr("text-anchor", "middle")
    .text("2014");

  svg.append("text").attr("class", "col-year")
    .attr("x", SPINE_R).attr("y", PAD_TOP - 18)
    .attr("text-anchor", "middle")
    .text("2023");

  // ── Median reference dashes ──
  const midX = (SPINE_L + SPINE_R) / 2;

  svg.append("path")
    .attr("d", bezierPath(SPINE_L, y(median14), SPINE_R, y(median23)))
    .attr("fill", "none")
    .attr("stroke", "rgba(97,112,108,0.45)")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "6 4");

  svg.append("text").attr("class", "median-label")
    .attr("x", midX)
    .attr("y", (y(median14) + y(median23)) / 2 - 7)
    .attr("text-anchor", "middle")
    .text("SAMPLE MEDIAN");

  // ── Slope paths ──
  const pathGroup = svg.append("g").attr("class", "paths");

  const paths = pathGroup.selectAll(".slope-path")
    .data(sorted)
    .join("path")
    .attr("class", "slope-path")
    .attr("data-iso", r => r.iso3)
    .attr("d", r => bezierPath(SPINE_L, y(r.ghg_2014), SPINE_R, y(r.ghg_2023)))
    .attr("stroke", r => getColor(r))
    .attr("stroke-width", r => strokeW(r))
    .attr("opacity", r => isActive(r) ? 0.62 : 0.08);

  // Draw-on animation (strokeDashoffset trick — subtle, most dramatic lines arrive last)
  paths.each(function(r, i) {
    const len = this.getTotalLength();
    d3.select(this)
      .attr("stroke-dasharray", `${len} ${len}`)
      .attr("stroke-dashoffset", len)
      .transition()
      .duration(700)
      .delay(i * 16)
      .ease(d3.easeCubicInOut)
      .attr("stroke-dashoffset", 0);
  });

  // ── 2014 dots ──
  svg.append("g").attr("class", "dots-l")
    .selectAll("circle")
    .data(sorted)
    .join("circle")
    .attr("class", "slope-dot")
    .attr("data-iso", r => r.iso3)
    .attr("cx", SPINE_L)
    .attr("cy", r => y(r.ghg_2014))
    .attr("r", 4)
    .attr("fill", r => getColor(r))
    .attr("stroke", "#fffdf8")
    .attr("stroke-width", 1.5)
    .attr("opacity", r => isActive(r) ? 0.85 : 0.1);

  // ── 2023 dots ──
  svg.append("g").attr("class", "dots-r")
    .selectAll("circle")
    .data(sorted)
    .join("circle")
    .attr("class", "slope-dot")
    .attr("data-iso", r => r.iso3)
    .attr("cx", SPINE_R)
    .attr("cy", r => y(r.ghg_2023))
    .attr("r", 4)
    .attr("fill", r => getColor(r))
    .attr("stroke", "#fffdf8")
    .attr("stroke-width", 1.5)
    .attr("opacity", r => isActive(r) ? 0.85 : 0.1);

  // ── Floating hover label group (one per chart, repositioned on hover) ──
  const labelG = svg.append("g").attr("class", "hover-labels").style("display", "none");

  const lblLeft = labelG.append("text")
    .attr("class", "hover-label-text")
    .attr("text-anchor", "end");

  const lblRight = labelG.append("text")
    .attr("class", "hover-label-text")
    .attr("text-anchor", "start");

  const midBadge = labelG.append("text")
    .attr("class", "hover-badge")
    .attr("text-anchor", "middle");

  // Invisible fat hover targets — sit over each path
  const hitGroup = svg.append("g").attr("class", "hit-targets");

  hitGroup.selectAll("path")
    .data(sorted)
    .join("path")
    .attr("d", r => bezierPath(SPINE_L, y(r.ghg_2014), SPINE_R, y(r.ghg_2023)))
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 18)
    .style("cursor", r => isActive(r) ? "pointer" : "default")
    .on("mouseover", function(event, r) {
      if (!isActive(r)) return;
      highlightOne(r, svg, getColor, isActive);
      showHoverLabel(r, y, labelG, lblLeft, lblRight, midBadge, SPINE_L, SPINE_R);
      showSideDetail(r);
    })
    .on("mouseout", function() {
      resetHighlight(svg, isActive);
      labelG.style("display", "none");
      els.hoverDetail.style.display = "none";
    });

  // Reset all on SVG exit
  svg.on("mouseleave", function() {
    resetHighlight(svg, isActive);
    labelG.style("display", "none");
    els.hoverDetail.style.display = "none";
  });
}

// ── Hover helpers ─────────────────────────────────────────────────────────────

function highlightOne(r, svg, getColor, isActive) {
  svg.selectAll(".slope-path")
    .attr("opacity", p => {
      if (!isActive(p)) return 0.05;
      return p.iso3 === r.iso3 ? 1 : 0.1;
    })
    .attr("stroke-width", p => p.iso3 === r.iso3 ? strokeW(p) + 1.5 : strokeW(p));

  svg.selectAll(".slope-dot")
    .attr("opacity", p => {
      if (!isActive(p)) return 0.05;
      return p.iso3 === r.iso3 ? 1 : 0.08;
    })
    .attr("r", p => p.iso3 === r.iso3 ? 6 : 4);
}

function resetHighlight(svg, isActive) {
  svg.selectAll(".slope-path")
    .attr("opacity", p => isActive(p) ? 0.62 : 0.08)
    .attr("stroke-width", p => strokeW(p));
  svg.selectAll(".slope-dot")
    .attr("opacity", p => isActive(p) ? 0.85 : 0.1)
    .attr("r", 4);
}

function showHoverLabel(r, y, labelG, lblLeft, lblRight, midBadge, SPINE_L, SPINE_R) {
  const yL  = y(r.ghg_2014);
  const yR  = y(r.ghg_2023);
  const yMid = (yL + yR) / 2;
  const xMid = (SPINE_L + SPINE_R) / 2;
  const sign  = r.ghg_change_abs < 0 ? "−" : "+";
  const color = r.ghg_change_abs < 0 ? DIR_COLOR.improving : DIR_COLOR.worsening;

  labelG.style("display", null);

  lblLeft
    .attr("x", SPINE_L - 10).attr("y", yL + 4)
    .attr("fill", color)
    .text(`${r.country_name_ghg} ${fmtN(r.ghg_2014, 1)}t`);

  lblRight
    .attr("x", SPINE_R + 10).attr("y", yR + 4)
    .attr("fill", color)
    .text(`${fmtN(r.ghg_2023, 1)}t`);

  midBadge
    .attr("x", xMid).attr("y", yMid - 10)
    .attr("fill", color)
    .text(`${sign}${Math.abs(r.ghg_change_pct).toFixed(1)}%`);
}

function showSideDetail(r) {
  const sign  = r.ghg_change_abs < 0 ? "−" : "+";
  const color = r.ghg_change_abs < 0 ? "var(--forest)" : "var(--coral)";

  els.hoverContent.innerHTML = `
    <div class="hov-country">${escHtml(r.country_name_ghg)}</div>
    <div class="hov-row"><span>Region</span><strong>${escHtml(r.region)}</strong></div>
    <div class="hov-row"><span>2014</span><strong>${fmtN(r.ghg_2014, 2)} t</strong></div>
    <div class="hov-row"><span>2023</span><strong>${fmtN(r.ghg_2023, 2)} t</strong></div>
    <div class="hov-row"><span>Change</span><strong style="color:${color}">${sign}${fmtN(Math.abs(r.ghg_change_abs), 2)} t (${sign}${fmtPct(Math.abs(r.ghg_change_pct))}%)</strong></div>
  `;
  els.hoverDetail.style.display = "";
}

// ── Geometry ──────────────────────────────────────────────────────────────────

// Smooth S-curve bezier: horizontal tangents at both endpoints.
// midX is the x midpoint; both control points sit at that x,
// but at their respective y values — creating an S when y0 ≠ y1.
function bezierPath(x0, y0, x1, y1) {
  const mx = (x0 + x1) / 2;
  return `M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
}

function strokeW(r) {
  // Thicker = larger absolute GHG shift; clamp to a readable range
  return Math.max(1.2, Math.min(5, 1.4 + Math.abs(r.ghg_change_abs) * 0.26));
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function coerce(d) {
  return {
    iso3:            d.iso3,
    country_name_ghg: d.country_name_ghg,
    region:          d.region,
    ghg_2014:        +d.ghg_2014,
    ghg_2023:        +d.ghg_2023,
    ghg_change_pct:  +d.ghg_change_pct,
    ghg_change_abs:  +d.ghg_change_abs,
  };
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtN(v, d) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
}

function fmtPct(v) {
  return fmtN(v, 1);
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]
  );
}
