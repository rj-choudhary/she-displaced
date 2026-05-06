import * as d3 from 'd3'
import { showTooltip, hideTooltip, tooltipHtml, getDataForYear } from './utils.js'

// Slope chart — Focus on signal
// Top 7 biggest rank-jumpers highlighted in coral, rest faded to gray
// Left: vulnerability rank  |  Right: SDRS rank (after adding gender)
export function drawSlopeScrolly(data) {
  const container  = document.getElementById('slope-chart')
  const tooltip    = document.getElementById('slope-tooltip')
  const yearSlider = document.getElementById('gender-year-slider')
  const yearLabel  = document.getElementById('gender-year-label')

  let currentYear = 2025

  const N_SHOW = 20       // total countries shown
  const N_HIGHLIGHT = 7   // top movers get full emphasis

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
  const hitsG        = g.append('g').attr('class', 'hit-areas')
  const dotsLeftG    = g.append('g').attr('class', 'dots-left')
  const dotsRightG   = g.append('g').attr('class', 'dots-right')
  const labelsLeftG  = g.append('g').attr('class', 'labels-left')
  const labelsRightG = g.append('g').attr('class', 'labels-right')

  let firstRender = true

  function buildData(year) {
    const yearData = getDataForYear(data, year)
    const topN = yearData.sort((a, b) => b.sdrs - a.sdrs).slice(0, N_SHOW)
    const n = topN.length
    const yScale = d3.scaleLinear().domain([1, n]).range([0, innerH])

    const leftSorted  = [...topN].sort((a, b) => a.vuln_rank - b.vuln_rank)
    const rightSorted = [...topN].sort((a, b) => a.sdrs_rank - b.sdrs_rank)

    const leftY  = {}
    const rightY = {}
    leftSorted.forEach((d, i)  => { leftY[d.iso3]  = yScale(i + 1) })
    rightSorted.forEach((d, i) => { rightY[d.iso3] = yScale(i + 1) })

    // Identify top N_HIGHLIGHT biggest movers (by rank_shift)
    const byShift = [...topN].sort((a, b) => b.rank_shift - a.rank_shift)
    const highlightSet = new Set(byShift.slice(0, N_HIGHLIGHT).map(d => d.iso3))

    return { topN, leftY, rightY, leftSorted, rightSorted, highlightSet, byShift }
  }

  // Tooltip content builder
  function tipContent(d) {
    return tooltipHtml(d.name, [
      ['Vulnerability Rank', `#${d.vuln_rank}`],
      ['SDRS Rank', `#${d.sdrs_rank}`],
      ['Rank Jump', d.rank_shift > 0 ? `+${d.rank_shift} ▲ gender amplifies risk` : `${d.rank_shift}`],
      ['SDRS Score', d.sdrs.toFixed(3)],
      ['Gender Penalty', d.gender_penalty.toFixed(3)],
    ])
  }

  // Highlight a country on hover
  function highlightCountry(iso3) {
    linesG.selectAll('line.slope-line')
      .attr('opacity', d => d.iso3 === iso3 ? 1 : 0.15)
      .attr('stroke', d => d.iso3 === iso3 ? '#E8614A' : 'rgba(255,255,255,0.1)')
      .attr('stroke-width', d => d.iso3 === iso3 ? 4 : 1)

    dotsLeftG.selectAll('circle.dot-left')
      .attr('opacity', d => d.iso3 === iso3 ? 1 : 0.2)
    dotsRightG.selectAll('circle.dot-right')
      .attr('opacity', d => d.iso3 === iso3 ? 1 : 0.2)

    labelsLeftG.selectAll('text.label-left')
      .attr('opacity', d => d.iso3 === iso3 ? 1 : 0.2)
      .attr('fill', d => d.iso3 === iso3 ? '#E8614A' : 'rgba(255,255,255,0.35)')
    labelsRightG.selectAll('text.label-right')
      .attr('opacity', d => d.iso3 === iso3 ? 1 : 0.2)
      .attr('fill', d => d.iso3 === iso3 ? '#F4957F' : 'rgba(255,255,255,0.35)')
  }

  // Reset highlight
  function resetHighlight(highlightSet) {
    linesG.selectAll('line.slope-line')
      .attr('opacity', d => highlightSet.has(d.iso3) ? 1 : 0.6)
      .attr('stroke', d => highlightSet.has(d.iso3) ? '#E8614A' : 'rgba(255,255,255,0.18)')
      .attr('stroke-width', d => highlightSet.has(d.iso3) ? 2.5 : 1)

    dotsLeftG.selectAll('circle.dot-left').attr('opacity', 1)
    dotsRightG.selectAll('circle.dot-right').attr('opacity', 1)

    labelsLeftG.selectAll('text.label-left')
      .attr('opacity', 1)
      .attr('fill', d => highlightSet.has(d.iso3) ? '#E8614A' : 'rgba(255,255,255,0.35)')
    labelsRightG.selectAll('text.label-right')
      .attr('opacity', 1)
      .attr('fill', d => highlightSet.has(d.iso3) ? '#F4957F' : 'rgba(255,255,255,0.35)')
  }

  function render(animate = true) {
    const { topN, leftY, rightY, leftSorted, rightSorted, highlightSet, byShift } = buildData(currentYear)

    // Style helpers
    function lineColor(d) {
      return highlightSet.has(d.iso3) ? '#E8614A' : 'rgba(255,255,255,0.18)'
    }
    function lineWidth(d) {
      return highlightSet.has(d.iso3) ? 2.5 : 1
    }
    function lineOpacity(d) {
      return highlightSet.has(d.iso3) ? 1 : 0.6
    }
    function labelColorL(d) {
      return highlightSet.has(d.iso3) ? '#E8614A' : 'rgba(255,255,255,0.35)'
    }
    function labelColorR(d) {
      return highlightSet.has(d.iso3) ? '#F4957F' : 'rgba(255,255,255,0.35)'
    }
    function dotColorL(d) {
      return highlightSet.has(d.iso3) ? '#F4957F' : 'rgba(255,255,255,0.25)'
    }
    function dotColorR(d) {
      return highlightSet.has(d.iso3) ? '#E8614A' : 'rgba(255,255,255,0.25)'
    }
    function labelWeight(d) {
      return highlightSet.has(d.iso3) ? '600' : '400'
    }

    // Lines with stroke-dashoffset animation on first render
    linesG.selectAll('line.slope-line').data(topN, d => d.iso3)
      .join(
        enter => {
          const lines = enter.append('line').attr('class', 'slope-line')
            .attr('x1', 0).attr('x2', innerW)
            .attr('y1', d => leftY[d.iso3])
            .attr('y2', d => rightY[d.iso3])
            .attr('stroke', lineColor)
            .attr('stroke-width', lineWidth)
            .attr('stroke-linecap', 'round')
            .style('cursor', 'pointer')

          if (firstRender) {
            // Stroke-dashoffset reveal: draw from left to right
            const lineLen = Math.sqrt(innerW * innerW + innerH * innerH) // max possible
            lines
              .attr('stroke-dasharray', lineLen)
              .attr('stroke-dashoffset', lineLen)
              .attr('opacity', lineOpacity)
              .transition().duration(900).delay((d, i) => i * 35).ease(d3.easeCubicOut)
              .attr('stroke-dashoffset', 0)
              .on('end', function() {
                d3.select(this).attr('stroke-dasharray', null)
              })
          } else {
            lines.attr('opacity', lineOpacity)
          }
          return lines
        },
        update => {
          const t = animate ? update.transition().duration(600).ease(d3.easeCubicInOut) : update
          t.attr('y1', d => leftY[d.iso3])
           .attr('y2', d => rightY[d.iso3])
           .attr('stroke', lineColor)
           .attr('stroke-width', lineWidth)
           .attr('opacity', lineOpacity)
        },
        exit => exit.transition().duration(300).attr('opacity', 0).remove()
      )

    // Invisible fat hit areas for easier hover (covers line + surrounding space)
    hitsG.selectAll('line.hit-line').data(topN, d => d.iso3)
      .join(
        enter => enter.append('line').attr('class', 'hit-line')
          .attr('x1', 0).attr('x2', innerW)
          .attr('stroke', 'transparent')
          .attr('stroke-width', 16)
          .style('cursor', 'pointer'),
        update => update
      )
      .attr('y1', d => leftY[d.iso3])
      .attr('y2', d => rightY[d.iso3])
      .on('mousemove', function(event, d) {
        showTooltip(tooltip, tipContent(d), event)
        highlightCountry(d.iso3)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
        resetHighlight(highlightSet)
      })

    // Left dots
    dotsLeftG.selectAll('circle.dot-left').data(topN, d => d.iso3)
      .join(
        enter => enter.append('circle').attr('class', 'dot-left')
          .attr('cx', 0)
          .attr('r', d => highlightSet.has(d.iso3) ? 4.5 : 3)
          .attr('fill', dotColorL)
          .attr('opacity', firstRender ? 0 : 1)
          .style('cursor', 'pointer')
          .call(e => firstRender
            ? e.transition().duration(500).delay((d,i) => i * 35).attr('opacity', 1)
            : null
          ),
        update => update
          .attr('fill', dotColorL)
          .attr('r', d => highlightSet.has(d.iso3) ? 4.5 : 3)
      )
      .transition().duration(500)
      .attr('cy', d => leftY[d.iso3])

    // Left dot hover
    dotsLeftG.selectAll('circle.dot-left')
      .on('mousemove', function(event, d) {
        showTooltip(tooltip, tipContent(d), event)
        highlightCountry(d.iso3)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
        resetHighlight(highlightSet)
      })

    // Right dots
    dotsRightG.selectAll('circle.dot-right').data(topN, d => d.iso3)
      .join(
        enter => enter.append('circle').attr('class', 'dot-right')
          .attr('cx', innerW)
          .attr('r', d => highlightSet.has(d.iso3) ? 4.5 : 3)
          .attr('fill', dotColorR)
          .attr('opacity', firstRender ? 0 : 1)
          .style('cursor', 'pointer')
          .call(e => firstRender
            ? e.transition().duration(500).delay((d,i) => i * 35).attr('opacity', 1)
            : null
          ),
        update => update
          .attr('fill', dotColorR)
          .attr('r', d => highlightSet.has(d.iso3) ? 4.5 : 3)
      )
      .transition().duration(500)
      .attr('cy', d => rightY[d.iso3])

    // Right dot hover
    dotsRightG.selectAll('circle.dot-right')
      .on('mousemove', function(event, d) {
        showTooltip(tooltip, tipContent(d), event)
        highlightCountry(d.iso3)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
        resetHighlight(highlightSet)
      })

    // Left labels
    labelsLeftG.selectAll('text.label-left').data(leftSorted, d => d.iso3)
      .join(
        enter => enter.append('text').attr('class', 'label-left')
          .attr('x', -8).attr('text-anchor', 'end')
          .attr('font-size', d => highlightSet.has(d.iso3) ? 11 : 9.5)
          .attr('fill', labelColorL)
          .attr('font-weight', labelWeight)
          .attr('dominant-baseline', 'middle')
          .style('cursor', 'pointer'),
        update => update
          .attr('font-size', d => highlightSet.has(d.iso3) ? 11 : 9.5)
          .attr('fill', labelColorL)
          .attr('font-weight', labelWeight)
      )
      .transition().duration(500)
      .attr('y', d => leftY[d.iso3])
      .text(d => d.name.length > 16 ? d.name.slice(0, 14) + '…' : d.name)

    // Left label hover
    labelsLeftG.selectAll('text.label-left')
      .on('mousemove', function(event, d) {
        showTooltip(tooltip, tipContent(d), event)
        highlightCountry(d.iso3)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
        resetHighlight(highlightSet)
      })

    // Right labels
    labelsRightG.selectAll('text.label-right').data(rightSorted, d => d.iso3)
      .join(
        enter => enter.append('text').attr('class', 'label-right')
          .attr('x', innerW + 8).attr('text-anchor', 'start')
          .attr('font-size', d => highlightSet.has(d.iso3) ? 11 : 9.5)
          .attr('dominant-baseline', 'middle')
          .attr('fill', labelColorR)
          .attr('font-weight', labelWeight)
          .style('cursor', 'pointer'),
        update => update
          .attr('font-size', d => highlightSet.has(d.iso3) ? 11 : 9.5)
          .attr('fill', labelColorR)
          .attr('font-weight', labelWeight)
      )
      .transition().duration(500)
      .attr('y', d => rightY[d.iso3])
      .text(d => {
        const arrow = highlightSet.has(d.iso3) ? ` ▲+${d.rank_shift}` : ''
        return (d.name.length > 14 ? d.name.slice(0, 12) + '…' : d.name) + arrow
      })

    // Right label hover
    labelsRightG.selectAll('text.label-right')
      .on('mousemove', function(event, d) {
        showTooltip(tooltip, tipContent(d), event)
        highlightCountry(d.iso3)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
        resetHighlight(highlightSet)
      })

    firstRender = false
  }

  yearSlider.addEventListener('input', () => {
    currentYear = +yearSlider.value
    yearLabel.textContent = currentYear
    render(true)
  })

  render(true)
}
