"use strict";

// ── Config ────────────────────────────────────────────────────────────────────

const DATA_URL = "../../data/df_panel.csv";
const YEARS    = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];

const REGION_COLOR = {
  "Europe & Central Asia":      "#4ecdc4",
  "East Asia & Pacific":        "#74b9ff",
  "North America":              "#ffd93d",
  "Middle East & North Africa": "#ff7675",
};

// SVG geometry — wider canvas for breathing room
const W  = 1300, H  = 760;
const ML = 70,   MT = 55,  MR = 75,  MB = 65;
const PW = W - ML - MR;   // 1155
const PH = H - MT - MB;   // 640

// Animation timing
const ANIM_DUR = 1000;  // ms per step
const STEP_GAP = 1200;  // ms between steps

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  year:      2014,
  playing:   false,
  timer:     null,
  hovered:   null,
  positions: {},
  countries: [],
};

// ── DOM refs ──────────────────────────────────────────────────────────────────

const els = {
  chart:        document.querySelector("#comet-chart"),
  slider:       document.querySelector("#year-slider"),
  yearDisplay:  document.querySelector("#year-display"),
  playBtn:      document.querySelector("#play-btn"),
  detailAside:  document.querySelector("#detail-aside"),
  detailInner:  document.querySelector("#detail-inner"),
  regionLegend: document.querySelector("#region-legend"),
};

let xScale, yScale, rScale;
let countryGroups, yearWatermark;

// ── Bootstrap ─────────────────────────────────────────────────────────────────

d3.csv(DATA_URL, coerce).then(rows => {
  buildState(rows);
  buildScales(rows);
  buildRegionLegend();
  drawChart();
  updateYear(2014);
  setupControls();
});

// ── Data prep ─────────────────────────────────────────────────────────────────

function buildState(rows) {
  const byIso = d3.group(rows, r => r.iso3);
  byIso.forEach((countryRows, iso3) => {
    const first = countryRows[0];
    state.countries.push({
      iso3,
      name:   first.country_name_ghg,
      region: first.region,
      color:  REGION_COLOR[first.region] || "#aabbaa",
    });
    state.positions[iso3] = {};
    countryRows.forEach(r => {
      if (Number.isFinite(r.ghg_per_capita) && Number.isFinite(r.gdp_per_capita_ppp) && r.gdp_per_capita_ppp > 0) {
        state.positions[iso3][r.year] = {
          gdp:   r.gdp_per_capita_ppp,
          ghg:   r.ghg_per_capita,
          pop:   r.population || 5e6,
          ren:   r.renewable_pct,
          valid: true,
        };
      }
    });
  });
  state.countries.sort((a, b) => a.name.localeCompare(b.name));
}

function buildScales(rows) {
  const valid = rows.filter(r => Number.isFinite(r.gdp_per_capita_ppp) && r.gdp_per_capita_ppp > 0);
  xScale = d3.scaleLog()
    .domain([d3.min(valid, r => r.gdp_per_capita_ppp) * 0.85, d3.max(valid, r => r.gdp_per_capita_ppp) * 1.12])
    .range([ML, ML + PW])
    .nice();

  yScale = d3.scaleLinear()
    .domain([0, d3.max(rows.filter(r => Number.isFinite(r.ghg_per_capita)), r => r.ghg_per_capita) * 1.08])
    .range([MT + PH, MT]);

  rScale = d3.scaleSqrt()
    .domain(d3.extent(rows.filter(r => r.population > 0), r => r.population))
    .range([5, 19]);
}

// ── Region legend ─────────────────────────────────────────────────────────────

function buildRegionLegend() {
  els.regionLegend.innerHTML = Object.entries(REGION_COLOR).map(([region, color]) => `
    <div class="region-row">
      <span class="region-dot" style="background:${color};box-shadow:0 0 6px ${color}55"></span>
      <span>${escHtml(region)}</span>
    </div>`).join("");
}

// ── Static chart structure ────────────────────────────────────────────────────

function drawChart() {
  const svg = d3.select(els.chart)
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr("aria-label", "Animated comet chart: country GDP per capita vs GHG per capita, 2014–2023");

  const defs = svg.append("defs");

  // Comet-head glow
  const glowFlt = defs.append("filter").attr("id", "comet-glow")
    .attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
  glowFlt.append("feGaussianBlur").attr("stdDeviation", 5).attr("result", "blur");
  const fmG = glowFlt.append("feMerge");
  fmG.append("feMergeNode").attr("in", "blur");
  fmG.append("feMergeNode").attr("in", "SourceGraphic");

  // Hot-tail glow
  const trailGlow = defs.append("filter").attr("id", "trail-glow")
    .attr("x", "-60%").attr("y", "-60%").attr("width", "220%").attr("height", "220%");
  trailGlow.append("feGaussianBlur").attr("stdDeviation", 3).attr("result", "blur");
  const fmT = trailGlow.append("feMerge");
  fmT.append("feMergeNode").attr("in", "blur");
  fmT.append("feMergeNode").attr("in", "SourceGraphic");

  // Per-country trail gradients (x1,y1,x2,y2 updated each frame)
  state.countries.forEach(c => {
    const g = defs.append("linearGradient")
      .attr("id", `tg-${c.iso3}`)
      .attr("gradientUnits", "userSpaceOnUse");
    g.append("stop").attr("offset", "0%")
      .attr("stop-color", c.color).attr("stop-opacity", 0.0);
    g.append("stop").attr("offset", "100%")
      .attr("stop-color", c.color).attr("stop-opacity", 0.65);
  });

  // Starfield
  const rng = d3.randomLcg(42);
  const stars = d3.range(90).map(() => ({
    x: ML + rng() * PW, y: MT + rng() * PH,
    r: rng() * 1.3 + 0.2, o: rng() * 0.18 + 0.03,
  }));
  svg.append("g").attr("class", "stars")
    .selectAll("circle").data(stars).join("circle")
    .attr("cx", d => d.x).attr("cy", d => d.y)
    .attr("r",  d => d.r).attr("fill", "white").attr("opacity", d => d.o);

  // Year watermark
  yearWatermark = svg.append("text")
    .attr("class", "year-watermark")
    .attr("x", ML + PW / 2).attr("y", MT + PH / 2 + 42)
    .attr("text-anchor", "middle");

  // Grid
  const yTicks = yScale.ticks(7);
  svg.append("g").attr("class", "chart-grid")
    .selectAll("line").data(yTicks).join("line")
    .attr("x1", ML).attr("x2", ML + PW)
    .attr("y1", d => yScale(d)).attr("y2", d => yScale(d));

  const xTicks = [5000, 10000, 20000, 50000, 100000];
  svg.append("g").attr("class", "chart-grid")
    .selectAll("line").data(xTicks).join("line")
    .attr("x1", d => xScale(d)).attr("x2", d => xScale(d))
    .attr("y1", MT).attr("y2", MT + PH);

  // Tick labels
  svg.append("g").selectAll("text").data(yTicks).join("text")
    .attr("class", "axis-label")
    .attr("x", ML - 8).attr("y", d => yScale(d) + 4)
    .attr("text-anchor", "end")
    .text(d => `${d}t`);

  svg.append("g").selectAll("text").data(xTicks).join("text")
    .attr("class", "axis-label")
    .attr("x", d => xScale(d)).attr("y", MT + PH + 20)
    .attr("text-anchor", "middle")
    .text(d => `$${d3.format("~s")(d)}`);

  svg.append("text").attr("class", "axis-label")
    .attr("x", ML + PW / 2).attr("y", MT + PH + 48)
    .attr("text-anchor", "middle")
    .text("GDP per capita (PPP, log scale)");

  svg.append("text").attr("class", "axis-label")
    .attr("transform", `translate(${ML - 50} ${MT + PH / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .text("GHG per capita (t CO₂e)");

  // ── Target zone — aspirational: top-25% GDP AND bottom-25% GHG (2023) ──
  const validPos2023 = state.countries
    .map(c => state.positions[c.iso3]?.[2023])
    .filter(Boolean);
  const p75Gdp = d3.quantile(validPos2023.map(d => d.gdp).sort(d3.ascending), 0.75);
  const p25Ghg = d3.quantile(validPos2023.map(d => d.ghg).sort(d3.ascending), 0.25);
  const tzX  = xScale(p75Gdp);
  const tzY2 = yScale(p25Ghg);   // screen y for GHG threshold (lower = cleaner)

  svg.append("rect")
    .attr("x", tzX).attr("y", MT)
    .attr("width", ML + PW - tzX).attr("height", tzY2 - MT)
    .attr("fill", "rgba(78, 205, 196, 0.06)")
    .attr("stroke", "rgba(78, 205, 196, 0.22)")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "7 5")
    .attr("rx", 4)
    .style("pointer-events", "none");

  svg.append("text").attr("class", "quadrant-label")
    .attr("x", ML + PW - 10).attr("y", MT + 16)
    .attr("text-anchor", "end")
    .attr("fill", "rgba(78,205,196,0.5)")
    .text("TARGET ZONE");

  svg.append("text").attr("class", "quadrant-label")
    .attr("x", ML + 8).attr("y", MT + 16)
    .text("HIGH EMITTERS");
  svg.append("text").attr("class", "quadrant-label")
    .attr("x", ML + 8).attr("y", MT + PH - 8)
    .text("LOW EMITTERS");

  // ── Country groups ──
  const countryLayer = svg.append("g").attr("class", "countries");

  countryGroups = countryLayer.selectAll("g.cg")
    .data(state.countries, d => d.iso3)
    .join("g")
    .attr("class", d => `cg cg-${d.iso3}`);

  countryGroups.append("path").attr("class", "trail-full");
  countryGroups.append("path").attr("class", "trail-hot");
  countryGroups.append("circle").attr("class", "comet-halo")
    .attr("stroke", d => d.color).attr("stroke-width", 1.5);
  countryGroups.append("text").attr("class", "comet-name").style("display", "none");
  countryGroups.append("circle").attr("class", "comet-head")
    .attr("fill", d => d.color).attr("filter", "url(#comet-glow)");
  countryGroups.append("circle").attr("class", "comet-hit");

  countryGroups.select(".comet-hit")
    .on("mouseover", function(event, d) { onHover(d, svg); })
    .on("mouseout",  function(event, d) { onHoverEnd(svg); });

  svg.on("mouseleave", () => onHoverEnd(svg));
}

// ── Year update ───────────────────────────────────────────────────────────────

const trailLine = d3.line()
  .x(d => d.x).y(d => d.y)
  .curve(d3.curveCatmullRom.alpha(0.5));

function updateYear(year, animated = false) {
  state.year = year;
  els.slider.value            = year;
  els.yearDisplay.textContent = year;
  yearWatermark.text(year);

  const yearIdx  = YEARS.indexOf(year);
  const prevYear = yearIdx > 0 ? YEARS[yearIdx - 1] : null;
  const dur      = animated ? ANIM_DUR : 0;
  const ease     = d3.easeSinInOut;

  countryGroups.each(function(d) {
    const g   = d3.select(this);
    const pos = state.positions[d.iso3];
    const hd  = pos[year];

    if (!hd) { g.style("display", "none"); return; }
    g.style("display", null);

    const hx = xScale(hd.gdp);
    const hy = yScale(hd.ghg);
    const hr = rScale(hd.pop);

    // All valid trail points up to current year (final state)
    const trailPts = YEARS
      .filter(y => y <= year && pos[y])
      .map(y => ({ x: xScale(pos[y].gdp), y: yScale(pos[y].ghg) }));

    // Cache gradient selection to avoid repeated lookups inside the tween
    const gradSel = d3.select(`#tg-${d.iso3}`);

    // ── Trails ──
    if (trailPts.length > 1) {
      // Gradient start stays at trail origin (fixed across years)
      gradSel.attr("x1", trailPts[0].x).attr("y1", trailPts[0].y);

      if (animated && prevYear && pos[prevYear]) {
        // Compute the history up to prevYear (starting state of the path)
        const prevPts = YEARS
          .filter(y => y <= prevYear && pos[y])
          .map(y => ({ x: xScale(pos[y].gdp), y: yScale(pos[y].ghg) }));

        const sx = prevPts[prevPts.length - 1].x;  // start x (prev head)
        const sy = prevPts[prevPts.length - 1].y;  // start y
        const ex = hx, ey = hy;                    // end = current head

        // Extend full trail: stable history + animated last segment
        g.select(".trail-full")
          .attr("stroke", `url(#tg-${d.iso3})`)
          .attr("stroke-width", 1.4)
          .attr("opacity", 1)
          .transition("pos").duration(dur).ease(ease)
          .attrTween("d", function() {
            return t => {
              const tip = { x: sx + t * (ex - sx), y: sy + t * (ey - sy) };
              gradSel.attr("x2", tip.x).attr("y2", tip.y);
              return trailLine([...prevPts, tip]);
            };
          });

        // Hot tail: stable 2-point base + animated tip in perfect sync with head
        const hotBase = trailPts.slice(-3, -1);  // last 2 fixed points (year-2, year-1)
        if (hotBase.length > 0) {
          g.select(".trail-hot")
            .attr("stroke", d.color)
            .attr("stroke-width", 3)
            .attr("opacity", 0.55)
            .attr("filter", "url(#trail-glow)")
            .transition("pos").duration(dur).ease(ease)
            .attrTween("d", function() {
              return t => trailLine([
                ...hotBase,
                { x: sx + t * (ex - sx), y: sy + t * (ey - sy) },
              ]);
            });
        } else {
          g.select(".trail-hot").attr("opacity", 0);
        }

      } else {
        // Instant update (scrubbing or initial render)
        const tEnd = trailPts[trailPts.length - 1];
        gradSel.attr("x2", tEnd.x).attr("y2", tEnd.y);

        g.select(".trail-full")
          .attr("d", trailLine(trailPts))
          .attr("stroke", `url(#tg-${d.iso3})`)
          .attr("stroke-width", 1.4)
          .attr("opacity", 1);

        const hotPts = trailPts.slice(-3);
        if (hotPts.length > 1) {
          g.select(".trail-hot")
            .attr("d", trailLine(hotPts))
            .attr("stroke", d.color)
            .attr("stroke-width", 3)
            .attr("opacity", 0.55)
            .attr("filter", "url(#trail-glow)");
        } else {
          g.select(".trail-hot").attr("opacity", 0);
        }
      }

    } else {
      g.select(".trail-full").attr("opacity", 0);
      g.select(".trail-hot").attr("opacity", 0);
    }

    // Head & halo — smooth transition (same named "pos" transition, same ease)
    g.select(".comet-head")
      .transition("pos").duration(dur).ease(ease)
      .attr("cx", hx).attr("cy", hy).attr("r", hr);

    g.select(".comet-halo")
      .transition("pos").duration(dur).ease(ease)
      .attr("cx", hx).attr("cy", hy).attr("r", hr + 7);

    // Hit target — instant for responsive hover
    g.select(".comet-hit")
      .attr("cx", hx).attr("cy", hy).attr("r", Math.max(hr + 10, 16));

    // Label — follows head smoothly (only visible on hover, so animation is fine)
    g.select(".comet-name")
      .text(d.name)
      .attr("text-anchor", "middle")
      .transition("pos").duration(dur).ease(ease)
      .attr("x", hx).attr("y", hy - hr - 9);
  });
}

// ── Hover ─────────────────────────────────────────────────────────────────────

function onHover(d, svg) {
  state.hovered = d.iso3;

  countryGroups.attr("opacity", c => c.iso3 === d.iso3 ? 1 : 0.10);

  countryGroups.filter(c => c.iso3 === d.iso3)
    .select(".comet-name").style("display", null);

  const pos = state.positions[d.iso3][state.year];
  if (pos) {
    countryGroups.filter(c => c.iso3 === d.iso3)
      .select(".comet-head")
      .transition("hover").duration(200)
      .attr("r", rScale(pos.pop) + 4);
  }

  showDetail(d, pos);
}

function onHoverEnd(svg) {
  if (!state.hovered) return;
  state.hovered = null;

  countryGroups.attr("opacity", 1);
  countryGroups.selectAll(".comet-name").style("display", "none");

  countryGroups.each(function(d) {
    const pos = state.positions[d.iso3]?.[state.year];
    if (!pos) return;
    d3.select(this).select(".comet-head")
      .transition("hover").duration(200)
      .attr("r", rScale(pos.pop));
  });

  els.detailAside.style.display = "none";
}

function showDetail(d, pos) {
  if (!pos) return;

  const pos2014    = state.positions[d.iso3]?.[2014];
  const changePct  = pos2014 ? ((pos.ghg - pos2014.ghg) / pos2014.ghg * 100).toFixed(1) : null;
  const changeSign = changePct !== null ? (changePct < 0 ? "−" : "+") : "";
  const changeClr  = changePct !== null ? (changePct < 0 ? "#4ecdc4" : "#ff7675") : "#aaa";

  els.detailInner.innerHTML = `
    <div class="detail-country" style="color:${d.color}">${escHtml(d.name)}</div>
    <div class="detail-row">
      <span class="label">Region</span>
      <span class="val">${escHtml(d.region.replace(" & Central Asia","").replace(" & Pacific",""))}</span>
    </div>
    <div class="detail-row">
      <span class="label">GHG per capita</span>
      <span class="val">${fmtN(pos.ghg, 1)} t</span>
    </div>
    <div class="detail-row">
      <span class="label">GDP per capita</span>
      <span class="val">$${fmtN(pos.gdp, 0)}</span>
    </div>
    ${Number.isFinite(pos.ren) ? `<div class="detail-row">
      <span class="label">Renewables</span>
      <span class="val">${fmtN(pos.ren, 1)}%</span>
    </div>` : ""}
    ${changePct !== null ? `<div class="detail-row">
      <span class="label">Change vs 2014</span>
      <span class="val" style="color:${changeClr}">${changeSign}${Math.abs(+changePct)}%</span>
    </div>` : ""}
    <div class="detail-row">
      <span class="label">Year shown</span>
      <span class="val">${state.year}</span>
    </div>
  `;
  els.detailAside.style.display = "";
}

// ── Controls ──────────────────────────────────────────────────────────────────

function setupControls() {
  els.slider.addEventListener("input", () => {
    stopPlay();
    updateYear(+els.slider.value, false);
  });

  els.playBtn.addEventListener("click", () => {
    state.playing ? stopPlay() : startPlay();
  });
}

function startPlay() {
  state.playing = true;
  els.playBtn.classList.add("is-playing");
  els.playBtn.querySelector(".play-icon").textContent  = "⏸";
  els.playBtn.querySelector(".play-label").textContent = "Pause";

  if (state.year >= 2023) updateYear(2014, false);

  function advance() {
    const next = state.year + 1;
    if (next > 2023) { stopPlay(); return; }
    updateYear(next, true);
    state.timer = setTimeout(advance, STEP_GAP);
  }
  state.timer = setTimeout(advance, STEP_GAP);
}

function stopPlay() {
  state.playing = false;
  els.playBtn.classList.remove("is-playing");
  els.playBtn.querySelector(".play-icon").textContent  = "▶";
  els.playBtn.querySelector(".play-label").textContent = "Play 2014 → 2023";
  clearTimeout(state.timer);
}

// ── Data coercion ─────────────────────────────────────────────────────────────

function coerce(r) {
  return {
    iso3:                    r.iso3,
    country_name_ghg:        r.country_name_ghg,
    year:                    +r.year,
    ghg_per_capita:          parseVal(r.ghg_per_capita),
    gdp_per_capita_ppp:      parseVal(r.gdp_per_capita_ppp),
    renewable_pct:           parseVal(r.renewable_pct),
    electricity_access_pct:  parseVal(r.electricity_access_pct),
    population:              parseVal(r.population),
    region:                  r.region,
  };
}

function parseVal(v) {
  if (v == null || v === "") return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtN(v, d) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" })[c]
  );
}
