import * as d3 from 'd3'
import { showTooltip, hideTooltip, tooltipHtml, getDataForYear } from './utils.js'

// Slope chart — static (no scrollytelling steps)
// Left: vulnerability rank  |  Right: SDRS rank
// Coral lines = countries where gender amplifies risk most
export function drawSlopeScrolly(data) {
  const container  = document.getElementById('slope-chart')
  const tooltip    = document.getElementById('slope-tooltip')
  const yearSlider = document.getElementById('gender-year-slider')
  const yearLabel  = document.getElementById('gender-year-label')

  let currentYear = 2025

  const margin = { top: 48, right: 148, bottom: 24, left: 148 }
  const W = container.offsetWidth || 520
  const H = 560
  const innerW = W - margin.left - margin.right
  const innerH = H - margin.top - margin.bottom

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // Column headers
  svg.append('text')
    .attr('x', margin.left - 10).attr('y', 22)
    .attr('text-anchor', 'end')
    .attr('fill', 'rgba(255,255,255,0.35)')
    .attr('font-size', 9).attr('letter-spacing', '0.12em')
    .attr('font-weight', '600')
    .text('CLIMATE VULNERABILITY')

  svg.append('text')
    .attr('x', W - margin.right + 10).attr('y', 22)
    .attr('text-anchor', 'start')
    .attr('fill', 'rgba(255,255,255,0.35)')
    .attr('font-size', 9).attr('letter-spacing', '0.12em')
    .attr('font-weight', '600')
    .text('SDRS (+ GENDER)')

  // Vertical axis lines
  g.append('line')
    .attr('x1', 0).attr('x2', 0)
    .attr('y1', 0).attr('y2', innerH)
    .attr('stroke', 'rgba(255,255,255,0.1)').attr('stroke-width', 1)

  g.append('line')
    .attr('x1', innerW).attr('x2', innerW)
    .attr('y1', 0).attr('y2', innerH)
    .attr('stroke', 'rgba(255,255,255,0.1)').attr('stroke-width', 1)

  const linesG       = g.append('g').attr('class', 'slope-lines')
  const dotsLeftG    = g.append('g').attr('class', 'dots-left')
  const dotsRightG   = g.append('g').attr('class', 'dots-right')
  const labelsLeftG  = g.append('g').attr('class', 'labels-left')
  const labelsRightG = g.append('g').attr('class', 'labels-right')

  function buildData(year) {
    const yearData = getDataForYear(data, year)
    const top25 = yearData.sort((a, b) => b.sdrs - a.sdrs).slice(0, 25)
    const n = top25.length
    const yScale = d3.scaleLinear().domain([1, n]).range([0, innerH])

    const leftSorted  = [...top25].sort((a, b) => a.vuln_rank - b.vuln_rank)
    const rightSorted = [...top25].sort((a, b) => a.sdrs_rank - b.sdrs_rank)

    const leftY  = {}
    const rightY = {}
    leftSorted.forEach((d, i)  => { leftY[d.iso3]  = yScale(i + 1) })
    rightSorted.forEach((d, i) => { rightY[d.iso3] = yScale(i + 1) })

    return { top25, leftY, rightY, leftSorted, rightSorted }
  }

  function render(animate = true) {
    const { top25, leftY, rightY, leftSorted, rightSorted } = buildData(currentYear)

    const maxShift = d3.max(top25, d => Math.abs(d.rank_shift)) || 1
    const shiftColor = d3.scaleSequential()
      .domain([0, maxShift])
      .interpolator(d3.interpolateRgb('rgba(255,255,255,0.15)', '#E8614A'))

    // Lines
    linesG.selectAll('line.slope-line').data(top25, d => d.iso3)
      .join(
        enter => enter.append('line').attr('class', 'slope-line')
          .attr('x1', 0).attr('x2', innerW)
          .attr('y1', d => leftY[d.iso3])
          .attr('y2', d => rightY[d.iso3])
          .attr('stroke', d => shiftColor(Math.abs(d.rank_shift)))
          .attr('stroke-width', d => d.rank_shift > 5 ? 2 : 1)
          .attr('opacity', 0.85),
        update => {
          const t = animate ? update.transition().duration(600).ease(d3.easeCubicInOut) : update
          t.attr('y1', d => leftY[d.iso3])
           .attr('y2', d => rightY[d.iso3])
           .attr('stroke', d => shiftColor(Math.abs(d.rank_shift)))
           .attr('stroke-width', d => d.rank_shift > 5 ? 2 : 1)
        }
      )

    // Left dots
    dotsLeftG.selectAll('circle.dot-left').data(top25, d => d.iso3)
      .join(
        enter => enter.append('circle').attr('class', 'dot-left')
          .attr('cx', 0).attr('r', 3.5).attr('fill', '#2AADAD').attr('opacity', 0.9),
        update => update
      )
      .transition().duration(500)
      .attr('cy', d => leftY[d.iso3])

    // Right dots
    dotsRightG.selectAll('circle.dot-right').data(top25, d => d.iso3)
      .join(
        enter => enter.append('circle').attr('class', 'dot-right')
          .attr('cx', innerW).attr('r', 3.5)
          .attr('fill', d => d.rank_shift > 5 ? '#E8614A' : '#2AADAD')
          .attr('opacity', 0.9),
        update => update
      )
      .transition().duration(500)
      .attr('cy', d => rightY[d.iso3])
      .attr('fill', d => d.rank_shift > 5 ? '#E8614A' : '#2AADAD')

    // Left labels
    labelsLeftG.selectAll('text.label-left').data(leftSorted, d => d.iso3)
      .join(
        enter => enter.append('text').attr('class', 'label-left')
          .attr('x', -8).attr('text-anchor', 'end')
          .attr('font-size', 10).attr('fill', 'rgba(255,255,255,0.55)')
          .attr('dominant-baseline', 'middle'),
        update => update
      )
      .transition().duration(500)
      .attr('y', d => leftY[d.iso3])
      .text(d => d.name.length > 16 ? d.name.slice(0, 14) + '…' : d.name)

    // Right labels
    labelsRightG.selectAll('text.label-right').data(rightSorted, d => d.iso3)
      .join(
        enter => enter.append('text').attr('class', 'label-right')
          .attr('x', innerW + 8).attr('text-anchor', 'start')
          .attr('font-size', 10).attr('dominant-baseline', 'middle'),
        update => update
      )
      .transition().duration(500)
      .attr('y', d => rightY[d.iso3])
      .attr('fill', d => d.rank_shift > 5 ? '#F4957F' : 'rgba(255,255,255,0.55)')
      .text(d => {
        const arrow = d.rank_shift > 5 ? ' ▲' : ''
        return (d.name.length > 14 ? d.name.slice(0, 12) + '…' : d.name) + arrow
      })

    // Hover
    linesG.selectAll('line.slope-line')
      .on('mousemove', function(event, d) {
        showTooltip(tooltip, tooltipHtml(d.name, [
          ['Vulnerability Rank', `#${d.vuln_rank}`],
          ['SDRS Rank', `#${d.sdrs_rank}`],
          ['Rank Jump', d.rank_shift > 0 ? `+${d.rank_shift} ▲ higher risk` : `${d.rank_shift}`],
          ['SDRS Score', d.sdrs.toFixed(3)],
          ['Gender Penalty', d.gender_penalty.toFixed(3)],
        ]), event)
        d3.select(this).attr('stroke-width', 3.5).attr('opacity', 1)
      })
      .on('mouseleave', function(event, d) {
        hideTooltip(tooltip)
        d3.select(this)
          .attr('stroke-width', d.rank_shift > 5 ? 2 : 1)
          .attr('opacity', 0.85)
      })
  }

  yearSlider.addEventListener('input', () => {
    currentYear = +yearSlider.value
    yearLabel.textContent = currentYear
    render(true)
  })

  render(false)
}
