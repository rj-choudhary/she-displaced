import * as d3 from 'd3'
import { showTooltip, hideTooltip, tooltipHtml } from './utils.js'

// ── Constants ─────────────────────────────────────────────────
const DTYPE_META = {
  drought:                     { label: 'Drought',        category: 'Climatological', color: '#E8A84A' },
  glacial_lake_outburst_flood: { label: 'Glacial Flood',  category: 'Climatological', color: '#C0392B' },
  wildfire:                    { label: 'Wildfire',        category: 'Climatological', color: '#F4957F' },
  flood:                       { label: 'Flood',           category: 'Hydrological',   color: '#2AADAD' },
  mass_movement_wet:           { label: 'Landslide',       category: 'Hydrological',   color: '#1A7A7A' },
  extreme_temperature:         { label: 'Extreme Heat',   category: 'Meteorological', color: '#8B5CF6' },
  storm:                       { label: 'Storm',           category: 'Meteorological', color: '#6366F1' },
}

const CAT_COLOR = {
  Climatological: '#E8A84A',
  Hydrological:   '#2AADAD',
  Meteorological: '#8B5CF6',
}

const DTYPES = Object.keys(DTYPE_META)

// ── Number formatter: 1.2M / 450K / 847 ───────────────────────
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—'
  var n = Number(v)
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K'
  return Math.round(n).toString()
}

// ── Main entry ────────────────────────────────────────────────
export function drawDisasterCharts(data) {
  var countryInput    = document.getElementById('disaster-country-input')
  var countryDropdown = document.getElementById('disaster-country-dropdown')
  var yearSlider      = document.getElementById('disaster-year-slider')
  var yearLabel       = document.getElementById('disaster-year-label')
  var lmValue         = document.getElementById('lm-value')

  var selectedIso  = 'VNM'  // Vietnam — good example with flood dominance
  var selectedYear = 2025

  // Country list
  var countries = Array.from(new Map(
    data.filter(function(d) { return d.name }).map(function(d) { return [d.iso3, d.name] })
  ).entries()).sort(function(a, b) { return a[1].localeCompare(b[1]) })

  // Set initial value
  var initName = countries.find(function(c) { return c[0] === selectedIso })
  if (initName) countryInput.value = initName[1]

  // Dropdown search
  countryInput.addEventListener('input', function() {
    var q = countryInput.value.toLowerCase()
    var matches = countries.filter(function(c) { return c[1].toLowerCase().includes(q) }).slice(0, 10)
    countryDropdown.innerHTML = ''
    if (!matches.length || !q) { countryDropdown.classList.add('hidden'); return }
    matches.forEach(function(c) {
      var item = document.createElement('div')
      item.className = 'dropdown-item'
      item.textContent = c[1]
      item.addEventListener('click', function() {
        countryInput.value = c[1]
        countryDropdown.classList.add('hidden')
        selectedIso = c[0]
        renderAll()
      })
      countryDropdown.appendChild(item)
    })
    countryDropdown.classList.remove('hidden')
  })
  document.addEventListener('click', function(e) {
    if (!countryInput.contains(e.target) && !countryDropdown.contains(e.target))
      countryDropdown.classList.add('hidden')
  })

  yearSlider.addEventListener('input', function() {
    selectedYear = +yearSlider.value
    yearLabel.textContent = selectedYear
    renderAll()
  })

  function renderAll() {
    var countryData = data.filter(function(d) { return d.iso3 === selectedIso })
    var yearRec = countryData.find(function(d) { return d.year === selectedYear })

    // Update lethality multiplier
    if (yearRec && yearRec.lethality_multiplier != null) {
      lmValue.textContent = yearRec.lethality_multiplier.toFixed(5)
      lmValue.style.color = yearRec.lethality_multiplier > 0.001 ? '#E8614A' : '#2AADAD'
    } else {
      lmValue.textContent = '—'
      lmValue.style.color = '#6B7280'
    }

    drawSunburst(yearRec, selectedIso)
    drawLethalityMatrix(countryData, selectedIso)
    drawStreamgraph(countryData, selectedIso)
  }

  renderAll()
}

// ── 05A: Genetic Makeup Waffle Chart ──────────────────────────
// Each cell = 1% of affected population, colored by disaster type
// Creates a "DNA strip" feel aligned with the "Genetic Makeup" narrative
function drawSunburst(rec, iso) {
  var container = document.getElementById('sunburst-chart')
  var tooltip   = document.getElementById('sunburst-tooltip')
  container.innerHTML = ''

  var W = 360, H = 320
  var margin = { top: 14, right: 14, bottom: 20, left: 14 }

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + W + ' ' + H)
    .style('width', '100%')
    .style('height', '320px')
    .attr('preserveAspectRatio', 'xMidYMid meet')

  // No data state
  if (!rec || !rec.disasters) {
    svg.append('text')
      .attr('x', W/2).attr('y', H/2)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.4)').attr('font-size', 13)
      .text('No disaster data for this year')
    return
  }

  // Build subtype list with affected counts
  var subtypes = []
  DTYPES.forEach(function(dtype) {
    var meta = DTYPE_META[dtype]
    var d    = rec.disasters[dtype]
    if (!d || d.affected <= 0) return
    subtypes.push({
      key: dtype,
      label: meta.label,
      category: meta.category,
      affected: d.affected,
      deaths: d.deaths,
      count: d.count,
      color: meta.color,
    })
  })

  if (!subtypes.length) {
    svg.append('text')
      .attr('x', W/2).attr('y', H/2)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.4)').attr('font-size', 13)
      .text('No affected population recorded')
    return
  }

  var totalAffected = d3.sum(subtypes, function(d) { return d.affected })

  // Sort subtypes by affected count descending for visual order
  subtypes.sort(function(a, b) { return b.affected - a.affected })

  // Compute how many cells each subtype gets (out of 100)
  var cellCounts = subtypes.map(function(s) {
    return Object.assign({}, s, { exactPct: (s.affected / totalAffected) * 100, cells: 0 })
  })

  // Floor-then-distribute-remainder method to get exact 100 cells
  var totalFloored = 0
  cellCounts.forEach(function(c) {
    c.cells = Math.floor(c.exactPct)
    totalFloored += c.cells
  })
  var remainder = 100 - totalFloored
  var byFraction = cellCounts.slice()
    .map(function(c) { return { ref: c, frac: c.exactPct - Math.floor(c.exactPct) } })
    .sort(function(a, b) { return b.frac - a.frac })
  for (var i = 0; i < remainder && i < byFraction.length; i++) {
    byFraction[i].ref.cells += 1
  }

  // Ensure every subtype with >0 affected gets at least 1 cell
  cellCounts.forEach(function(c) {
    if (c.affected > 0 && c.cells === 0) {
      var largest = cellCounts.reduce(function(a, b) { return a.cells > b.cells ? a : b })
      if (largest.cells > 1) {
        largest.cells -= 1
        c.cells = 1
      }
    }
  })

  // Grid: 10 cols × 10 rows, legend on right
  var COLS = 10, ROWS = 10
  var legendWidth = 140
  var gridAreaW = W - margin.left - margin.right - legendWidth
  var gridAreaH = H - margin.top - margin.bottom - 24
  var cellSize = Math.min(gridAreaW / COLS, gridAreaH / ROWS) - 2
  var gap = 2.5
  var gridStartX = margin.left + 4
  var gridStartY = margin.top + 4

  // Build cell data array (100 cells assigned by subtype)
  var cells = []
  cellCounts.forEach(function(subtype) {
    for (var j = 0; j < subtype.cells; j++) {
      cells.push(subtype)
    }
  })
  // Pad to 100 if any cells are missing
  while (cells.length < 100) {
    cells.push({ color: 'rgba(255,255,255,0.08)', label: 'Other', affected: 0, deaths: 0, count: 0, category: '—', key: null })
  }

  // Grid background frame
  svg.append('rect')
    .attr('x', gridStartX - 4).attr('y', gridStartY - 4)
    .attr('width', COLS * (cellSize + gap) + 4)
    .attr('height', ROWS * (cellSize + gap) + 4)
    .attr('fill', 'rgba(255,255,255,0.02)')
    .attr('stroke', 'rgba(255,255,255,0.08)')
    .attr('stroke-width', 1)
    .attr('rx', 4)

  // Draw cells with staggered animation from bottom-up
  cells.forEach(function(cell, idx) {
    var col = idx % COLS
    var row = Math.floor(idx / COLS)
    var y = gridStartY + (ROWS - 1 - row) * (cellSize + gap)
    var x = gridStartX + col * (cellSize + gap)

    var rect = svg.append('rect')
      .attr('x', x).attr('y', y)
      .attr('width', cellSize).attr('height', cellSize)
      .attr('rx', 2)
      .attr('fill', cell.color)
      .attr('opacity', 0)
      .attr('data-subtype', cell.key || 'other')
      .style('cursor', cell.affected > 0 ? 'pointer' : 'default')

    rect.transition()
      .duration(400)
      .delay(idx * 8)
      .ease(d3.easeCubicOut)
      .attr('opacity', cell.affected > 0 ? 0.9 : 0.25)

    if (cell.affected > 0) {
      rect
        .on('mousemove', function(event) {
          // Highlight all cells of same subtype
          svg.selectAll('rect[data-subtype="' + cell.key + '"]')
            .attr('opacity', 1)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
          svg.selectAll('rect[data-subtype]:not([data-subtype="' + cell.key + '"])')
            .attr('opacity', 0.25)

          showTooltip(tooltip, tooltipHtml(cell.label, [
            ['Category', cell.category],
            ['Affected', fmtNum(cell.affected)],
            ['Deaths', fmtNum(cell.deaths)],
            ['Events', cell.count],
            ['Share', (cell.affected / totalAffected * 100).toFixed(1) + '%'],
          ]), event)
        })
        .on('mouseleave', function() {
          svg.selectAll('rect[data-subtype]')
            .attr('stroke', null)
            .attr('stroke-width', null)
            .attr('opacity', function() {
              return this.getAttribute('data-subtype') === 'other' ? 0.25 : 0.9
            })
          hideTooltip(tooltip)
        })
    }
  })

  // "Each cell = 1%" caption beneath grid
  svg.append('text')
    .attr('x', gridStartX)
    .attr('y', gridStartY + ROWS * (cellSize + gap) + 14)
    .attr('fill', 'rgba(255,255,255,0.35)')
    .attr('font-size', 9)
    .attr('font-style', 'italic')
    .text('Each cell = 1% of affected population')

  // Right-side legend
  var legendX = gridStartX + COLS * (cellSize + gap) + 14
  var legendTop = gridStartY - 2

  svg.append('text')
    .attr('x', legendX).attr('y', legendTop + 8)
    .attr('fill', 'rgba(255,255,255,0.5)')
    .attr('font-size', 9)
    .attr('font-weight', '700')
    .attr('letter-spacing', '0.14em')
    .text('BREAKDOWN')

  // Legend rows — visible subtypes
  var visibleSubs = cellCounts.filter(function(c) { return c.cells > 0 }).slice(0, 6)
  visibleSubs.forEach(function(sub, idx) {
    var y = legendTop + 26 + idx * 26

    // Color chip
    svg.append('rect')
      .attr('x', legendX).attr('y', y - 7)
      .attr('width', 10).attr('height', 10).attr('rx', 2)
      .attr('fill', sub.color)
      .style('cursor', 'pointer')

    // Label
    svg.append('text')
      .attr('x', legendX + 16).attr('y', y)
      .attr('fill', 'rgba(255,255,255,0.85)')
      .attr('font-size', 10.5)
      .attr('font-weight', '600')
      .attr('dominant-baseline', 'middle')
      .text(sub.label)

    // Percentage + count
    svg.append('text')
      .attr('x', legendX + 16).attr('y', y + 11)
      .attr('fill', 'rgba(255,255,255,0.45)')
      .attr('font-size', 9)
      .attr('dominant-baseline', 'middle')
      .text(sub.exactPct.toFixed(1) + '% · ' + fmtNum(sub.affected))
  })

  // Total affected — bottom of legend area
  var totalY = H - margin.bottom - 10
  svg.append('text')
    .attr('x', legendX)
    .attr('y', totalY - 8)
    .attr('fill', '#E8614A')
    .attr('font-size', 9)
    .attr('font-weight', '700')
    .attr('letter-spacing', '0.1em')
    .text('TOTAL AFFECTED')

  svg.append('text')
    .attr('x', legendX)
    .attr('y', totalY + 10)
    .attr('fill', '#fff')
    .attr('font-size', 20)
    .attr('font-weight', '700')
    .text(fmtNum(totalAffected))
}

// ── 05C: Lethality vs Disruption Matrix ───────────────────────
function drawLethalityMatrix(countryData, iso) {
  var container = document.getElementById('lethality-chart')
  var tooltip   = document.getElementById('lethality-tooltip')
  container.innerHTML = ''

  // Wider chart for better readability
  var W = 460, H = 340
  var margin = { top: 16, right: 24, bottom: 56, left: 52 }
  var iW = W - margin.left - margin.right
  var iH = H - margin.top - margin.bottom

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + W + ' ' + H)
    .style('width', '100%')
    .style('height', '340px')
    .attr('preserveAspectRatio', 'xMidYMid meet')

  var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

  var pts = countryData.filter(function(d) {
    return d.total_affected > 0 || d.total_deaths > 0
  })

  if (!pts.length) {
    svg.append('text').attr('x', W/2).attr('y', H/2)
      .attr('text-anchor', 'middle').attr('fill', '#6B7280').attr('font-size', 12)
      .text('No disaster data available')
    return
  }

  var xScale = d3.scaleLog()
    .domain([1, d3.max(pts, function(d) { return d.total_affected + 1 }) * 1.2])
    .range([0, iW]).clamp(true)

  var yScale = d3.scaleLog()
    .domain([1, d3.max(pts, function(d) { return d.total_deaths + 1 }) * 1.2])
    .range([iH, 0]).clamp(true)

  var colorScale = d3.scaleSequential()
    .domain([0.4, 0.85])
    .interpolator(d3.interpolateRgb('#C0392B', '#0D9488'))
    .clamp(true)

  var midX = xScale(d3.median(pts, function(d) { return d.total_affected + 1 }))
  var midY = yScale(d3.median(pts, function(d) { return d.total_deaths + 1 }))

  // Quadrant fills — all 4 quadrants
  // Top-left: high deaths, low affected = RARE TRAGEDY
  g.append('rect').attr('x', 0).attr('y', 0)
    .attr('width', midX).attr('height', midY)
    .attr('fill', 'rgba(139,92,246,0.05)')

  // Top-right: high deaths, high affected = CATASTROPHE
  g.append('rect').attr('x', midX).attr('y', 0)
    .attr('width', iW - midX).attr('height', midY)
    .attr('fill', 'rgba(192,57,43,0.07)')

  // Bottom-left: low deaths, low affected = MANAGED
  g.append('rect').attr('x', 0).attr('y', midY)
    .attr('width', midX).attr('height', iH - midY)
    .attr('fill', 'rgba(255,255,255,0.02)')

  // Bottom-right: low deaths, high affected = SILENT CRISIS
  g.append('rect').attr('x', midX).attr('y', midY)
    .attr('width', iW - midX).attr('height', iH - midY)
    .attr('fill', 'rgba(13,148,136,0.09)')

  // Dashed border on Silent Crisis
  g.append('rect').attr('x', midX).attr('y', midY)
    .attr('width', iW - midX).attr('height', iH - midY)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(13,148,136,0.4)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3')

  // Quadrant pill labels — all 4 quadrants
  function pillLabel(x, y, text, bg, anchor) {
    var pad = 4
    var tw  = text.length * 5.5 + pad * 2
    var th  = 13
    var rx  = anchor === 'end' ? x - tw : x
    g.append('rect')
      .attr('x', rx).attr('y', y - th + 3)
      .attr('width', tw).attr('height', th)
      .attr('fill', bg).attr('rx', 3).attr('opacity', 0.85)
    g.append('text')
      .attr('x', anchor === 'end' ? x - pad : x + pad)
      .attr('y', y - 2)
      .attr('text-anchor', anchor === 'end' ? 'end' : 'start')
      .attr('fill', '#fff').attr('font-size', 7).attr('font-weight', '700')
      .attr('letter-spacing', '0.07em').attr('pointer-events', 'none')
      .text(text)
  }

  // Top-right: CATASTROPHE
  pillLabel(iW - 2, 12, 'CATASTROPHE', 'rgba(192,57,43,0.75)', 'end')
  // Bottom-right: SILENT CRISIS
  pillLabel(iW - 2, iH - 4, 'SILENT CRISIS', 'rgba(13,148,136,0.75)', 'end')
  // Top-left: RARE TRAGEDY
  pillLabel(2, 12, 'RARE TRAGEDY', 'rgba(139,92,246,0.65)', 'start')
  // Bottom-left: MANAGED
  pillLabel(2, iH - 4, 'MANAGED', 'rgba(107,114,128,0.6)', 'start')

  // Axes
  g.append('g').attr('transform', 'translate(0,' + iH + ')')
    .call(d3.axisBottom(xScale).ticks(4, '.0s'))
    .call(function(ax) { ax.select('.domain').remove() })
    .call(function(ax) { ax.selectAll('line').attr('stroke', 'rgba(0,0,0,0.08)') })
    .call(function(ax) { ax.selectAll('text').attr('fill', '#9CA3AF').attr('font-size', 8) })

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(4, '.0s'))
    .call(function(ax) { ax.select('.domain').remove() })
    .call(function(ax) { ax.selectAll('line').attr('stroke', 'rgba(0,0,0,0.08)') })
    .call(function(ax) { ax.selectAll('text').attr('fill', '#9CA3AF').attr('font-size', 8) })

  // Axis labels — inside bottom margin, with log scale note
  svg.append('text')
    .attr('x', margin.left + iW / 2).attr('y', H - 38)
    .attr('text-anchor', 'middle').attr('fill', '#9CA3AF').attr('font-size', 8)
    .text('← Disruption: Total Affected (log scale) →')

  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -(margin.top + iH / 2)).attr('y', 11)
    .attr('text-anchor', 'middle').attr('fill', '#9CA3AF').attr('font-size', 8)
    .text('← Lethality: Deaths (log scale) →')

  // Bubbles — drawn last so they're on top of quadrant fills
  pts.forEach(function(d) {
    var cx2 = xScale(d.total_affected + 1)
    var cy2 = yScale(d.total_deaths + 1)
    var col = d.gender_gap ? colorScale(d.gender_gap) : '#9CA3AF'
    var isLow = d.gender_gap && d.gender_gap < 0.6

    g.append('circle')
      .attr('cx', cx2).attr('cy', cy2).attr('r', 9)
      .attr('fill', col)
      .attr('opacity', isLow ? 0.95 : 0.82)
      .attr('stroke', isLow ? 'rgba(192,57,43,0.7)' : 'rgba(255,255,255,0.5)')
      .attr('stroke-width', isLow ? 1.8 : 0.8)
      .style('cursor', 'pointer')
      .on('mousemove', function(event) {
        var lm = d.lethality_multiplier
        showTooltip(tooltip, tooltipHtml(d.name + ' ' + d.year, [
          ['Total Affected', fmtNum(d.total_affected)],
          ['Total Deaths', fmtNum(d.total_deaths)],
          ['Gender Gap', d.gender_gap ? d.gender_gap.toFixed(3) : 'N/A'],
          ['Lethality Multiplier', lm != null ? lm.toFixed(5) : 'N/A'],
          ['SDRS', d.sdrs ? d.sdrs.toFixed(3) : 'N/A'],
        ]), event)
        d3.select(this).attr('r', 13).attr('opacity', 1)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
        d3.select(this).attr('r', 9).attr('opacity', isLow ? 0.95 : 0.82)
      })

    g.append('text')
      .attr('x', cx2).attr('y', cy2 + 1)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', '#fff').attr('font-size', 7.5).attr('font-weight', '600').attr('pointer-events', 'none')
      .text(String(d.year).slice(2))
  })

  // Color legend — placed in bottom margin, below x-axis, no overlap with plot
  var legendY = H - 22
  var legendX = margin.left
  var legendW = iW

  var defs = svg.append('defs')
  var grad = defs.append('linearGradient').attr('id', 'lm-grad-' + iso)
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#C0392B')
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#0D9488')

  svg.append('rect')
    .attr('x', legendX).attr('y', legendY)
    .attr('width', legendW).attr('height', 5)
    .attr('fill', 'url(#lm-grad-' + iso + ')')
    .attr('rx', 2.5)

  svg.append('text')
    .attr('x', legendX).attr('y', legendY + 14)
    .attr('fill', '#C0392B').attr('font-size', 7.5).attr('font-weight', '600')
    .text('Low Gender Equality')

  svg.append('text')
    .attr('x', legendX + legendW).attr('y', legendY + 14)
    .attr('text-anchor', 'end').attr('fill', '#0D9488').attr('font-size', 7.5).attr('font-weight', '600')
    .text('High Gender Equality')
}

// ── 05B: Streamgraph ─────────────────────────────────────────
function drawStreamgraph(countryData, iso) {
  var container = document.getElementById('stream-chart')
  var tooltip   = document.getElementById('stream-tooltip')
  container.innerHTML = ''

  var W = 900, H = 260
  var margin = { top: 24, right: 24, bottom: 52, left: 56 }
  var iW = W - margin.left - margin.right
  var iH = H - margin.top - margin.bottom

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + W + ' ' + H)
    .style('width', '100%')
    .style('height', '260px')
    .attr('preserveAspectRatio', 'xMidYMid meet')

  var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

  var years = countryData.map(function(d) { return d.year }).sort(function(a,b) { return a-b })

  if (!years.length) {
    svg.append('text').attr('x', W/2).attr('y', H/2)
      .attr('text-anchor', 'middle').attr('fill', '#6B7280').attr('font-size', 12)
      .text('No data available')
    return
  }

  // Build matrix: year × dtype → affected
  var matrix = years.map(function(yr) {
    var rec = countryData.find(function(d) { return d.year === yr })
    var row = { year: yr }
    DTYPES.forEach(function(dtype) {
      row[dtype] = (rec && rec.disasters && rec.disasters[dtype])
        ? rec.disasters[dtype].affected
        : 0
    })
    return row
  })

  var xScale = d3.scaleLinear()
    .domain(d3.extent(years))
    .range([0, iW])

  // Use stackOffsetSilhouette for symmetric centering with meaningful y-axis
  var stack = d3.stack()
    .keys(DTYPES)
    .offset(d3.stackOffsetSilhouette)
    .order(d3.stackOrderInsideOut)

  var series = stack(matrix)

  var yExtent = [
    d3.min(series, function(s) { return d3.min(s, function(d) { return d[0] }) }),
    d3.max(series, function(s) { return d3.max(s, function(d) { return d[1] }) }),
  ]

  var yScale = d3.scaleLinear().domain(yExtent).range([iH, 0])

  // Compute max total affected for reference scale
  var maxTotal = d3.max(matrix, function(row) {
    return DTYPES.reduce(function(sum, dtype) { return sum + row[dtype] }, 0)
  })

  var area = d3.area()
    .x(function(d, i) { return xScale(years[i]) })
    .y0(function(d) { return yScale(d[0]) })
    .y1(function(d) { return yScale(d[1]) })
    .curve(d3.curveCatmullRom)

  // Y-axis gridlines (subtle)
  var yTicks = yScale.ticks(4)
  yTicks.forEach(function(tick) {
    g.append('line')
      .attr('x1', 0).attr('x2', iW)
      .attr('y1', yScale(tick)).attr('y2', yScale(tick))
      .attr('stroke', 'rgba(255,255,255,0.06)')
      .attr('stroke-width', 0.5)
  })

  // Draw streams with animated reveal
  series.forEach(function(s, si) {
    var dtype = s.key
    var meta  = DTYPE_META[dtype]

    var path = g.append('path')
      .datum(s)
      .attr('d', area)
      .attr('fill', meta.color)
      .attr('opacity', 0)
      .on('mousemove', function(event) {
        // Find nearest year
        var mouseX = d3.pointer(event, g.node())[0]
        var yearIdx = Math.round((mouseX / iW) * (years.length - 1))
        yearIdx = Math.max(0, Math.min(years.length - 1, yearIdx))
        var yr = years[yearIdx]
        var row = matrix[yearIdx]
        var val = row[dtype]
        var total = DTYPES.reduce(function(sum, dt) { return sum + row[dt] }, 0)
        showTooltip(tooltip, tooltipHtml(meta.label + ' — ' + yr, [
          ['Affected', val > 0 ? fmtNum(val) : '0'],
          ['Share of Year', total > 0 ? (val / total * 100).toFixed(1) + '%' : '0%'],
          ['Total All Types', fmtNum(total)],
          ['Category', meta.category],
        ]), event)
        d3.select(this).attr('opacity', 1)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
        d3.select(this).attr('opacity', 0.78)
      })

    // Animate in
    path.transition()
      .duration(600)
      .delay(si * 60)
      .ease(d3.easeCubicOut)
      .attr('opacity', 0.78)
  })

  // X axis
  g.append('g').attr('transform', 'translate(0,' + iH + ')')
    .call(d3.axisBottom(xScale).ticks(years.length > 10 ? 8 : years.length).tickFormat(d3.format('d')))
    .call(function(ax) { ax.select('.domain').remove() })
    .call(function(ax) { ax.selectAll('text').attr('fill', 'rgba(255,255,255,0.5)').attr('font-size', 9) })
    .call(function(ax) { ax.selectAll('line').attr('stroke', 'rgba(255,255,255,0.1)') })

  // Y-axis: show scale in human-readable units
  var yAxisFormat = maxTotal >= 1e6
    ? function(v) {
        // Convert from stacked domain back to people
        var range = yExtent[1] - yExtent[0]
        var pct = (v - yExtent[0]) / range
        var people = pct * maxTotal
        if (people >= 1e6) return (people / 1e6).toFixed(1) + 'M'
        if (people >= 1e3) return (people / 1e3).toFixed(0) + 'K'
        return people.toFixed(0)
      }
    : function(v) {
        var range = yExtent[1] - yExtent[0]
        var pct = (v - yExtent[0]) / range
        var people = pct * maxTotal
        if (people >= 1e3) return (people / 1e3).toFixed(0) + 'K'
        return people.toFixed(0)
      }

  // Reference scale bar (top-right) — "▌= X people affected"
  var refBarH = iH * 0.3
  var refPeople = maxTotal * 0.3  // 30% of max
  var refLabel = refPeople >= 1e6
    ? (refPeople / 1e6).toFixed(1) + 'M'
    : refPeople >= 1e3
      ? (refPeople / 1e3).toFixed(0) + 'K'
      : refPeople.toFixed(0)

  // Scale reference bar
  var refX = iW - 8
  var refY1 = iH * 0.15
  var refY2 = refY1 + refBarH

  g.append('line')
    .attr('x1', refX).attr('x2', refX)
    .attr('y1', refY1).attr('y2', refY2)
    .attr('stroke', 'rgba(255,255,255,0.5)')
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')

  // Top tick
  g.append('line')
    .attr('x1', refX - 4).attr('x2', refX + 4)
    .attr('y1', refY1).attr('y2', refY1)
    .attr('stroke', 'rgba(255,255,255,0.5)')
    .attr('stroke-width', 1.5)

  // Bottom tick
  g.append('line')
    .attr('x1', refX - 4).attr('x2', refX + 4)
    .attr('y1', refY2).attr('y2', refY2)
    .attr('stroke', 'rgba(255,255,255,0.5)')
    .attr('stroke-width', 1.5)

  // Label
  g.append('text')
    .attr('x', refX - 8).attr('y', (refY1 + refY2) / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'rgba(255,255,255,0.45)')
    .attr('font-size', 8.5)
    .attr('font-weight', '600')
    .text('≈ ' + refLabel)

  g.append('text')
    .attr('x', refX - 8).attr('y', (refY1 + refY2) / 2 + 11)
    .attr('text-anchor', 'end')
    .attr('fill', 'rgba(255,255,255,0.25)')
    .attr('font-size', 7)
    .text('affected')

  // Peak year annotation — find the year with max total affected
  var peakIdx = 0
  var peakTotal = 0
  matrix.forEach(function(row, i) {
    var total = DTYPES.reduce(function(sum, dtype) { return sum + row[dtype] }, 0)
    if (total > peakTotal) { peakTotal = total; peakIdx = i }
  })

  if (peakTotal > 0) {
    var peakX = xScale(years[peakIdx])
    // Draw a subtle vertical line at peak
    g.append('line')
      .attr('x1', peakX).attr('x2', peakX)
      .attr('y1', 0).attr('y2', iH)
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')

    var peakLabel = peakTotal >= 1e6
      ? (peakTotal / 1e6).toFixed(1) + 'M'
      : (peakTotal / 1e3).toFixed(0) + 'K'

    g.append('text')
      .attr('x', peakX).attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.5)')
      .attr('font-size', 8)
      .attr('font-weight', '600')
      .text('▲ Peak: ' + peakLabel + ' (' + years[peakIdx] + ')')
  }

  // Gender Resilience Checkpoint pulses
  countryData.forEach(function(rec) {
    if (!rec.gender_gap) return
    var x = xScale(rec.year)
    var y = iH / 2

    // Find the dominant stream at this year
    var maxAffected = 0
    var domDtype = null
    DTYPES.forEach(function(dtype) {
      var v = rec.disasters && rec.disasters[dtype] ? rec.disasters[dtype].affected : 0
      if (v > maxAffected) { maxAffected = v; domDtype = dtype }
    })
    if (!maxAffected) return

    // Pulse dot
    g.append('circle')
      .attr('cx', x).attr('cy', y).attr('r', 4)
      .attr('fill', '#fff').attr('opacity', 0.9)
      .attr('stroke', '#E8614A').attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mousemove', function(event) {
        showTooltip(tooltip, tooltipHtml(
          '\u2605 Gender Resilience Checkpoint ' + rec.year,
          [
            ['Gender Gap Score', rec.gender_gap.toFixed(3)],
            ['Political Empowerment', rec.political_empowerment ? rec.political_empowerment.toFixed(3) : 'N/A'],
            ['Dominant Disaster', domDtype ? DTYPE_META[domDtype].label : 'N/A'],
            ['Total Affected', fmtNum(rec.total_affected)],
            ['SDRS', rec.sdrs ? rec.sdrs.toFixed(3) : 'N/A'],
          ]
        ), event)
        d3.select(this).attr('r', 7)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
        d3.select(this).attr('r', 4)
      })
  })

  // Stream legend — placed below the chart in bottom margin
  var legendY = H - 12
  var legendX = 0
  DTYPES.forEach(function(dtype) {
    var meta = DTYPE_META[dtype]
    var lw = meta.label.length * 6 + 20

    svg.append('rect')
      .attr('x', margin.left + legendX).attr('y', legendY - 10)
      .attr('width', 10).attr('height', 10).attr('rx', 2)
      .attr('fill', meta.color)

    svg.append('text')
      .attr('x', margin.left + legendX + 13).attr('y', legendY - 2)
      .attr('fill', 'rgba(255,255,255,0.5)').attr('font-size', 9)
      .text(meta.label)

    legendX += lw
  })

  // Pulse legend
  svg.append('circle').attr('cx', margin.left + legendX + 6).attr('cy', legendY - 5).attr('r', 4)
    .attr('fill', '#fff').attr('stroke', '#E8614A').attr('stroke-width', 1.5)
  svg.append('text').attr('x', margin.left + legendX + 14).attr('y', legendY - 2)
    .attr('fill', 'rgba(255,255,255,0.5)').attr('font-size', 9).text('Gender Checkpoint')
}
