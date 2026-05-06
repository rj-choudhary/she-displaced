import * as d3 from 'd3'

export const COLORS = {
  coral:   '#E8614A',
  coralLt: '#F4957F',
  teal:    '#1A7A7A',
  tealLt:  '#2AADAD',
  amber:   '#E8A84A',
  ink:     '#1A1A2E',
  cream:   '#FAF7F2',
  muted:   '#6B7280',
}

export const REGION_COLORS = {
  'Sub-Saharan Africa': '#E8614A',
  'South Asia':         '#E8A84A',
  'MENA':               '#C0392B',
  'East Asia':          '#2AADAD',
  'Latin America':      '#8B5CF6',
  'Europe':             '#1A7A7A',
  'North America':      '#059669',
  'Oceania':            '#0EA5E9',
  'Central Asia':       '#F59E0B',
  'Other':              '#9CA3AF',
}

export function showTooltip(tooltipEl, html, event) {
  tooltipEl.innerHTML = html
  tooltipEl.classList.remove('hidden')
  moveTooltip(tooltipEl, event)
}

export function moveTooltip(tooltipEl, event) {
  const x = event.clientX
  const y = event.clientY
  const tw = tooltipEl.offsetWidth
  const th = tooltipEl.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = x + 16
  let top  = y + 16

  // If tooltip would go off-screen right, flip to left of cursor
  if (left + tw > vw - 16) left = x - tw - 16

  // If tooltip would go off-screen bottom, push it up but keep it near cursor
  if (top + th > vh - 8) top = vh - th - 8

  // Never go above viewport
  if (top < 8) top = 8

  tooltipEl.style.left = left + 'px'
  tooltipEl.style.top  = top  + 'px'
}

export function hideTooltip(tooltipEl) {
  tooltipEl.classList.add('hidden')
}

export function tooltipHtml(title, rows) {
  const rowsHtml = rows.map(([label, val]) =>
    `<div class="tooltip-row"><span class="tooltip-label">${label}</span><span class="tooltip-val">${val}</span></div>`
  ).join('')
  return `<div class="tooltip-title">${title}</div>${rowsHtml}`
}

export function getDataForYear(data, year) {
  return data.filter(d => d.year === year)
}

export function getCountryTimeSeries(data, iso3) {
  return data.filter(d => d.iso3 === iso3).sort((a, b) => a.year - b.year)
}

export function formatScore(v) {
  return v != null ? v.toFixed(3) : 'N/A'
}

export function formatPct(v) {
  return v != null ? (v * 100).toFixed(1) + '%' : 'N/A'
}
