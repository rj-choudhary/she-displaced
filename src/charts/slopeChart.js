import * as d3 from 'd3'
import { showTooltip, moveTooltip, hideTooltip, tooltipHtml, getDataForYear } from './utils.js'

export function drawSlopeChart(data) {
  const container = document.getElementById('slope-chart')
  const tooltip   = document.getElementById('slope-tooltip')
  const yearSlider = document.getElementById('slope-year-slider')
  const yearLabel  = document.getElementById('slope-year-label')

  let currentYear = 2025

  const margin = { top: 40, right: 160, bottom: 40, left: 160 }
  const W = Math.min(container.offsetWidth || 900, 960)
  const H = 520
  const innerW = W - margin.left - margin.right
  const innerH = H - margin.top - margin.bottom

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // Column labels
  svg.append('text')
    .attr('x', margin.left - 10).attr('y', 24)
    .attr('text-anchor', 'end')
    .attr('fill', 'rgba(255,255,255,0.5)')
    .attr('font-size', 11)
    .attr('letter-spacing', '0.1em')
    .text('CLIMATE VULNERABILITY RANK')

  svg.append('text')
    .attr('x', W - margin.right + 10).attr('y', 24)
    .attr('text-anchor', 'start')
    .attr('fill', 'rgba(255,255,255,0.5)')
    .attr('font-size', 11)
    .attr('letter-spacing', '0.1em')
    .text('SDRS RANK (+ GENDER)')

  const linesG = g.append('g').attr('class', 'slope-lines')
  const dotsLeftG = g.append('g').attr('class', 'dots-left')
  const dotsRightG = g.append('g').attr('class', 'dots-right')
  const labelsLeftG = g.append('g').attr('class', 'labels-left')
  const labelsRightG = g.append('g').attr('class', 'labels-right')

  function render() {
    const yearData = getDataForYear(data, currentYear)
    // Show top 30 by SDRS
    const top30 = yearData.sort((a, b) => b.sdrs - a.sdrs).slice(0, 30)
    const n = top30.length

    const yScale = d3.scaleLinear().domain([1, n]).range([0, innerH])

    // Sort by vuln rank for left side, sdrs rank for right side
    const leftSorted  = [...top30].sort((a, b) => a.vuln_rank - b.vuln_rank)
    const rightSorted = [...top30].sort((a, b) => a.sdrs_rank - b.sdrs_rank)

    // Assign y positions
    const leftY  = {}
    const rightY = {}
    leftSorted.forEach((d, i)  => { leftY[d.iso3]  = yScale(i + 1) })
    rightSorted.forEach((d, i) => { rightY[d.iso3] = yScale(i + 1) })

    const maxShift = d3.max(top30, d => Math.abs(d.rank_shift)) || 1
    const shiftColor = d3.scaleSequential()
      .domain([0, maxShift])
      .interpolator(d3.interpolateRgb('rgba(255,255,255,0.15)', '#E8614A'))

    // Lines
    const lines = linesG.selectAll('line.slope-line').data(top30, d => d.iso3)
    lines.join(
      enter => enter.append('line').attr('class', 'slope-line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', d => leftY[d.iso3])
        .attr('y2', d => rightY[d.iso3])
        .attr('stroke', d => shiftColor(Math.abs(d.rank_shift)))
        .attr('stroke-width', d => d.rank_shift > 5 ? 2 : 1)
        .attr('opacity', 0.8),
      update => update.transition().duration(500)
        .attr('y1', d => leftY[d.iso3])
        .attr('y2', d => rightY[d.iso3])
        .attr('stroke', d => shiftColor(Math.abs(d.rank_shift)))
        .attr('stroke-width', d => d.rank_shift > 5 ? 2 : 1)
    )

    // Left dots
    dotsLeftG.selectAll('circle.dot-left').data(top30, d => d.iso3)
      .join(
        enter => enter.append('circle').attr('class', 'dot-left')
          .attr('cx', 0).attr('r', 4)
          .attr('fill', '#2AADAD').attr('opacity', 0.9),
        update => update
      )
      .transition().duration(500)
      .attr('cy', d => leftY[d.iso3])

    // Right dots
    dotsRightG.selectAll('circle.dot-right').data(top30, d => d.iso3)
      .join(
        enter => enter.append('circle').attr('class', 'dot-right')
          .attr('cx', innerW).attr('r', 4)
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
          .attr('font-size', 11).attr('fill', 'rgba(255,255,255,0.7)')
          .attr('dominant-baseline', 'middle'),
        update => update
      )
      .transition().duration(500)
      .attr('y', d => leftY[d.iso3])
      .text(d => d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name)

    // Right labels
    labelsRightG.selectAll('text.label-right').data(rightSorted, d => d.iso3)
      .join(
        enter => enter.append('text').attr('class', 'label-right')
          .attr('x', innerW + 8).attr('text-anchor', 'start')
          .attr('font-size', 11)
          .attr('dominant-baseline', 'middle'),
        update => update
      )
      .transition().duration(500)
      .attr('y', d => rightY[d.iso3])
      .attr('fill', d => d.rank_shift > 5 ? '#F4957F' : 'rgba(255,255,255,0.7)')
      .text(d => {
        const arrow = d.rank_shift > 5 ? ' ▲' : d.rank_shift < -5 ? ' ▼' : ''
        return (d.name.length > 16 ? d.name.slice(0, 14) + '…' : d.name) + arrow
      })

    // Hover interaction on lines
    linesG.selectAll('line.slope-line')
      .on('mousemove', function(event, d) {
        showTooltip(tooltip, tooltipHtml(d.name, [
          ['Vulnerability Rank', `#${d.vuln_rank}`],
          ['SDRS Rank', `#${d.sdrs_rank}`],
          ['Rank Jump', d.rank_shift > 0 ? `+${d.rank_shift} ▲ higher risk` : `${d.rank_shift}`],
          ['SDRS Score', d.sdrs.toFixed(3)],
          ['Gender Penalty', d.gender_penalty.toFixed(3)],
        ]), event)
        d3.select(this).attr('stroke-width', 3).attr('opacity', 1)
      })
      .on('mouseleave', function(event, d) {
        hideTooltip(tooltip)
        d3.select(this)
          .attr('stroke-width', d.rank_shift > 5 ? 2 : 1)
          .attr('opacity', 0.8)
      })
  }

  yearSlider.addEventListener('input', () => {
    currentYear = +yearSlider.value
    yearLabel.textContent = currentYear
    render()
  })

  render()
}
