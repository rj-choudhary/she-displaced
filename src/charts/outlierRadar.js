import { drawSingleRadar } from './radarChart.js'

// Draw Rwanda's radar in the outlier panel
export function drawOutlierRadar(data) {
  const year = 2025
  const yearData = data.filter(d => d.year === year)
  const rwanda = yearData.find(d => d.iso3 === 'RWA')
  if (!rwanda) return

  const tooltip = document.getElementById('radar-tooltip')
  drawSingleRadar('outlier-chart-rwanda', rwanda, '#2AADAD', tooltip)
}
