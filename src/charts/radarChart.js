import * as d3 from 'd3'
import { showTooltip, hideTooltip, tooltipHtml } from './utils.js'

// ── Axes definition ──────────────────────────────────────────
// Order intentionally groups by sector: climate → readiness → gender
// This creates contiguous colored wedges in the radar background for easy visual parsing
export const AXES = [
  // Climate sector (3 axes, top)
  { key: 'vulnerability',         label: 'Climate\nVulnerability',  shortLabel: 'Climate',    invert: false, sector: 'climate' },
  { key: 'vuln_food',             label: 'Food\nInsecurity',        shortLabel: 'Food',       invert: false, sector: 'climate' },
  { key: 'vuln_water',            label: 'Water\nRisk',             shortLabel: 'Water',      invert: false, sector: 'climate' },
  // Readiness sector (2 axes)
  { key: 'adaptive_gap',          label: 'Adaptive\nGap',           shortLabel: 'Adapt. Gap', invert: false, sector: 'readiness' },
  { key: 'readiness',             label: 'Readiness',               shortLabel: 'Readiness',  invert: true,  sector: 'readiness' },
  // Gender sector (3 axes)
  { key: 'gender_penalty',        label: 'Gender\nPenalty',         shortLabel: 'Gender',     invert: false, sector: 'gender' },
  { key: 'political_empowerment', label: 'Political\nEmpowerment',  shortLabel: 'Political',  invert: true,  sector: 'gender' },
  { key: 'econ_participation',    label: 'Economic\nParticipation', shortLabel: 'Economic',   invert: true,  sector: 'gender' },
]

// Sector color mapping for background wedges
const SECTOR_COLORS = {
  climate:   { fill: 'rgba(42,173,173,0.12)',  stroke: 'rgba(42,173,173,0.3)' },
  gender:    { fill: 'rgba(232,97,74,0.12)',   stroke: 'rgba(232,97,74,0.3)' },
  readiness: { fill: 'rgba(232,168,74,0.12)',  stroke: 'rgba(232,168,74,0.3)' },
}

const RING_LEVELS = [0.25, 0.5, 0.75, 1.0]

// ── Region config ─────────────────────────────────────────────
const REGIONS = [
  { key: 'Sub-Saharan Africa',        label: 'Sub-Saharan Africa',        color: '#E8614A' },
  { key: 'South Asia',                label: 'South Asia',                color: '#E8A84A' },
  { key: 'MENA',                      label: 'MENA',                      color: '#C0392B' },
  { key: 'East Asia & Pacific',       label: 'East Asia & Pacific',       color: '#2AADAD' },
  { key: 'Latin America & Caribbean', label: 'Latin America & Caribbean', color: '#8B5CF6' },
  { key: 'Europe',                    label: 'Europe',                    color: '#1A7A7A' },
  { key: 'Central Asia',              label: 'Central Asia',              color: '#F59E0B' },
  { key: 'North America',             label: 'North America',             color: '#059669' },
]

const COLOR_A = '#E8614A'
const COLOR_B = '#2AADAD'

// ── Helpers ───────────────────────────────────────────────────
function axisVals(rec) {
  return AXES.map(function(ax) {
    var v = rec[ax.key]
    if (v == null) v = 0
    return ax.invert ? 1 - v : v
  })
}

function regionAvg(yearData, regionKey) {
  var rows = yearData.filter(function(d) { return d.region === regionKey })
  if (!rows.length) return null
  var avg = { region: regionKey, name: regionKey }
  AXES.forEach(function(ax) {
    var vals = rows.map(function(d) { return d[ax.key] }).filter(function(v) { return v != null })
    avg[ax.key] = vals.length ? d3.mean(vals) : 0
  })
  var sdrsVals = rows.map(function(d) { return d.sdrs }).filter(function(v) { return v != null })
  avg.sdrs = sdrsVals.length ? d3.mean(sdrsVals) : 0
  return avg
}

function makeRingPoints(cx, cy, R, r, n, step) {
  var pts = []
  for (var i = 0; i < n; i++) {
    var a = i * step - Math.PI / 2
    pts.push([cx + R * r * Math.cos(a), cy + R * r * Math.sin(a)])
  }
  return pts
}

// ── Main entry ────────────────────────────────────────────────
export function drawRadarChart(data) {
  var tooltip    = document.getElementById('radar-tooltip')
  var yearSlider = document.getElementById('radar-year-slider')
  var yearLabel  = document.getElementById('radar-year-label')

  var currentYear = 2025
  var countryA    = 'AFG'
  var countryB    = 'NOR'
  var activeView  = 'continental'

  var countries = Array.from(new Map(
    data.filter(function(d) { return d.name }).map(function(d) { return [d.iso3, d.name] })
  ).entries()).sort(function(a, b) { return a[1].localeCompare(b[1]) })

  setupSearch('country-a-input', 'country-a-dropdown', countries, function(iso3) {
    countryA = iso3
    if (activeView === 'country') renderCountry()
  })
  setupSearch('country-b-input', 'country-b-dropdown', countries, function(iso3) {
    countryB = iso3
    if (activeView === 'country') renderCountry()
  })

  document.getElementById('country-a-input').value = 'Afghanistan'
  document.getElementById('country-b-input').value = 'Norway'

  document.querySelectorAll('.radar-view-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.radar-view-btn').forEach(function(b) { b.classList.remove('active') })
      btn.classList.add('active')
      activeView = btn.dataset.view
      document.getElementById('radar-view-continental').classList.toggle('active', activeView === 'continental')
      document.getElementById('radar-view-country').classList.toggle('active', activeView === 'country')
      if (activeView === 'continental') renderContinental()
      else renderCountry()
    })
  })

  yearSlider.addEventListener('input', function() {
    currentYear = +yearSlider.value
    yearLabel.textContent = currentYear
    if (activeView === 'continental') renderContinental()
    else renderCountry()
  })

  function renderContinental() {
    var yearData = data.filter(function(d) { return d.year === currentYear })
    var grid = document.getElementById('continental-grid')
    grid.innerHTML = ''

    // Global median SDRS for this year — benchmark against which regions compare
    var globalSdrsVals = yearData.map(function(d) { return d.sdrs }).filter(function(v) { return v != null })
    var globalMedian = globalSdrsVals.length ? d3.median(globalSdrsVals) : null

    REGIONS.forEach(function(region) {
      var avg = regionAvg(yearData, region.key)
      if (!avg) return

      var cell = document.createElement('div')
      cell.className = 'continental-cell'

      var titleEl = document.createElement('div')
      titleEl.className = 'continental-cell-title'
      titleEl.style.color = region.color
      titleEl.textContent = region.label
      cell.appendChild(titleEl)

      var chartDiv = document.createElement('div')
      chartDiv.className = 'continental-radar-wrap'
      cell.appendChild(chartDiv)

      var badge = document.createElement('div')
      badge.className = 'continental-badge'
      var deltaHtml = ''
      if (globalMedian != null) {
        var delta = avg.sdrs - globalMedian
        var deltaClass = delta > 0.02 ? 'cb-up' : delta < -0.02 ? 'cb-down' : 'cb-flat'
        var deltaSign = delta >= 0 ? '+' : '−'
        deltaHtml = '<span class="cb-delta ' + deltaClass + '" title="Compared to the global median SDRS (' + globalMedian.toFixed(3) + ') across all countries in ' + currentYear + '. Positive = worse than global.">' + deltaSign + Math.abs(delta).toFixed(3) + ' vs&nbsp;global</span>'
      }
      badge.innerHTML = '<span class="cb-score" style="color:' + region.color + '">SDRS ' + avg.sdrs.toFixed(3) + '</span>' + deltaHtml
      cell.appendChild(badge)

      grid.appendChild(cell)
      drawSmallRadar(chartDiv, avg, region.color, document.getElementById('continental-tooltip'))
    })
  }

  function renderCountry() {
    var yearData = data.filter(function(d) { return d.year === currentYear })
    var recA = yearData.find(function(d) { return d.iso3 === countryA })
    var recB = yearData.find(function(d) { return d.iso3 === countryB })
    var ghostA = recA ? regionAvg(yearData, recA.region) : null
    var ghostB = recB ? regionAvg(yearData, recB.region) : null
    drawSingleRadar('radar-chart-a', recA, COLOR_A, tooltip, ghostA)
    drawSingleRadar('radar-chart-b', recB, COLOR_B, tooltip, ghostB)
  }

  renderContinental()
}

// ── Small radar for continental gallery ──────────────────────
function drawSmallRadar(container, rec, color, tooltip) {
  var size = 220
  var cx = size / 2
  var cy = size / 2
  var R  = size * 0.30
  var n  = AXES.length
  var step = (2 * Math.PI) / n

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + size + ' ' + size)
    .attr('width', '100%')
    .attr('preserveAspectRatio', 'xMidYMid meet')

  // Colored sector wedges (background)
  var sectorR = R + 6
  AXES.forEach(function(ax, i) {
    var sc = SECTOR_COLORS[ax.sector]
    var startAngle = i * step - Math.PI / 2 - step / 2
    var endAngle = startAngle + step

    var arc = d3.arc()
      .innerRadius(0)
      .outerRadius(sectorR)
      .startAngle(startAngle + Math.PI / 2)  // d3.arc uses 12-o'clock as 0
      .endAngle(endAngle + Math.PI / 2)

    svg.append('path')
      .attr('transform', 'translate(' + cx + ',' + cy + ')')
      .attr('d', arc)
      .attr('fill', sc.fill)
      .attr('stroke', sc.stroke)
      .attr('stroke-width', 0.5)
  })

  // Background rings
  RING_LEVELS.forEach(function(r) {
    var pts = makeRingPoints(cx, cy, R, r, n, step)
    svg.append('polygon')
      .attr('points', pts.map(function(p) { return p.join(',') }).join(' '))
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.1)')
      .attr('stroke-width', 0.5)
  })

  // Axis spokes
  AXES.forEach(function(ax, i) {
    var a = i * step - Math.PI / 2
    svg.append('line')
      .attr('x1', cx).attr('y1', cy)
      .attr('x2', cx + R * Math.cos(a))
      .attr('y2', cy + R * Math.sin(a))
      .attr('stroke', 'rgba(255,255,255,0.1)')
      .attr('stroke-width', 0.5)
  })

  var vals = axisVals(rec)

  // Data polygon
  var dataPts = vals.map(function(v, i) {
    var a = i * step - Math.PI / 2
    return [cx + R * v * Math.cos(a), cy + R * v * Math.sin(a)]
  })

  svg.append('polygon')
    .attr('points', dataPts.map(function(p) { return p.join(',') }).join(' '))
    .attr('fill', color)
    .attr('fill-opacity', 0.22)
    .attr('stroke', color)
    .attr('stroke-width', 1.5)

  // Axis labels — use short single-line labels to avoid clipping
  AXES.forEach(function(ax, i) {
    var a  = i * step - Math.PI / 2
    var lx = cx + (R + 22) * Math.cos(a)
    var ly = cy + (R + 22) * Math.sin(a)

    // Sector-based label color
    var labelColor = ax.sector === 'climate' ? 'rgba(42,173,173,0.85)'
      : ax.sector === 'gender' ? 'rgba(244,149,127,0.85)'
      : 'rgba(232,168,74,0.85)'

    svg.append('text')
      .attr('x', lx).attr('y', ly)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', labelColor)
      .attr('font-size', 9)
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, sans-serif')
      .text(ax.shortLabel)
  })

  // Hover dots
  dataPts.forEach(function(pt, i) {
    svg.append('circle')
      .attr('cx', pt[0]).attr('cy', pt[1]).attr('r', 3)
      .attr('fill', color)
      .attr('stroke', 'rgba(255,255,255,0.4)')
      .attr('stroke-width', 0.8)
      .style('cursor', 'pointer')
      .on('mousemove', function(event) {
        var ax  = AXES[i]
        var raw = rec[ax.key]
        showTooltip(tooltip, tooltipHtml(
          ax.label.replace('\n', ' '),
          [
            ['Region', rec.region || rec.name],
            ['Value', raw != null ? raw.toFixed(3) : 'N/A'],
            ['Risk Level', (vals[i] * 100).toFixed(0) + '%'],
          ]
        ), event)
      })
      .on('mouseleave', function() { hideTooltip(tooltip) })
  })
}

// ── Full-size radar for country comparison ────────────────────
export function drawSingleRadar(containerId, rec, color, tooltip, ghostRec, opts) {
  opts = opts || {}
  var showBadge = opts.showBadge !== false  // default true
  var container = document.getElementById(containerId)
  container.innerHTML = ''

  if (!rec) {
    container.innerHTML = '<div class="radar-empty"><p>No data available for this country and year.</p></div>'
    return
  }

  // Title above the radar
  var titleEl = document.createElement('div')
  titleEl.className = 'radar-country-title'
  titleEl.style.color = color
  titleEl.textContent = rec.name
  container.appendChild(titleEl)

  // Radar SVG wrapper
  var svgWrap = document.createElement('div')
  svgWrap.className = 'radar-svg-wrap'
  container.appendChild(svgWrap)

  var size = 400
  var cx = size / 2
  var cy = size / 2
  var R  = size * 0.32
  var n  = AXES.length
  var step = (2 * Math.PI) / n

  var svg = d3.select(svgWrap)
    .append('svg')
    .attr('viewBox', '0 0 ' + size + ' ' + size)
    .attr('width', '100%')
    .attr('preserveAspectRatio', 'xMidYMid meet')

  // Colored sector wedges (background)
  var sectorR = R + 8
  AXES.forEach(function(ax, i) {
    var sc = SECTOR_COLORS[ax.sector]
    var startAngle = i * step - Math.PI / 2 - step / 2
    var endAngle = startAngle + step

    var arc = d3.arc()
      .innerRadius(0)
      .outerRadius(sectorR)
      .startAngle(startAngle + Math.PI / 2)
      .endAngle(endAngle + Math.PI / 2)

    svg.append('path')
      .attr('transform', 'translate(' + cx + ',' + cy + ')')
      .attr('d', arc)
      .attr('fill', sc.fill)
      .attr('stroke', sc.stroke)
      .attr('stroke-width', 0.6)
  })

  // Background rings
  RING_LEVELS.forEach(function(r) {
    var pts = makeRingPoints(cx, cy, R, r, n, step)
    svg.append('polygon')
      .attr('points', pts.map(function(p) { return p.join(',') }).join(' '))
      .attr('fill', 'none')
      .attr('stroke', r === 1.0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)')
      .attr('stroke-width', r === 1.0 ? 1 : 0.7)

    if (r < 1.0) {
      var la = -Math.PI / 2
      svg.append('text')
        .attr('x', cx + R * r * Math.cos(la) + 4)
        .attr('y', cy + R * r * Math.sin(la) - 3)
        .attr('fill', 'rgba(255,255,255,0.2)')
        .attr('font-size', 7)
        .text(r.toFixed(2))
    }
  })

  // Axis spokes
  AXES.forEach(function(ax, i) {
    var a = i * step - Math.PI / 2
    svg.append('line')
      .attr('x1', cx).attr('y1', cy)
      .attr('x2', cx + R * Math.cos(a))
      .attr('y2', cy + R * Math.sin(a))
      .attr('stroke', 'rgba(255,255,255,0.1)')
      .attr('stroke-width', 0.8)
  })

  // Ghost layer: regional average — dark dashed outline with amber glow (light bg friendly)
  if (ghostRec) {
    var ghostVals = axisVals(ghostRec)
    var ghostPts  = ghostVals.map(function(v, i) {
      var a = i * step - Math.PI / 2
      return [cx + R * v * Math.cos(a), cy + R * v * Math.sin(a)]
    })

    // Soft warm glow underneath — amber tint
    svg.append('polygon')
      .attr('points', ghostPts.map(function(p) { return p.join(',') }).join(' '))
      .attr('fill', 'none')
      .attr('stroke', 'rgba(232,168,74,0.3)')
      .attr('stroke-width', 5)
      .attr('stroke-linejoin', 'round')

    // Main dashed ghost line — ink-dark, architectural reference
    svg.append('polygon')
      .attr('points', ghostPts.map(function(p) { return p.join(',') }).join(' '))
      .attr('fill', 'rgba(26,26,46,0.03)')
      .attr('stroke', 'rgba(26,26,46,0.55)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3')
      .attr('stroke-linejoin', 'round')

    // Ghost vertex markers — small amber-ringed dots
    ghostPts.forEach(function(pt) {
      svg.append('circle')
        .attr('cx', pt[0]).attr('cy', pt[1]).attr('r', 2.5)
        .attr('fill', 'rgba(232,168,74,0.9)')
        .attr('stroke', 'rgba(26,26,46,0.6)')
        .attr('stroke-width', 0.8)
    })
  }

  // Country polygon
  var vals = axisVals(rec)
  var dataPts = vals.map(function(v, i) {
    var a = i * step - Math.PI / 2
    return [cx + R * v * Math.cos(a), cy + R * v * Math.sin(a)]
  })

  var polygon = svg.append('polygon')
    .attr('points', dataPts.map(function(p) { return p.join(',') }).join(' '))
    .attr('fill', color)
    .attr('fill-opacity', 0)
    .attr('stroke', color)
    .attr('stroke-width', 2)

  polygon.transition().duration(600).ease(d3.easeCubicOut)
    .attr('fill-opacity', 0.2)

  // Vertex dots
  dataPts.forEach(function(pt, i) {
    svg.append('circle')
      .attr('cx', pt[0]).attr('cy', pt[1]).attr('r', 4.5)
      .attr('fill', color)
      .attr('stroke', 'rgba(255,255,255,0.5)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mousemove', function(event) {
        var ax  = AXES[i]
        var raw = rec[ax.key]
        var ghostVal = ghostRec ? ghostRec[ax.key] : null
        var rows = [
          ['Value', raw != null ? raw.toFixed(3) : 'N/A'],
          ['Risk Level', (vals[i] * 100).toFixed(0) + '%'],
        ]
        if (ghostVal != null) {
          var diff = ax.invert ? (ghostVal - raw) : (raw - ghostVal)
          rows.push(['vs Regional Avg', (diff >= 0 ? '+' : '') + diff.toFixed(3)])
        }
        showTooltip(tooltip, tooltipHtml(ax.label.replace('\n', ' '), rows), event)
      })
      .on('mouseleave', function() { hideTooltip(tooltip) })
  })

  // Axis labels — sector-colored
  AXES.forEach(function(ax, i) {
    var a  = i * step - Math.PI / 2
    var lx = cx + (R + 34) * Math.cos(a)
    var ly = cy + (R + 34) * Math.sin(a)
    var lines = ax.label.split('\n')

    var labelColor = ax.sector === 'climate' ? 'rgba(42,173,173,0.85)'
      : ax.sector === 'gender' ? 'rgba(244,149,127,0.85)'
      : 'rgba(232,168,74,0.85)'

    var t = svg.append('text')
      .attr('x', lx).attr('y', ly)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', labelColor)
      .attr('font-size', 11)
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, sans-serif')
    lines.forEach(function(line, li) {
      t.append('tspan')
        .attr('x', lx)
        .attr('dy', li === 0 ? (lines.length > 1 ? '-0.5em' : '0') : '1.1em')
        .text(line)
    })
  })

  // Badge below the radar (SDRS + regional avg)
  if (showBadge) {
    var badge = document.createElement('div')
    badge.className = 'radar-country-badge'
    var badgeHtml = '<span class="rcb-main" style="color:' + color + '">SDRS ' + rec.sdrs.toFixed(3) + '</span>'
    if (ghostRec) {
      badgeHtml += '<span class="rcb-sep">·</span><span class="rcb-sub">' + rec.region + ' avg ' + ghostRec.sdrs.toFixed(3) + '</span>'
    }
    badge.innerHTML = badgeHtml
    container.appendChild(badge)
  }
}

// ── Dropdown search ───────────────────────────────────────────
function setupSearch(inputId, dropdownId, countries, onSelect) {
  var input    = document.getElementById(inputId)
  var dropdown = document.getElementById(dropdownId)

  input.addEventListener('input', function() {
    var q = input.value.toLowerCase()
    var matches = countries.filter(function(c) {
      return c[1].toLowerCase().includes(q)
    }).slice(0, 10)
    dropdown.innerHTML = ''
    if (!matches.length || !q) { dropdown.classList.add('hidden'); return }
    matches.forEach(function(c) {
      var item = document.createElement('div')
      item.className = 'dropdown-item'
      item.textContent = c[1]
      item.addEventListener('click', function() {
        input.value = c[1]
        dropdown.classList.add('hidden')
        onSelect(c[0])
      })
      dropdown.appendChild(item)
    })
    dropdown.classList.remove('hidden')
  })

  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target))
      dropdown.classList.add('hidden')
  })
}
