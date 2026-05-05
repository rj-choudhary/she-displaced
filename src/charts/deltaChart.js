import * as d3 from 'd3'
import { showTooltip, hideTooltip, tooltipHtml, getDataForYear } from './utils.js'

// Gender Displacement Delta — compact version for right column
export function drawDeltaChart(data) {
  const container  = document.getElementById('delta-chart')
  const tooltip    = document.getElementById('delta-tooltip')
  const yearSlider = document.getElementById('gender-year-slider')  // shared slider

  let currentYear = 2025

  const n      = 25
  const barH   = 18
  const barGap = 4
  // Use fixed logical dimensions — never rely on offsetWidth at init
  const margin = { top: 48, right: 110, bottom: 40, left: 150 }
  const W      = 560
  const H      = n * (barH + barGap) + margin.top + margin.bottom

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('width', '100%')
    .attr('preserveAspectRatio', 'xMidYMid meet')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const innerW = W - margin.left - margin.right
  const innerH = H - margin.top - margin.bottom

  // Column header
  svg.append('text')
    .attr('x', margin.left + innerW / 2).attr('y', 22)
    .attr('text-anchor', 'middle')
    .attr('fill', 'rgba(255,255,255,0.35)')
    .attr('font-size', 9).attr('letter-spacing', '0.12em').attr('font-weight', '600')
    .text('GENDER DISPLACEMENT DELTA  (SDRS − n_Vulnerability × 0.30)')

  const xScale = d3.scaleLinear().domain([-0.01, 0.13]).range([0, innerW]).clamp(true)

  // Zero line
  g.append('line')
    .attr('x1', xScale(0)).attr('x2', xScale(0))
    .attr('y1', -8).attr('y2', innerH)
    .attr('stroke', 'rgba(255,255,255,0.15)')
    .attr('stroke-dasharray', '3,3').attr('stroke-width', 1)

  // X axis
  g.append('g').attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => d === 0 ? '0' : d3.format('+.2f')(d)))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line').attr('stroke', 'rgba(255,255,255,0.08)'))
    .call(ax => ax.selectAll('text').attr('fill', 'rgba(255,255,255,0.3)').attr('font-size', 10))

  // Grid
  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(5).tickSize(-innerH).tickFormat(''))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line').attr('stroke', 'rgba(255,255,255,0.04)'))

  const barsG   = g.append('g')
  const labelsG = g.append('g')
  const valsG   = g.append('g')

  const deltaColor = d3.scaleSequential()
    .domain([0, 0.11])
    .interpolator(d3.interpolateRgb('rgba(42,173,173,0.7)', '#E8614A'))
    .clamp(true)

  function render(animate = true) {
    const yearData = getDataForYear(data, currentYear)
    const withDelta = yearData.map(d => ({
      ...d,
      // GDD = SDRS minus the pure climate contribution (0.30 × n_V)
      // Shows how much gender + adaptive + disaster add beyond climate alone
      gdd: d.sdrs != null && d.n_vulnerability != null
        ? d.sdrs - (d.n_vulnerability * 0.30)
        : d.sdrs != null ? d.sdrs - d.vulnerability : 0
    }))
    const top25 = withDelta.sort((a, b) => b.gdd - a.gdd).slice(0, n)

    const yPos = i => i * (barH + barGap)

    // Country labels
    labelsG.selectAll('text.dl').data(top25, d => d.iso3)
      .join(
        enter => enter.append('text').attr('class', 'dl')
          .attr('x', -8).attr('text-anchor', 'end')
          .attr('font-size', 10).attr('fill', 'rgba(255,255,255,0.55)')
          .attr('dominant-baseline', 'middle'),
        update => update
      )
      .transition().duration(500)
      .attr('y', (d, i) => yPos(i) + barH / 2)
      .text(d => d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name)

    // Bars
    barsG.selectAll('rect.db').data(top25, d => d.iso3)
      .join(
        enter => enter.append('rect').attr('class', 'db')
          .attr('y', (d, i) => yPos(i)).attr('height', barH).attr('rx', 2)
          .attr('x', xScale(0)).attr('width', 0),
        update => update
      )
      .transition().duration(animate ? 600 : 0).ease(d3.easeCubicOut)
      .attr('y', (d, i) => yPos(i))
      .attr('x', d => d.gdd >= 0 ? xScale(0) : xScale(d.gdd))
      .attr('width', d => Math.abs(xScale(d.gdd) - xScale(0)))
      .attr('fill', d => deltaColor(Math.max(0, d.gdd)))
      .attr('opacity', 0.88)

    // Value labels
    valsG.selectAll('text.dv').data(top25, d => d.iso3)
      .join(
        enter => enter.append('text').attr('class', 'dv')
          .attr('font-size', 9.5).attr('font-weight', '600')
          .attr('dominant-baseline', 'middle'),
        update => update
      )
      .transition().duration(500)
      .attr('y', (d, i) => yPos(i) + barH / 2)
      .attr('x', d => xScale(Math.max(0, d.gdd)) + 5)
      .attr('fill', d => d.gdd > 0.06 ? '#F4957F' : 'rgba(255,255,255,0.4)')
      .text(d => d3.format('+.3f')(d.gdd))

    // Context scores on right
    g.selectAll('text.dc').data(top25, d => d.iso3)
      .join(
        enter => enter.append('text').attr('class', 'dc')
          .attr('font-size', 9).attr('dominant-baseline', 'middle')
          .attr('fill', 'rgba(255,255,255,0.2)'),
        update => update
      )
      .transition().duration(500)
      .attr('y', (d, i) => yPos(i) + barH / 2)
      .attr('x', innerW + 6)
      .text(d => d.sdrs.toFixed(2))

    // Hover
    barsG.selectAll('rect.db')
      .on('mousemove', function(event, d) {
        showTooltip(tooltip, tooltipHtml(d.name, [
          ['Gender Displacement Delta', d3.format('+.4f')(d.gdd)],
          ['SDRS Score', d.sdrs != null ? d.sdrs.toFixed(3) : 'N/A'],
          ['Climate Vulnerability', d.vulnerability.toFixed(3)],
          ['n_Vulnerability (norm.)', d.n_vulnerability != null ? d.n_vulnerability.toFixed(3) : 'N/A'],
          ['Gender Gap Score', d.gender_gap ? d.gender_gap.toFixed(3) : 'N/A'],
          ['Region', d.region],
        ]), event)
        d3.select(this).attr('opacity', 1)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
        d3.select(this).attr('opacity', 0.88)
      })
  }

  // Shared year slider — listen but don't re-register (slope chart owns the listener)
  yearSlider.addEventListener('input', () => {
    currentYear = +yearSlider.value
    render(true)
  })

  render(false)
}
