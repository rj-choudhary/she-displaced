import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { showTooltip, moveTooltip, hideTooltip, tooltipHtml, getDataForYear } from './utils.js'

const LAYER_CONFIG = {
  sdrs: {
    label: 'She Displacement Risk Score',
    accessor: d => d.sdrs,
    colorRange: ['#fef3f0', '#f4957f', '#e8614a', '#c0392b', '#7b1a0e'],
    domain: [0.2, 0.65],
    insight: (top3) => `Gender inequality amplifies climate risk. ${top3} face the highest combined displacement risk for women.`
  },
  vulnerability: {
    label: 'Climate Vulnerability',
    accessor: d => d.vulnerability,
    colorRange: ['#f0fafa', '#7dd3d3', '#2aadad', '#1a7a7a', '#0d4f4f'],
    domain: [0.2, 0.75],
    insight: (top3) => `Climate vulnerability alone. Compare with SDRS to see how gender changes the picture.`
  },
  gender_penalty: {
    label: 'Gender Penalty (1 − Gender Gap Score)',
    accessor: d => d.gender_penalty,
    colorRange: ['#fefbf0', '#f5d08a', '#e8a84a', '#c07a1a', '#7a4a00'],
    domain: [0.1, 0.65],
    insight: (top3) => `Where gender inequality is highest. ${top3} have the largest gender penalty amplifying climate risk.`
  }
}

export async function drawWorldMap(data) {
  const container = document.getElementById('world-map')
  const tooltip   = document.getElementById('map-tooltip')
  const legend    = document.getElementById('map-legend')
  const insightEl = document.getElementById('map-insight-text')
  const yearSlider = document.getElementById('map-year-slider')
  const yearLabel  = document.getElementById('map-year-label')

  let currentLayer = 'sdrs'
  let currentYear  = 2025

  // Load world topology
  const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  const countries = topojson.feature(world, world.objects.countries)

  // ISO numeric → ISO3 mapping (partial, covers most countries)
  const numToIso3 = await d3.json('https://cdn.jsdelivr.net/npm/country-iso-2-to-3@1.1.1/index.json')
    .catch(() => null)

  // Build a lookup from our data
  function buildLookup(year) {
    const yearData = getDataForYear(data, year)
    const map = {}
    yearData.forEach(d => { map[d.iso3] = d })
    return map
  }

  // We need numeric id → iso3. Use a hardcoded partial map for the most important ones
  const numericToIso3 = buildNumericMap()

  const W = container.offsetWidth || 960
  const H = Math.round(W * 0.52)

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')

  const projection = d3.geoNaturalEarth1()
    .scale(W / 6.3)
    .translate([W / 2, H / 2])

  const path = d3.geoPath().projection(projection)

  // Ocean background
  svg.append('rect')
    .attr('width', W).attr('height', H)
    .attr('fill', '#d4eaf5')

  // Graticule
  const graticule = d3.geoGraticule()
  svg.append('path')
    .datum(graticule())
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.3)')
    .attr('stroke-width', 0.3)

  const countryPaths = svg.append('g').attr('class', 'countries')

  countryPaths.selectAll('path')
    .data(countries.features)
    .join('path')
    .attr('d', path)
    .attr('class', 'country-path')
    .attr('stroke', 'rgba(255,255,255,0.6)')
    .attr('stroke-width', 0.4)
    .on('mousemove', function(event, d) {
      const iso3 = numericToIso3[+d.id]
      const lookup = buildLookup(currentYear)
      const rec = iso3 ? lookup[iso3] : null
      if (!rec) return
      const cfg = LAYER_CONFIG[currentLayer]
      showTooltip(tooltip, tooltipHtml(rec.name, [
        ['SDRS Score', rec.sdrs.toFixed(3)],
        ['Climate Vulnerability', rec.vulnerability.toFixed(3)],
        ['Gender Gap Score', rec.gender_gap.toFixed(3)],
        ['Gender Penalty', rec.gender_penalty.toFixed(3)],
        ['Readiness', rec.readiness.toFixed(3)],
        ['Region', rec.region],
      ]), event)
      d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5)
    })
    .on('mouseleave', function() {
      hideTooltip(tooltip)
      d3.select(this).attr('stroke', 'rgba(255,255,255,0.6)').attr('stroke-width', 0.4)
    })

  function render() {
    const cfg = LAYER_CONFIG[currentLayer]
    const lookup = buildLookup(currentYear)
    const colorScale = d3.scaleSequential()
      .domain(cfg.domain)
      .interpolator(d3.interpolateRgbBasis(cfg.colorRange))
      .clamp(true)

    countryPaths.selectAll('.country-path')
      .transition().duration(400)
      .attr('fill', d => {
        const iso3 = numericToIso3[+d.id]
        const rec = iso3 ? lookup[iso3] : null
        if (!rec) return '#d0d8e0'
        const val = cfg.accessor(rec)
        return val != null ? colorScale(val) : '#d0d8e0'
      })

    // Update legend
    renderLegend(cfg, colorScale)

    // Update insight
    const yearData = getDataForYear(data, currentYear)
    const sorted = yearData.sort((a, b) => cfg.accessor(b) - cfg.accessor(a))
    const top3 = sorted.slice(0, 3).map(d => d.name).join(', ')
    insightEl.textContent = cfg.insight(top3)
  }

  function renderLegend(cfg, colorScale) {
    legend.innerHTML = ''
    const steps = 6
    const [lo, hi] = cfg.domain
    const swatchW = 28

    const label = document.createElement('span')
    label.style.cssText = 'font-size:11px;color:#6B7280;margin-right:8px;white-space:nowrap'
    label.textContent = 'Low'
    legend.appendChild(label)

    for (let i = 0; i <= steps; i++) {
      const val = lo + (hi - lo) * (i / steps)
      const swatch = document.createElement('div')
      swatch.style.cssText = `width:${swatchW}px;height:12px;background:${colorScale(val)};display:inline-block;border-radius:2px`
      legend.appendChild(swatch)
    }

    const label2 = document.createElement('span')
    label2.style.cssText = 'font-size:11px;color:#6B7280;margin-left:8px;white-space:nowrap'
    label2.textContent = 'High'
    legend.appendChild(label2)

    const title = document.createElement('span')
    title.style.cssText = 'font-size:11px;color:#9CA3AF;margin-left:16px'
    title.textContent = cfg.label
    legend.appendChild(title)
  }

  // Controls
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentLayer = btn.dataset.layer
      render()
    })
  })

  yearSlider.addEventListener('input', () => {
    currentYear = +yearSlider.value
    yearLabel.textContent = currentYear
    render()
  })

  render()
}

function buildNumericMap() {
  // ISO 3166-1 numeric → ISO3 for countries in our dataset
  return {
    4:'AFG',8:'ALB',12:'DZA',20:'AND',24:'AGO',28:'ATG',32:'ARG',51:'ARM',
    36:'AUS',40:'AUT',31:'AZE',44:'BHS',48:'BHR',50:'BGD',52:'BRB',112:'BLR',
    56:'BEL',84:'BLZ',204:'BEN',64:'BTN',68:'BOL',70:'BIH',72:'BWA',76:'BRA',
    96:'BRN',100:'BGR',854:'BFA',108:'BDI',132:'CPV',116:'KHM',120:'CMR',
    124:'CAN',140:'CAF',148:'TCD',152:'CHL',156:'CHN',170:'COL',174:'COM',
    180:'COD',178:'COG',188:'CRI',384:'CIV',191:'HRV',192:'CUB',196:'CYP',
    203:'CZE',208:'DNK',262:'DJI',214:'DOM',218:'ECU',818:'EGY',222:'SLV',
    226:'GNQ',232:'ERI',233:'EST',748:'SWZ',231:'ETH',242:'FJI',246:'FIN',
    250:'FRA',266:'GAB',270:'GMB',268:'GEO',276:'DEU',288:'GHA',300:'GRC',
    320:'GTM',324:'GIN',624:'GNB',328:'GUY',332:'HTI',340:'HND',348:'HUN',
    352:'ISL',356:'IND',360:'IDN',364:'IRN',368:'IRQ',372:'IRL',376:'ISR',
    380:'ITA',388:'JAM',392:'JPN',400:'JOR',398:'KAZ',404:'KEN',296:'KIR',
    408:'PRK',410:'KOR',414:'KWT',417:'KGZ',418:'LAO',428:'LVA',422:'LBN',
    426:'LSO',430:'LBR',434:'LBY',438:'LIE',440:'LTU',442:'LUX',450:'MDG',
    454:'MWI',458:'MYS',462:'MDV',466:'MLI',470:'MLT',584:'MHL',478:'MRT',
    480:'MUS',484:'MEX',583:'FSM',498:'MDA',492:'MCO',496:'MNG',499:'MNE',
    504:'MAR',508:'MOZ',104:'MMR',516:'NAM',520:'NRU',524:'NPL',528:'NLD',
    554:'NZL',558:'NIC',562:'NER',566:'NGA',807:'MKD',578:'NOR',512:'OMN',
    586:'PAK',585:'PLW',591:'PAN',598:'PNG',600:'PRY',604:'PER',608:'PHL',
    616:'POL',620:'PRT',634:'QAT',642:'ROU',643:'RUS',646:'RWA',659:'KNA',
    662:'LCA',670:'VCT',882:'WSM',678:'STP',682:'SAU',686:'SEN',688:'SRB',
    694:'SLE',702:'SGP',703:'SVK',705:'SVN',90:'SLB',706:'SOM',710:'ZAF',
    728:'SSD',724:'ESP',144:'LKA',729:'SDN',740:'SUR',752:'SWE',756:'CHE',
    760:'SYR',762:'TJK',834:'TZA',764:'THA',626:'TLS',768:'TGO',776:'TON',
    780:'TTO',788:'TUN',792:'TUR',795:'TKM',798:'TUV',800:'UGA',804:'UKR',
    784:'ARE',826:'GBR',840:'USA',858:'URY',860:'UZB',548:'VUT',862:'VEN',
    704:'VNM',887:'YEM',894:'ZMB',716:'ZWE',275:'PSE',850:'VIR',
  }
}
