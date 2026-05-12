import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { showTooltip, moveTooltip, hideTooltip, tooltipHtml, getDataForYear } from './utils.js'

const LAYER_CONFIG = {
  sdrs: {
    label: 'She Displacement Risk Score',
    shortLabel: 'SDRS',
    accent: '#E8614A',
    tag: 'Combined Risk',
    accessor: d => d.sdrs,
    colorRange: ['#fef3f0', '#f4957f', '#e8614a', '#c0392b', '#7b1a0e'],
    domain: [0.2, 0.65],
    headline: 'Gender inequality amplifies climate risk.',
    caption: 'These 3 countries face the highest combined displacement risk for women.',
  },
  vulnerability: {
    label: 'Climate Vulnerability',
    shortLabel: 'Climate',
    accent: '#2AADAD',
    tag: 'Climate Layer',
    accessor: d => d.vulnerability,
    colorRange: ['#f0fafa', '#7dd3d3', '#2aadad', '#1a7a7a', '#0d4f4f'],
    domain: [0.2, 0.75],
    headline: 'Climate vulnerability alone — without the gender lens.',
    caption: 'Most physically exposed to floods, drought, storms, and heat.',
  },
  gender_penalty: {
    label: 'Gender Penalty (1 − Gender Gap Score)',
    shortLabel: 'Gender',
    accent: '#9b59b6',
    tag: 'Gender Layer',
    accessor: d => d.gender_penalty,
    colorRange: ['#f5f0fa', '#c8a8e0', '#9b59b6', '#6a3093', '#3b1464'],
    domain: [0.1, 0.65],
    headline: 'Where gender inequality is structurally deepest.',
    caption: 'Highest gender penalty — a multiplier on every climate event.',
  }
}

export async function drawWorldMap(data, topologyPromise = null) {
  const container = document.getElementById('world-map')
  const tooltip   = document.getElementById('map-tooltip')
  const legend    = document.getElementById('map-legend')
  const yearSlider = document.getElementById('map-year-slider')
  const yearLabel  = document.getElementById('map-year-label')

  let currentLayer = 'sdrs'
  let currentYear  = 2025

  // Load world topology — same-origin from /public so Vercel's edge cache serves
  // it with 1-year immutable headers (see vercel.json). When main.js pre-fetches
  // in parallel with sdrs_data.json, the promise resolves before drawWorldMap
  // even starts rendering; otherwise we fall back to fetching here.
  let world
  try {
    world = topologyPromise
      ? await topologyPromise
      : await d3.json('/countries-110m.json')
  } catch (err) {
    if (import.meta.env.DEV) console.error('[worldMap] topology failed:', err)
    world = null
  }
  if (!world) {
    container.innerHTML = `
      <div style="padding:60px 20px;text-align:center;color:var(--muted);font-size:13px;line-height:1.6;">
        Map geometry failed to load.<br/>
        <span style="font-size:12px;opacity:0.7">Please check your connection and refresh.</span>
      </div>
    `
    return
  }
  const countries = topojson.feature(world, world.objects.countries)

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

  const projection = d3.geoEqualEarth()
    .scale(W / 5.5)
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
      // Safe formatter — some countries have climate data but no SDRS/gender rows
      // (e.g. Somalia, North Korea). Null-guard every field so the tooltip renders
      // for partially-covered countries instead of silently throwing.
      const fmt = v => (v == null ? 'N/A' : v.toFixed(3))
      const rows = [
        ['SDRS Score',             fmt(rec.sdrs)],
        ['Climate Vulnerability',  fmt(rec.vulnerability)],
        ['Gender Gap Score',       fmt(rec.gender_gap)],
        ['Gender Penalty',         fmt(rec.gender_penalty)],
        ['Readiness',              fmt(rec.readiness)],
        ['Region',                 rec.region || 'N/A'],
      ]
      // If SDRS is missing, flag it so users understand why the country is grayed
      // out in the SDRS/Gender layers but colored in the Climate layer.
      if (rec.sdrs == null) {
        rows.unshift(['Status', 'Partial data — SDRS not available'])
      }
      showTooltip(tooltip, tooltipHtml(rec.name, rows), event)
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

    // Update insight — editorial card with top-3 badges
    const yearData = getDataForYear(data, currentYear)
    const sorted = yearData.sort((a, b) => cfg.accessor(b) - cfg.accessor(a))
    const top3 = sorted.slice(0, 3)
    const median = d3.median(yearData, d => cfg.accessor(d))
    const topVal = top3[0] ? cfg.accessor(top3[0]) : null
    const multiplier = (median && topVal) ? (topVal / median) : null

    const insightContainer = document.getElementById('map-insight')
    if (insightContainer) {
      insightContainer.style.setProperty('--layer-accent', cfg.accent)
      insightContainer.innerHTML = `
        <div class="mi-tag">${cfg.tag}</div>
        <div class="mi-year">${currentYear}</div>
        <h4 class="mi-headline">${cfg.headline}</h4>
        <p class="mi-caption">${cfg.caption}</p>
        <div class="mi-divider"></div>
        <div class="mi-label">Top 3 this year</div>
        <ol class="mi-top3">
          ${top3.map((d, i) => `
            <li class="mi-top-item">
              <span class="mi-rank">${i + 1}</span>
              <span class="mi-country">${d.name}</span>
              <span class="mi-value">${cfg.accessor(d).toFixed(3)}</span>
            </li>
          `).join('')}
        </ol>
        ${median != null ? `
        <div class="mi-median" title="Middle value across all scored countries this year. Half of countries score above, half below.">
          <span class="mi-median-label">Global median</span>
          <span class="mi-median-bar"><span class="mi-median-fill" style="width:${Math.min(100, (median / (cfg.domain[1] || 1)) * 100).toFixed(1)}%"></span></span>
          <span class="mi-median-val">${median.toFixed(3)}</span>
        </div>
        ${multiplier ? `<div class="mi-median-note">Top country is <strong>${multiplier.toFixed(1)}×</strong> the median</div>` : ''}
        ` : ''}
        <div class="mi-footer">
          <span class="mi-dot" style="background:${cfg.accent}"></span>
          <span>Viewing: ${cfg.shortLabel}</span>
        </div>
      `
    }
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
