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

function safe(name, fn) {
  try { fn() } catch(e) { console.error(`[${name}] failed:`, e) }
}

// ── Hope: Resilience Champions ────────────────────────────────
function drawHopeChart(data) {
  const container = document.getElementById('hope-chart')
  const tooltip   = document.getElementById('hope-tooltip')
  if (!container) return

  const REGION_COLORS = {
    'Sub-Saharan Africa':'#E8614A','South Asia':'#E8A84A','MENA':'#C0392B',
    'East Asia':'#2AADAD','Latin America':'#8B5CF6','Europe':'#1A7A7A',
    'North America':'#059669','Oceania':'#0EA5E9','Central Asia':'#F59E0B','Other':'#9CA3AF',
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
  const top15 = champions.slice(0, 15)
  if (!top15.length) return

  const barH = 30, barGap = 8
  const margin = { top: 24, right: 180, bottom: 36, left: 170 }
  const W = 900, H = top15.length * (barH + barGap) + margin.top + margin.bottom

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .style('width','100%')
    .attr('preserveAspectRatio','xMidYMid meet')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom

  const xScale = d3.scaleLinear().domain([0, d3.max(top15, d => d.peak) * 1.05]).range([0, iW])

  // Grid
  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).ticks(5).tickSize(-iH).tickFormat(''))
    .call(ax => { ax.select('.domain').remove(); ax.selectAll('line').attr('stroke','rgba(255,255,255,0.06)') })

  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('.2f')))
    .call(ax => { ax.select('.domain').remove(); ax.selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9) })

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
      .attr('font-size', 11).attr('fill','rgba(255,255,255,0.75)')
      .text(c.name.length > 20 ? c.name.slice(0,18)+'…' : c.name)

    // Improvement badge
    g.append('text').attr('x', xScale(c.latest) + 8).attr('y', y + barH/2)
      .attr('dominant-baseline','middle').attr('font-size', 10).attr('font-weight','700')
      .attr('fill', color)
      .text('▼ ' + c.improvement.toFixed(3))

    // Peak annotation
    g.append('text').attr('x', xScale(c.peak) + 4).attr('y', y + barH/2)
      .attr('dominant-baseline','middle').attr('font-size', 8.5)
      .attr('fill','rgba(255,255,255,0.2)')
      .text('peak ' + c.peakYear)

    // Hover
    g.append('rect').attr('x', 0).attr('y', y).attr('width', iW).attr('height', barH)
      .attr('fill','transparent').style('cursor','pointer')
      .on('mousemove', function(event) {
        if (!tooltip) return
        const rows = [
          ['Peak SDRS', c.peak.toFixed(3) + ' (' + c.peakYear + ')'],
          ['Current SDRS', c.latest.toFixed(3) + ' (' + c.latestYear + ')'],
          ['Improvement', '▼ ' + c.improvement.toFixed(3)],
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
  svg.append('rect').attr('x', margin.left).attr('y', ly-8).attr('width',14).attr('height',8).attr('rx',2).attr('fill','rgba(255,255,255,0.12)')
  svg.append('text').attr('x', margin.left+18).attr('y', ly).attr('fill','rgba(255,255,255,0.3)').attr('font-size',9).text('Peak SDRS')
  svg.append('rect').attr('x', margin.left+90).attr('y', ly-8).attr('width',14).attr('height',8).attr('rx',2).attr('fill','#2AADAD').attr('opacity',0.85)
  svg.append('text').attr('x', margin.left+108).attr('y', ly).attr('fill','rgba(255,255,255,0.3)').attr('font-size',9).text('Current SDRS (color = region)')
}

async function init() {
  const data = await d3.json('/sdrs_data.json')

  // Hide loader
  const overlay = document.getElementById('loading-overlay')
  overlay.classList.add('hidden')
  setTimeout(() => overlay.remove(), 700)

  // Navigation first
  safe('nav', () => initNav())

  // Hero particles
  safe('particles', () => initHeroParticles())

  // Give browser one frame to paint the DOM before reading dimensions
  requestAnimationFrame(() => {
    setTimeout(() => {
      safe('worldMap',    () => drawWorldMap(data))
      safe('slope',       () => drawSlopeScrolly(data))
      safe('bubble',      () => drawBubbleChart(data))
      safe('radar',       () => drawRadarChart(data))
      safe('delta',       () => drawDeltaChart(data))
      safe('outlier',     () => drawOutlierRadar(data))
      safe('disaster',    () => drawDisasterCharts(data))
      safe('explorer',    () => initExplorer(data))
      safe('lab',         () => initLab(data))
      safe('hope',        () => drawHopeChart(data))
    }, 100)
  })
}

init().catch(err => {
  console.error('Failed to load data:', err)
  const overlay = document.getElementById('loading-overlay')
  if (overlay) overlay.innerHTML =
    '<div class="loader-content"><p style="color:#E8614A">Failed to load data. Please refresh.</p></div>'
})
