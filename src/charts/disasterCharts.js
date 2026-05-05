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

// ── 05A: Sunburst ─────────────────────────────────────────────
function drawSunburst(rec, iso) {
  var container = document.getElementById('sunburst-chart')
  var tooltip   = document.getElementById('sunburst-tooltip')
  container.innerHTML = ''

  var W = 300, H = 300
  var cx = W / 2, cy = H / 2
  var innerR = 44, outerR = 112

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + W + ' ' + H)
    .style('width', '100%')
    .style('height', '300px')
    .attr('preserveAspectRatio', 'xMidYMid meet')

  // No data state
  if (!rec || !rec.disasters) {
    svg.append('text')
      .attr('x', cx).attr('y', cy)
      .attr('text-anchor', 'middle').attr('fill', '#6B7280').attr('font-size', 13)
      .text('No disaster data for this year')
    return
  }

  // Build hierarchy: categories → subtypes
  var catMap = {}
  DTYPES.forEach(function(dtype) {
    var meta = DTYPE_META[dtype]
    var d    = rec.disasters[dtype]
    if (!d || d.affected <= 0) return
    if (!catMap[meta.category]) catMap[meta.category] = { affected: 0, subtypes: [] }
    catMap[meta.category].affected += d.affected
    catMap[meta.category].subtypes.push({
      key:      dtype,
      label:    meta.label,
      affected: d.affected,
      deaths:   d.deaths,
      count:    d.count,
      color:    meta.color,
      category: meta.category,
    })
  })

  var cats = Object.keys(catMap)
  if (!cats.length) {
    svg.append('text')
      .attr('x', cx).attr('y', cy)
      .attr('text-anchor', 'middle').attr('fill', '#6B7280').attr('font-size', 13)
      .text('No affected population recorded')
    return
  }

  var totalAffected = d3.sum(cats.map(function(c) { return catMap[c].affected }))

  // Log-compress for visual width
  function logW(v) { return v > 0 ? Math.log1p(v) : 0 }
  var totalLog = d3.sum(cats.map(function(c) { return logW(catMap[c].affected) }))

  // Draw inner ring (categories) and outer ring (subtypes)
  var catStartAngle = -Math.PI / 2
  var midR = (innerR + outerR) / 2

  cats.forEach(function(catKey) {
    var cat = catMap[catKey]
    var catAngle = (logW(cat.affected) / totalLog) * 2 * Math.PI
    var catEndAngle = catStartAngle + catAngle

    // Inner arc (category)
    var arcInner = d3.arc()
      .innerRadius(innerR)
      .outerRadius(midR - 2)
      .startAngle(catStartAngle)
      .endAngle(catEndAngle)
      .padAngle(0.02)
      .cornerRadius(2)

    svg.append('path')
      .attr('transform', 'translate(' + cx + ',' + cy + ')')
      .attr('d', arcInner)
      .attr('fill', CAT_COLOR[catKey])
      .attr('opacity', 0.85)
      .on('mousemove', function(event) {
        showTooltip(tooltip, tooltipHtml(catKey, [
          ['Total Affected', cat.affected.toLocaleString()],
          ['Share', (cat.affected / totalAffected * 100).toFixed(1) + '%'],
        ]), event)
      })
      .on('mouseleave', function() { hideTooltip(tooltip) })

    // Category label
    var midAngle = catStartAngle + catAngle / 2
    var lx = cx + (midR - 10) * Math.cos(midAngle)
    var ly = cy + (midR - 10) * Math.sin(midAngle)
    if (catAngle > 0.3) {
      svg.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#fff').attr('font-size', 8).attr('font-weight', '700')
        .attr('pointer-events', 'none')
        .text(catKey.slice(0, 5))
    }

    // Outer arcs (subtypes)
    var catTotalLog = d3.sum(cat.subtypes.map(function(s) { return logW(s.affected) }))
    var subStart = catStartAngle

    cat.subtypes.forEach(function(sub) {
      var subAngle = catTotalLog > 0
        ? (logW(sub.affected) / catTotalLog) * catAngle
        : catAngle / cat.subtypes.length
      var subEnd = subStart + subAngle

      var arcOuter = d3.arc()
        .innerRadius(midR + 2)
        .outerRadius(outerR)
        .startAngle(subStart)
        .endAngle(subEnd)
        .padAngle(0.015)
        .cornerRadius(2)

      svg.append('path')
        .attr('transform', 'translate(' + cx + ',' + cy + ')')
        .attr('d', arcOuter)
        .attr('fill', sub.color)
        .attr('opacity', 0.9)
        .style('cursor', 'pointer')
        .on('mousemove', function(event) {
          showTooltip(tooltip, tooltipHtml(sub.label, [
            ['Category', sub.category],
            ['Affected', sub.affected.toLocaleString()],
            ['Deaths', sub.deaths.toLocaleString()],
            ['Events', sub.count],
            ['Share of total', (sub.affected / totalAffected * 100).toFixed(1) + '%'],
          ]), event)
        })
        .on('mouseleave', function() { hideTooltip(tooltip) })
        .on('click', function() {
          // Highlight this subtype in streamgraph
          document.dispatchEvent(new CustomEvent('disaster-filter', { detail: sub.key }))
        })

      // Subtype label
      var subMid = subStart + subAngle / 2
      if (subAngle > 0.25) {
        var slx = cx + (outerR - 14) * Math.cos(subMid)
        var sly = cy + (outerR - 14) * Math.sin(subMid)
        svg.append('text')
          .attr('x', slx).attr('y', sly)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('fill', '#fff').attr('font-size', 7.5)
          .attr('pointer-events', 'none')
          .text(sub.label)
      }

      subStart = subEnd
    })

    catStartAngle = catEndAngle
  })

  // Center: total affected
  svg.append('circle')
    .attr('cx', cx).attr('cy', cy).attr('r', innerR - 4)
    .attr('fill', 'rgba(26,26,46,0.9)')

  svg.append('text')
    .attr('x', cx).attr('y', cy - 10)
    .attr('text-anchor', 'middle').attr('fill', '#E8614A')
    .attr('font-size', 9).attr('font-weight', '700').attr('letter-spacing', '0.08em')
    .text('TOTAL')

  svg.append('text')
    .attr('x', cx).attr('y', cy + 4)
    .attr('text-anchor', 'middle').attr('fill', '#fff')
    .attr('font-size', 11).attr('font-weight', '700')
    .text(totalAffected >= 1e6
      ? (totalAffected / 1e6).toFixed(1) + 'M'
      : totalAffected >= 1e3
        ? (totalAffected / 1e3).toFixed(0) + 'K'
        : totalAffected.toString())

  svg.append('text')
    .attr('x', cx).attr('y', cy + 18)
    .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.4)')
    .attr('font-size', 8)
    .text('affected')
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

  // Quadrant fills
  g.append('rect').attr('x', midX).attr('y', 0)
    .attr('width', iW - midX).attr('height', midY)
    .attr('fill', 'rgba(192,57,43,0.07)')

  g.append('rect').attr('x', midX).attr('y', midY)
    .attr('width', iW - midX).attr('height', iH - midY)
    .attr('fill', 'rgba(13,148,136,0.09)')

  // Dashed border on Silent Crisis only
  g.append('rect').attr('x', midX).attr('y', midY)
    .attr('width', iW - midX).attr('height', iH - midY)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(13,148,136,0.4)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3')

  // Quadrant pill labels — placed at far corners, away from bubbles
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

  // Top-right corner: CATASTROPHE
  pillLabel(iW - 2, 12, 'CATASTROPHE', 'rgba(192,57,43,0.75)', 'end')
  // Bottom-right corner: SILENT CRISIS
  pillLabel(iW - 2, iH - 4, 'SILENT CRISIS', 'rgba(13,148,136,0.75)', 'end')

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

  // Axis labels — inside bottom margin
  svg.append('text')
    .attr('x', margin.left + iW / 2).attr('y', H - 38)
    .attr('text-anchor', 'middle').attr('fill', '#9CA3AF').attr('font-size', 8)
    .text('← Disruption (Total Affected, log) →')

  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -(margin.top + iH / 2)).attr('y', 11)
    .attr('text-anchor', 'middle').attr('fill', '#9CA3AF').attr('font-size', 8)
    .text('← Lethality (Deaths, log) →')

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
          ['Total Affected', d.total_affected.toLocaleString()],
          ['Total Deaths', d.total_deaths.toLocaleString()],
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

  var W = 900, H = 200
  var margin = { top: 24, right: 24, bottom: 36, left: 44 }
  var iW = W - margin.left - margin.right
  var iH = H - margin.top - margin.bottom

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + W + ' ' + H)
    .style('width', '100%')
    .style('height', '200px')
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

  var stack = d3.stack()
    .keys(DTYPES)
    .offset(d3.stackOffsetWiggle)
    .order(d3.stackOrderInsideOut)

  var series = stack(matrix)

  var yExtent = [
    d3.min(series, function(s) { return d3.min(s, function(d) { return d[0] }) }),
    d3.max(series, function(s) { return d3.max(s, function(d) { return d[1] }) }),
  ]

  var yScale = d3.scaleLinear().domain(yExtent).range([iH, 0])

  var area = d3.area()
    .x(function(d, i) { return xScale(years[i]) })
    .y0(function(d) { return yScale(d[0]) })
    .y1(function(d) { return yScale(d[1]) })
    .curve(d3.curveCatmullRom)

  // Draw streams
  series.forEach(function(s) {
    var dtype = s.key
    var meta  = DTYPE_META[dtype]

    g.append('path')
      .datum(s)
      .attr('d', area)
      .attr('fill', meta.color)
      .attr('opacity', 0.75)
      .on('mousemove', function(event) {
        showTooltip(tooltip, tooltipHtml(meta.label, [
          ['Category', meta.category],
          ['Hover a pulse for year detail', ''],
        ]), event)
        d3.select(this).attr('opacity', 1)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
        d3.select(this).attr('opacity', 0.75)
      })
  })

  // X axis
  g.append('g').attr('transform', 'translate(0,' + iH + ')')
    .call(d3.axisBottom(xScale).ticks(years.length > 10 ? 8 : years.length).tickFormat(d3.format('d')))
    .call(function(ax) { ax.select('.domain').remove() })
    .call(function(ax) { ax.selectAll('text').attr('fill', '#6B7280').attr('font-size', 9) })

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
            ['Total Affected', rec.total_affected.toLocaleString()],
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

  // Stream legend
  var legendX = 0
  DTYPES.forEach(function(dtype) {
    var meta = DTYPE_META[dtype]
    var lw = meta.label.length * 6 + 20

    svg.append('rect')
      .attr('x', margin.left + legendX).attr('y', 6)
      .attr('width', 10).attr('height', 10).attr('rx', 2)
      .attr('fill', meta.color)

    svg.append('text')
      .attr('x', margin.left + legendX + 13).attr('y', 14)
      .attr('fill', '#6B7280').attr('font-size', 9)
      .text(meta.label)

    legendX += lw
  })

  // Pulse legend
  svg.append('circle').attr('cx', margin.left + legendX + 6).attr('cy', 11).attr('r', 4)
    .attr('fill', '#fff').attr('stroke', '#E8614A').attr('stroke-width', 1.5)
  svg.append('text').attr('x', margin.left + legendX + 14).attr('y', 14)
    .attr('fill', '#6B7280').attr('font-size', 9).text('Gender Checkpoint')
}
