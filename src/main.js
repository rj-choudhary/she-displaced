import { inject } from '@vercel/analytics'
import * as d3 from 'd3'
import { initNav }           from './nav.js'
import { initExplorer }      from './explorer.js'
import { initLab }           from './lab.js'
import { drawWorldMap }      from './charts/worldMap.js'
import { drawSlopeScrolly }  from './charts/slopeScrolly.js'
import { drawBubbleChart }   from './charts/bubbleChart.js'
import { drawRadarChart }    from './charts/radarChart.js'
import { drawOutlierRadar }  from './charts/outlierRadar.js'
import { drawDeltaChart }    from './charts/deltaChart.js'
import { drawDisasterCharts } from './charts/disasterCharts.js'
import { initHeroParticles } from './charts/heroParticles.js'
import { initInsightPlayer } from './insightPlayer.js'

function safe(name, fn) {
  try { fn() } catch(e) { if (import.meta.env.DEV) console.error(`[${name}] failed:`, e) }
}

// Vercel Web Analytics — collects anonymous page view/visit data.
// No-op locally (auto-detects dev mode); active once deployed on Vercel.
inject()

// ── Hope: Resilience Champions ────────────────────────────────
function drawHopeChart(data) {
  const container = document.getElementById('hope-chart')
  const tooltip   = document.getElementById('hope-tooltip')
  if (!container) return

  const REGION_COLORS = {
    'Sub-Saharan Africa':        '#E8614A',
    'South Asia':                '#E8A84A',
    'MENA':                      '#C0392B',
    'East Asia & Pacific':       '#2AADAD',
    'Latin America & Caribbean': '#8B5CF6',
    'Europe':                    '#1A7A7A',
    'North America':             '#059669',
    'Central Asia':              '#F59E0B',
  }

  const byIso = {}
  data.forEach(d => {
    if (d.sdrs == null) return
    if (!byIso[d.iso3]) byIso[d.iso3] = { name: d.name, region: d.region, records: [] }
    byIso[d.iso3].records.push(d)
  })

  const champions = []
  Object.values(byIso).forEach(c => {
    const sorted = c.records.sort((a,b) => a.year - b.year)
    if (sorted.length < 2) return
    const peak   = sorted.reduce((m, d) => d.sdrs > m.sdrs ? d : m, sorted[0])
    const latest = sorted[sorted.length - 1]
    const improvement = peak.sdrs - latest.sdrs
    if (improvement > 0.01) {
      champions.push({ name: c.name, region: c.region, peak: peak.sdrs, peakYear: peak.year,
        latest: latest.sdrs, latestYear: latest.year, improvement,
        genderGain: (latest.gender_gap != null && peak.gender_gap != null)
          ? latest.gender_gap - peak.gender_gap : null })
    }
  })
  champions.sort((a,b) => b.improvement - a.improvement)
  const allChampions = champions  // total count of improvers
  const top15 = champions.slice(0, 20)
  if (!top15.length) return

  // ── Narrative stats for the Blueprint sidebar ───────────────────
  const top1 = top15[0]
  // Stats computed on ALL improvers (not just the 15 displayed) for accurate narrative
  const genderGainers = allChampions.filter(c => c.genderGain != null && c.genderGain > 0.03).length
  // Years-to-recover scoped to gender-gap champions — the subgroup we're
  // celebrating. Overall mean is dragged by countries whose "peak" year is
  // recent (2024), which overstates recovery maturity.
  const genderGainList = allChampions.filter(c => c.genderGain != null && c.genderGain > 0.03)
  const avgYearsToRecover = genderGainList.length
    ? d3.mean(genderGainList, c => c.latestYear - c.peakYear)
    : d3.mean(allChampions, c => c.latestYear - c.peakYear)
  const uniqueRegions = new Set(allChampions.map(c => c.region))
  const biggestGenderGain = [...allChampions]
    .filter(c => c.genderGain != null)
    .sort((a,b) => (b.genderGain||0) - (a.genderGain||0))[0]

  const barH = 26, barGap = 6
  const margin = { top: 14, right: 110, bottom: 52, left: 130 }
  const W = 720, H = top15.length * (barH + barGap) + margin.top + margin.bottom

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .style('width','100%')
    .attr('preserveAspectRatio','xMidYMid meet')

  // Chart header — sits above the SVG
  const headerHTML = `
    <div class="hope-chart-header">
      <span class="hch-eyebrow">Top 20 Resilience Champions</span>
      <span class="hch-sub">Ranked by SDRS reduction since peak year</span>
    </div>
  `
  container.insertAdjacentHTML('afterbegin', headerHTML)

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom

  const xScale = d3.scaleLinear().domain([0, d3.max(top15, d => d.peak) * 1.05]).range([0, iW])

  // Grid
  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).ticks(5).tickSize(-iH).tickFormat(''))
    .call(ax => { ax.select('.domain').remove(); ax.selectAll('line').attr('stroke','rgba(0,0,0,0.06)') })

  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('.2f')))
    .call(ax => { ax.select('.domain').remove(); ax.selectAll('text').attr('fill','#6B7280').attr('font-size',9) })

  top15.forEach((c, i) => {
    const y = i * (barH + barGap)
    const color = REGION_COLORS[c.region] || '#9CA3AF'

    // Peak bar (faint)
    g.append('rect').attr('x', 0).attr('y', y)
      .attr('width', xScale(c.peak)).attr('height', barH).attr('rx', 3)
      .attr('fill', color).attr('opacity', 0.12)

    // Current bar (animated)
    g.append('rect').attr('x', 0).attr('y', y)
      .attr('width', 0).attr('height', barH).attr('rx', 3)
      .attr('fill', color).attr('opacity', 0.85)
      .transition().duration(800).delay(i * 55).ease(d3.easeCubicOut)
      .attr('width', xScale(c.latest))

    // Country label
    g.append('text').attr('x', -8).attr('y', y + barH/2)
      .attr('text-anchor','end').attr('dominant-baseline','middle')
      .attr('font-size', 13).attr('fill','#374151').attr('font-weight','600')
      .text(c.name.length > 20 ? c.name.slice(0,18)+'…' : c.name)

    // Improvement badge — absolute SDRS reduction (the actual policy story)
    g.append('text').attr('x', xScale(c.latest) + 6).attr('y', y + barH/2)
      .attr('dominant-baseline','middle').attr('font-size', 11).attr('font-weight','700')
      .attr('fill', color)
      .text('▼ ' + c.improvement.toFixed(3))

    // Peak annotation
    g.append('text').attr('x', xScale(c.peak) + 4).attr('y', y + barH/2)
      .attr('dominant-baseline','middle').attr('font-size', 9)
      .attr('font-style', 'italic')
      .attr('fill','rgba(0,0,0,0.45)')
      .text('peak ' + c.peakYear)

    // Hover
    g.append('rect').attr('x', 0).attr('y', y).attr('width', iW).attr('height', barH)
      .attr('fill','transparent').style('cursor','pointer')
      .on('mousemove', function(event) {
        if (!tooltip) return
        const pct = (c.improvement / c.peak) * 100
        const rows = [
          ['Peak SDRS', c.peak.toFixed(3) + ' (' + c.peakYear + ')'],
          ['Current SDRS', c.latest.toFixed(3) + ' (' + c.latestYear + ')'],
          ['Reduction', '−' + c.improvement.toFixed(3) + '  (▼' + pct.toFixed(1) + '%)'],
          ['Region', c.region],
        ]
        if (c.genderGain != null && c.genderGain > 0.01)
          rows.push(['Gender Gap Gain', '+' + c.genderGain.toFixed(3)])
        tooltip.innerHTML = `<div class="tooltip-title">${c.name}</div>` +
          rows.map(([l,v]) => `<div class="tooltip-row"><span class="tooltip-label">${l}</span><span class="tooltip-val">${v}</span></div>`).join('')
        tooltip.classList.remove('hidden')
        tooltip.style.left = (event.clientX + 16) + 'px'
        tooltip.style.top  = (event.clientY - 40) + 'px'
      })
      .on('mouseleave', () => { if (tooltip) tooltip.classList.add('hidden') })
  })

  // Legend
  const ly = H - 18
  svg.append('rect').attr('x', margin.left).attr('y', ly-8).attr('width',14).attr('height',8).attr('rx',2).attr('fill','rgba(0,0,0,0.12)')
  svg.append('text').attr('x', margin.left+18).attr('y', ly).attr('fill','#6B7280').attr('font-size',9).text('Peak SDRS')
  svg.append('rect').attr('x', margin.left+90).attr('y', ly-8).attr('width',14).attr('height',8).attr('rx',2).attr('fill','#2AADAD').attr('opacity',0.85)
  svg.append('text').attr('x', margin.left+108).attr('y', ly).attr('fill','#6B7280').attr('font-size',9).text('Current SDRS (color = region)')

  // ── Blueprint sidebar — editorial insight panel ───────────────
  const blueprintEl = document.getElementById('hope-blueprint')
  if (blueprintEl) {
    const top1Color = REGION_COLORS[top1.region] || '#9CA3AF'
    const yearsLabel = Math.round(avgYearsToRecover) + ' years'

    blueprintEl.innerHTML = `
      <div class="hbp-eyebrow">The Blueprint</div>
      <h3 class="hbp-title">Recovery is possible.</h3>
      <p class="hbp-lede">
        <strong>${allChampions.length} countries</strong> have reduced their She Displacement Risk
        since their peak year — proof that policy, not geography, determines outcomes.
      </p>

      <div class="hbp-divider"></div>

      <!-- Top mover spotlight — consistent coral theme, region shown as a chip -->
      <div class="hbp-spotlight">
        <div class="hbp-spot-label">★ Leading Champion</div>
        <div class="hbp-spot-name">${top1.name}</div>
        <div class="hbp-spot-region" style="background:${top1Color}20; color:${top1Color}">${top1.region}</div>
        <div class="hbp-spot-stats">
          <div class="hbp-stat">
            <div class="hbp-stat-val">▼ ${top1.improvement.toFixed(3)}</div>
            <div class="hbp-stat-lbl">SDRS reduction</div>
          </div>
          <div class="hbp-stat">
            <div class="hbp-stat-val">${top1.peakYear}</div>
            <div class="hbp-stat-lbl">Peak year</div>
          </div>
        </div>
      </div>

      <!-- Insight cards -->
      <div class="hbp-cards">
        <div class="hbp-card">
          <div class="hbp-card-num">${genderGainers}</div>
          <div class="hbp-card-lbl">Champions with meaningful <strong>gender gap gains</strong> (≥0.03)</div>
        </div>
        <div class="hbp-card">
          <div class="hbp-card-num">${uniqueRegions.size}<span class="hbp-card-unit">/8</span></div>
          <div class="hbp-card-lbl">Regions represented — <strong>recovery isn't region-specific</strong></div>
        </div>
        <div class="hbp-card">
          <div class="hbp-card-num">${yearsLabel}</div>
          <div class="hbp-card-lbl">Average time from peak risk to <strong>measurable recovery</strong></div>
        </div>
      </div>

      ${biggestGenderGain && biggestGenderGain.genderGain > 0.03 ? `
        <div class="hbp-quote">
          <div class="hbp-quote-body">
            <strong>${biggestGenderGain.name}</strong> closed its gender gap by
            <span class="hbp-quote-val">+${biggestGenderGain.genderGain.toFixed(3)}</span>
            — the single largest structural gain among champions.
          </div>
        </div>
      ` : ''}

      <p class="hbp-kicker">Closing the gender gap is the most effective climate defense.</p>
    `
  }
}

async function init() {
  // Kick off the world topology fetch in parallel with sdrs_data.json so the
  // map is usually ready the instant the overlay hides. Same-origin from public/
  // → served by Vercel's edge cache with 1-year immutable headers (vercel.json).
  // Falls back to `null` (→ in-chart error message) if the fetch rejects.
  const topologyPromise = d3.json('/countries-110m.json').catch(err => {
    if (import.meta.env.DEV) console.error('[topology] failed:', err)
    return null
  })

  // Load full data — brotli-compressed to ~231KB, loads in <0.5s on most connections
  const data = await d3.json('/sdrs_data.json')

  // Normalize country display names — the source dataset uses verbose UN formal names
  // (several chopped by an upstream CSV field-length cap). Override with short, widely
  // recognized forms so every chart — bar labels, tooltips, slope annotations, search
  // dropdowns — gets them consistently without per-chart truncation.
  const DISPLAY_NAMES = {
    // Truncated in source (missing trailing characters)
    COD: 'DR Congo',
    VEN: 'Venezuela',
    PRK: 'North Korea',
    // Long UN formal names — shorten to common usage
    KOR: 'South Korea',
    IRN: 'Iran',
    LAO: 'Laos',
    BOL: 'Bolivia',
    FSM: 'Micronesia',
    TZA: 'Tanzania',
    MDA: 'Moldova',
    SYR: 'Syria',
    RUS: 'Russia',
    CAF: 'Central African Rep.',
    LBY: 'Libya',
    ARE: 'UAE',
    VCT: 'St. Vincent & Grenadines',
    STP: 'São Tomé & Príncipe',
    BRN: 'Brunei',
    DOM: 'Dominican Rep.',
    CZE: 'Czechia',
    GBR: 'United Kingdom',
    BIH: 'Bosnia & Herzegovina',
    ATG: 'Antigua & Barbuda',
    TTO: 'Trinidad & Tobago',
  }
  data.forEach(d => {
    if (DISPLAY_NAMES[d.iso3]) d.name = DISPLAY_NAMES[d.iso3]
  })

  // Hide loader
  const overlay = document.getElementById('loading-overlay')
  overlay.classList.add('hidden')
  setTimeout(() => overlay.remove(), 700)

  // Navigation
  safe('nav', () => initNav())

  // Insight podcast player — wires hero button + floating card to shared audio
  safe('insightPlayer', () => initInsightPlayer())

  // Hero particles — non-blocking
  initHeroParticles().catch(e => { if (import.meta.env.DEV) console.error('[particles] failed:', e) })

  // Render all charts with full data — year sliders work across 2006-2025
  requestAnimationFrame(() => {
    safe('worldMap',    () => drawWorldMap(data, topologyPromise))
    safe('slope',       () => drawSlopeScrolly(data))
    safe('delta',       () => drawDeltaChart(data))
    safe('radar',       () => drawRadarChart(data))
    safe('outlier',     () => drawOutlierRadar(data))
    safe('lab',         () => initLab(data))
    safe('bubble',      () => drawBubbleChart(data))
    safe('disaster',    () => drawDisasterCharts(data))
    safe('explorer',    () => initExplorer(data))
    safe('hope',        () => drawHopeChart(data))
  })
}

init().catch(err => {
  if (import.meta.env.DEV) console.error('Failed to load data:', err)
  const overlay = document.getElementById('loading-overlay')
  if (overlay) overlay.innerHTML =
    '<div class="loader-content"><p style="color:#E8614A">Failed to load data. Please refresh.</p></div>'
})
