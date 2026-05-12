import * as d3 from 'd3'
import { showTooltip, hideTooltip, tooltipHtml, getDataForYear } from './utils.js'

const QUADRANTS = [
  { id:'tl', label:'Physical Exposure',  labelPos:'tl',
    description:'High climate vulnerability, but gender inequality is not the main driver. Acute physical risk dominates — e.g., Pacific and Caribbean island states.',
    color:'rgba(232,168,74,0.07)', stroke:'rgba(232,168,74,0.3)',  x1:0.1,  x2:0.4, y1:0.55, y2:0.85 },
  { id:'tr', label:'Compounding Crisis', labelPos:'tr',
    description:'High climate vulnerability compounded by severe gender inequality. The most acute displacement risk combination — e.g., Afghanistan, Yemen, Chad.',
    color:'rgba(232,97,74,0.08)',  stroke:'rgba(232,97,74,0.35)',  x1:0.4, x2:0.7,  y1:0.55, y2:0.85 },
  { id:'bl', label:'Resilient Leaders',  labelPos:'bl',
    description:'Low climate exposure paired with strong gender equity. The structural blueprint for resilience — e.g., Nordic countries, Canada.',
    color:'rgba(26,122,122,0.07)', stroke:'rgba(26,122,122,0.25)', x1:0.1,  x2:0.4, y1:0.1,  y2:0.55 },
  { id:'br', label:'The Glass Ceiling',  labelPos:'br',
    description:'Strong climate adaptation capacity but persistent gender inequality. Often wealthy economies where women still face structural barriers — e.g., Gulf states.',
    color:'rgba(139,92,246,0.07)', stroke:'rgba(139,92,246,0.25)', x1:0.4, x2:0.7,  y1:0.1,  y2:0.55 },
]

export function drawBubbleChart(data) {
  const container  = document.getElementById('bubble-chart')
  const tooltip    = document.getElementById('bubble-tooltip')
  const ddTooltip  = document.getElementById('drilldown-tooltip')
  const playBtn    = document.getElementById('bubble-play')
  const slider     = document.getElementById('bubble-year-slider')
  const yearDisp   = document.getElementById('bubble-year-display')
  const ddTitle    = document.getElementById('drilldown-title')
  const ddSubtitle = document.getElementById('drilldown-subtitle')
  const vmWorld    = document.getElementById('vm-world')
  const vmCountry  = document.getElementById('vm-country')
  const focusCtrl  = document.getElementById('country-focus-controls')
  const velLegend  = document.getElementById('velocity-legend')
  const countryInp = document.getElementById('bubble-country-input')
  const countryDd  = document.getElementById('bubble-country-dropdown')

  const sdrsData = data.filter(d => d.sdrs != null && d.gender_penalty != null)
  const years    = [...new Set(sdrsData.map(d => d.year))].sort()

  let currentYear  = years[0]
  let playing      = false
  let timer        = null
  let viewMode     = 'world'   // 'world' | 'country'
  let focusIso     = null      // selected country in country mode
  let clickedIso   = null      // clicked bubble in world mode (drives line chart only)

  // ── Velocity ──────────────────────────────────────────────────
  const velocityMap = {}
  const byIso = d3.group(sdrsData, d => d.iso3)
  byIso.forEach((recs, iso) => {
    const s = recs.sort((a,b) => a.year - b.year)
    velocityMap[iso] = s.length < 2 ? 0 : (s[s.length-1].sdrs - s[0].sdrs) / (s.length-1)
  })
  const velExt   = d3.extent(Object.values(velocityMap))
  const velColor = d3.scaleDiverging()
    .domain([velExt[0], 0, velExt[1]])
    .interpolator(d3.interpolateRgbBasis(['#0D9488','#9CA3AF','#C0392B']))

  // Velocity category helper
  function velCategory(iso) {
    const v = velocityMap[iso] || 0
    if (v > 0.002) return 'rising'
    if (v < -0.002) return 'improving'
    return 'stable'
  }
  function velGlyph(iso) {
    const cat = velCategory(iso)
    if (cat === 'rising') return '▲'
    if (cat === 'improving') return '▼'
    return '●'
  }

  // ── Top 12 ────────────────────────────────────────────────────
  const avgSdrs = []
  byIso.forEach((recs, iso) => {
    const wr = recs.filter(d => d.sdrs != null)
    if (!wr.length) return
    avgSdrs.push({ iso3:iso, name:recs[0].name, region:recs[0].region,
      avg: d3.mean(wr, d=>d.sdrs), records: wr.sort((a,b)=>a.year-b.year) })
  })
  const top12 = avgSdrs.sort((a,b)=>b.avg-a.avg).slice(0,10)

  // ── Regional time series (mean SDRS per region per year) ──────
  const REGION_COLORS = {
    'Sub-Saharan Africa':        '#E8614A',
    'South Asia':                '#E8A84A',
    'MENA':                      '#C0392B',
    'East Asia & Pacific':       '#2AADAD',
    'Latin America & Caribbean': '#8B5CF6',
    'Europe':                    '#1A7A7A',
    'Central Asia':              '#F59E0B',
    'North America':             '#059669',
  }
  // Regions shown as default lines in the World View chart (8 World Bank groupings)
  const REGION_ORDER_DEFAULT = [
    'Sub-Saharan Africa', 'South Asia', 'MENA', 'East Asia & Pacific',
    'Latin America & Caribbean', 'Europe', 'Central Asia', 'North America'
  ]
  // All regions — used for country-focus reference line (must cover every country)
  const ALL_REGIONS = REGION_ORDER_DEFAULT

  function buildRegionalSeries(region) {
    const regionData = sdrsData.filter(d => d.region === region && d.sdrs != null)
    if (!regionData.length) return null
    const byYear = d3.group(regionData, d => d.year)
    const records = years.map(yr => {
      const yrRecs = byYear.get(yr) || []
      return {
        year: yr,
        sdrs: yrRecs.length ? d3.mean(yrRecs, d => d.sdrs) : null,
        count: yrRecs.length,
      }
    }).filter(d => d.sdrs != null)
    if (!records.length) return null
    return {
      region,
      color: REGION_COLORS[region] || '#9CA3AF',
      records,
      latest: records[records.length - 1],
    }
  }

  const regionalSeries = REGION_ORDER_DEFAULT.map(buildRegionalSeries).filter(Boolean)

  // Regional series lookup by region name (covers ALL regions for country drilldown)
  const regionalByName = {}
  ALL_REGIONS.forEach(region => {
    const series = buildRegionalSeries(region)
    if (series) regionalByName[region] = series
  })

  // ── Global median ─────────────────────────────────────────────
  const globalMedian = {}
  years.forEach(yr => { globalMedian[yr] = d3.median(getDataForYear(sdrsData,yr), d=>d.sdrs)||0 })

  // ── Country list for search ───────────────────────────────────
  const countries = Array.from(new Map(sdrsData.filter(d=>d.name).map(d=>[d.iso3,d.name])).entries())
    .sort((a,b)=>a[1].localeCompare(b[1]))

  // ── Resilience outlier ────────────────────────────────────────
  let resilienceOutlier = null
  const fd = getDataForYear(sdrsData, years[0]), ld = getDataForYear(sdrsData, years[years.length-1])
  fd.forEach(d => {
    if (d.gender_penalty>0.4 && d.vulnerability>0.55) {
      const later = ld.find(l=>l.iso3===d.iso3)
      if (later && later.gender_penalty<0.3 && later.vulnerability<0.5)
        if (!resilienceOutlier || later.sdrs<resilienceOutlier.sdrs) resilienceOutlier=later
    }
  })

  // ── SCATTER SVG ───────────────────────────────────────────────
  // Bottom margin sized to clear axis tick labels (~12px) + breathing room + title.
  const sm = {top:14,right:20,bottom:52,left:58}
  const SW=640, SH=420, siW=SW-sm.left-sm.right, siH=SH-sm.top-sm.bottom

  const scatterSvg = d3.select(container).append('svg')
    .attr('viewBox',`0 0 ${SW} ${SH}`).style('width','100%').style('height','420px')
    .attr('preserveAspectRatio','xMidYMid meet')
  const sg = scatterSvg.append('g').attr('transform',`translate(${sm.left},${sm.top})`)

  // Glow filters for active/high-risk bubbles
  const defs = scatterSvg.append('defs')
  defs.html(`
    <filter id="bubble-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="bubble-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  `)

  const xSc = d3.scaleLinear().domain([0.1, 0.7]).range([0,siW]).clamp(true)
  const ySc = d3.scaleLinear().domain([0.1, 0.85]).range([siH,0]).clamp(true)
  const rSc = d3.scaleSqrt().domain([0,15000000]).range([3,20]).clamp(true)

  QUADRANTS.forEach(q => {
    const x1=xSc(q.x1),x2=xSc(q.x2),y1=ySc(q.y2),y2=ySc(q.y1)
    // Quadrant rect — hover shows the HTML tooltip with plain-English description.
    // Bubble hover takes priority because bubbles sit above rects in SVG z-order and
    // have their own mousemove handler that overwrites the tooltip content.
    const rect = sg.append('rect').attr('x',x1).attr('y',y1).attr('width',x2-x1).attr('height',y2-y1)
      .attr('fill',q.color).attr('stroke',q.stroke).attr('stroke-width',0.8).attr('stroke-dasharray','4,3')
      .style('cursor','help')
      .on('mousemove', function(event) {
        showTooltip(tooltip, `<div class="tooltip-title">${q.label}</div><div class="tooltip-row" style="white-space:normal;line-height:1.45;max-width:260px;">${q.description}</div>`, event)
      })
      .on('mouseleave', function() {
        hideTooltip(tooltip)
      })

    // Position label by the quadrant's intrinsic corner so bubbles (which cluster
    // toward the chart's interior) don't overlap with the text.
    const pad = 8
    let lx, ly, anchor
    if (q.labelPos === 'tl')       { lx = x1 + pad; ly = y1 + 14; anchor = 'start' }
    else if (q.labelPos === 'tr')  { lx = x2 - pad; ly = y1 + 14; anchor = 'end'   }
    else if (q.labelPos === 'bl')  { lx = x1 + pad; ly = y2 - 6;  anchor = 'start' }
    else /* 'br' */                { lx = x2 - pad; ly = y2 - 6;  anchor = 'end'   }

    sg.append('text').attr('x',lx).attr('y',ly)
      .attr('text-anchor',anchor)
      .attr('fill',q.stroke.replace(/[\d.]+\)$/,'0.85)'))
      .attr('font-size',11).attr('font-weight','700').attr('letter-spacing','0.07em')
      .attr('pointer-events','none')
      .text(q.label.toUpperCase())
  })
  sg.append('line').attr('x1',xSc(0.4)).attr('x2',xSc(0.4)).attr('y1',0).attr('y2',siH)
    .attr('stroke','rgba(0,0,0,0.1)').attr('stroke-width',1).attr('stroke-dasharray','3,3')
  sg.append('line').attr('x1',0).attr('x2',siW).attr('y1',ySc(0.55)).attr('y2',ySc(0.55))
    .attr('stroke','rgba(0,0,0,0.1)').attr('stroke-width',1).attr('stroke-dasharray','3,3')

  sg.append('g').attr('transform',`translate(0,${siH})`)
    .call(d3.axisBottom(xSc).ticks(5).tickFormat(d3.format('.1f')))
    .call(ax=>{ax.select('.domain').remove();ax.selectAll('line').attr('stroke','rgba(0,0,0,0.08)');ax.selectAll('text').attr('fill','#9CA3AF').attr('font-size',9)})
  sg.append('g').call(d3.axisLeft(ySc).ticks(5).tickFormat(d3.format('.2f')))
    .call(ax=>{ax.select('.domain').remove();ax.selectAll('line').attr('stroke','rgba(0,0,0,0.08)');ax.selectAll('text').attr('fill','#9CA3AF').attr('font-size',9)})

  // X-axis title — pushed into the bottom margin, well clear of tick labels
  scatterSvg.append('text').attr('x',sm.left+siW/2).attr('y',SH-10)
    .attr('text-anchor','middle').attr('fill','#6B7280').attr('font-size',11)
    .text('Gender Penalty →  Higher = More Inequality')
  scatterSvg.append('text').attr('transform','rotate(-90)').attr('x',-(sm.top+siH/2)).attr('y',14)
    .attr('text-anchor','middle').attr('fill','#6B7280').attr('font-size',11).text('Climate Vulnerability →  Higher = More Exposed')

  // ── Bubble size legend is rendered in HTML above the chart (see index.html) ──
  // Leave SVG margin normal — no inline legend

  const bubblesG = sg.append('g').attr('class','bubbles')
  const ringsG   = sg.append('g').attr('class','rings-group').style('pointer-events','none')
  const annotG   = sg.append('g').attr('class','annot-group')
  const labelG   = sg.append('g').attr('class','label-group')

  // Country journey line (country mode only)
  const journeyG = sg.append('g').attr('class','journey-group')

  // ── DRILLDOWN SVG ─────────────────────────────────────────────
  const ddContainer = document.getElementById('drilldown-chart')
  const dm = {top:28,right:60,bottom:44,left:8}
  const DW=440, DH=440, diW=DW-dm.left-dm.right, diH=DH-dm.top-dm.bottom

  const ddSvg = d3.select(ddContainer).append('svg')
    .attr('viewBox',`0 0 ${DW} ${DH}`).style('width','100%').style('height','440px')
    .attr('preserveAspectRatio','xMidYMid meet')
  const dg = ddSvg.append('g').attr('transform',`translate(${dm.left},${dm.top})`)

  const xDD = d3.scaleLinear().domain(d3.extent(years)).range([0,diW])
  const yDD = d3.scaleLinear().domain([0.1,0.85]).range([diH,0]).clamp(true)

  // Grid lines only (no tick labels)
  dg.append('g').call(d3.axisLeft(yDD).ticks(5).tickSize(-diW).tickFormat(''))
    .call(ax=>{ax.select('.domain').remove();ax.selectAll('line').attr('stroke','rgba(0,0,0,0.07)')})

  // X axis — explicit anchors at 2006 (start), 2010, 2015, 2020, 2025 (end)
  dg.append('g').attr('transform',`translate(0,${diH})`)
    .call(d3.axisBottom(xDD).tickValues([2006, 2010, 2015, 2020, 2025]).tickFormat(d3.format('d')))
    .call(ax=>{ax.select('.domain').remove();ax.selectAll('line').attr('stroke','rgba(0,0,0,0.07)');ax.selectAll('text').attr('fill','#9CA3AF').attr('font-size',9)})

  // Y axis labels — positioned to the LEFT of the chart area (negative x)
  dg.append('g')
    .call(d3.axisLeft(yDD).ticks(5).tickFormat(d3.format('.2f')).tickSize(0))
    .call(ax=>{
      ax.select('.domain').remove()
      ax.selectAll('text').attr('fill','#9CA3AF').attr('font-size',9).attr('x',-6).attr('text-anchor','end')
    })

  ddSvg.append('text').attr('x',dm.left+diW/2).attr('y',DH-6)
    .attr('text-anchor','middle').attr('fill','#9CA3AF').attr('font-size',10).text('Year')
  // Score label removed — legend explains the lines

  // Median band
  const medData = years.map(yr=>({year:yr,med:globalMedian[yr]}))
  const medArea = d3.area().x(d=>xDD(d.year)).y0(d=>yDD(d.med-0.02)).y1(d=>yDD(d.med+0.02)).curve(d3.curveCatmullRom)
  const medLine = d3.line().x(d=>xDD(d.year)).y(d=>yDD(d.med)).curve(d3.curveCatmullRom)
  dg.append('path').datum(medData).attr('fill','rgba(0,0,0,0.04)').attr('d',medArea)
  dg.append('path').datum(medData).attr('fill','none').attr('stroke','rgba(0,0,0,0.15)')
    .attr('stroke-width',1).attr('stroke-dasharray','4,3').attr('d',medLine)

  const linesG = dg.append('g').attr('class','dd-lines')


  // ── Default: Regional time series (7 continents) ──────────────
  function drawTop12() {
    ddTitle.textContent    = 'Regional Risk Trajectories'
    ddSubtitle.textContent = 'Mean SDRS by region · click a bubble for country detail'
    linesG.selectAll('*').remove()
    const legendEl = document.getElementById('drilldown-legend')
    if (legendEl) legendEl.classList.remove('mode-country')

    // Pre-compute label positions with collision avoidance
    const labelData = regionalSeries.map(r => {
      return { r, rawY: yDD(r.latest.sdrs) }
    }).sort((a,b) => a.rawY - b.rawY)

    const minGap = 11
    for (let i = 1; i < labelData.length; i++) {
      if (labelData[i].rawY - labelData[i-1].rawY < minGap) {
        labelData[i].rawY = labelData[i-1].rawY + minGap
      }
    }
    const labelY = {}
    labelData.forEach(d => { labelY[d.r.region] = d.rawY })

    regionalSeries.forEach((r, ri) => {
      const lf = d3.line()
        .x(d => xDD(d.year))
        .y(d => yDD(d.sdrs))
        .curve(d3.curveCatmullRom)
        .defined(d => d.sdrs != null)

      const path = linesG.append('path').datum(r.records)
        .attr('fill', 'none')
        .attr('stroke', r.color)
        .attr('stroke-width', 2.2)
        .attr('opacity', 0.85)
        .attr('d', lf)

      // Running-line reveal
      const len = path.node().getTotalLength()
      path.attr('stroke-dasharray', `${len} ${len}`)
          .attr('stroke-dashoffset', len)
          .transition().duration(1100).delay(ri * 120).ease(d3.easeLinear)
          .attr('stroke-dashoffset', 0)

      // Endpoint dot
      const last = r.latest
      linesG.append('circle')
        .attr('cx', xDD(last.year))
        .attr('cy', yDD(last.sdrs))
        .attr('r', 3.5)
        .attr('fill', r.color)
        .attr('opacity', 0)
        .transition().duration(400).delay(ri * 120 + 900)
        .attr('opacity', 1)

      // Region label at end of line
      linesG.append('text')
        .attr('x', xDD(last.year) + 7)
        .attr('y', labelY[r.region] + 3)
        .attr('fill', r.color)
        .attr('font-size', 9)
        .attr('font-weight', '600')
        .text(r.region.length > 14 ? r.region.slice(0, 12) + '…' : r.region)

      // Fat invisible hit area for easier hover
      linesG.append('path').datum(r.records)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 12)
        .attr('d', lf)
        .on('mousemove', e => {
          const first = r.records[0]
          const change = last.sdrs - first.sdrs
          showTooltip(ddTooltip, tooltipHtml(r.region, [
            ['Latest (' + last.year + ')', last.sdrs.toFixed(3)],
            ['First (' + first.year + ')', first.sdrs.toFixed(3)],
            ['Change', (change >= 0 ? '+' : '') + change.toFixed(3)],
            ['Countries', last.count],
          ]), e)
          path.attr('stroke-width', 3.5).attr('opacity', 1)
        })
        .on('mouseleave', () => {
          hideTooltip(ddTooltip)
          path.attr('stroke-width', 2.2).attr('opacity', 0.85)
        })
    })
  }

  // ── Country drill-down: 3-line decomposition + regional reference ──
  function drawCountryDrilldown(iso) {
    const recs = sdrsData.filter(d=>d.iso3===iso).sort((a,b)=>a.year-b.year)
    if (!recs.length) return
    const name = recs[0].name
    const regionName = recs[0].region
    ddTitle.textContent    = name
    ddSubtitle.textContent = 'SDRS decomposition vs regional average'
    linesG.selectAll('*').remove()
    const legendEl = document.getElementById('drilldown-legend')
    if (legendEl) legendEl.classList.add('mode-country')

    // Draw regional reference line FIRST (so it sits beneath country lines)
    const regionSeries = regionalByName[regionName]
    if (regionSeries && regionSeries.records.length) {
      const regColor = regionSeries.color
      const rlf = d3.line()
        .x(d => xDD(d.year))
        .y(d => yDD(d.sdrs))
        .curve(d3.curveCatmullRom)

      // Soft filled band — subtle area under regional average for depth
      const rArea = d3.area()
        .x(d => xDD(d.year))
        .y0(yDD(0.1))
        .y1(d => yDD(d.sdrs))
        .curve(d3.curveCatmullRom)

      // Very subtle regional area fill
      linesG.append('path').datum(regionSeries.records)
        .attr('fill', regColor)
        .attr('opacity', 0.05)
        .attr('d', rArea)

      // Dotted regional line
      const regPath = linesG.append('path').datum(regionSeries.records)
        .attr('fill', 'none')
        .attr('stroke', regColor)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '2,3')
        .attr('opacity', 0.55)
        .attr('d', rlf)

      // Running reveal
      const rLen = regPath.node().getTotalLength()
      regPath
        .attr('stroke-dasharray', rLen + ' ' + rLen)
        .attr('stroke-dashoffset', rLen)
        .transition().duration(900).ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0)
        .on('end', function() {
          d3.select(this).attr('stroke-dasharray', '2,3')
        })

      // Region label at end
      const rLast = regionSeries.latest
      linesG.append('text')
        .attr('x', xDD(rLast.year) + 5)
        .attr('y', yDD(rLast.sdrs) + 3)
        .attr('fill', regColor)
        .attr('font-size', 8)
        .attr('font-weight', '600')
        .attr('opacity', 0)
        .text(regionName.length > 14 ? regionName.slice(0, 12) + '…' : regionName)
        .transition().duration(400).delay(800).attr('opacity', 0.75)

      // Hover hit for regional line
      linesG.append('path').datum(regionSeries.records)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 10)
        .attr('d', rlf)
        .on('mousemove', e => {
          const first = regionSeries.records[0]
          const change = rLast.sdrs - first.sdrs
          showTooltip(ddTooltip, tooltipHtml(regionName + ' (regional avg)', [
            ['Latest', rLast.sdrs.toFixed(3)],
            ['First', first.sdrs.toFixed(3)],
            ['Change', (change >= 0 ? '+' : '') + change.toFixed(3)],
          ]), e)
        })
        .on('mouseleave', () => hideTooltip(ddTooltip))
    }

    const series = [
      {key:'sdrs',           label:'SDRS Score',           color:'#E8614A', w:2.5, dash:null},
      {key:'gender_penalty', label:'Gender Penalty',        color:'#8B5CF6', w:1.5, dash:'5,3'},
      {key:'vulnerability',  label:'Climate Vulnerability', color:'#2AADAD', w:1.5, dash:'5,3'},
    ]
    series.forEach((s, si) => {
      const valid = recs.filter(d=>d[s.key]!=null)
      if (!valid.length) return
      const lf = d3.line().x(d=>xDD(d.year)).y(d=>yDD(d[s.key])).curve(d3.curveCatmullRom)
      const path = linesG.append('path').datum(valid)
        .attr('fill','none').attr('stroke',s.color).attr('stroke-width',s.w)
        .attr('stroke-dasharray',s.dash||'none').attr('opacity',s.key==='sdrs'?0.95:0.7).attr('d',lf)

      // Running line draw-in
      const totalLen = path.node().getTotalLength()
      const origDash = s.dash
      path
        .attr('stroke-dasharray', totalLen + ' ' + totalLen)
        .attr('stroke-dashoffset', totalLen)
        .transition().duration(1100).delay(si * 150).ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0)
        .on('end', function() {
          d3.select(this).attr('stroke-dasharray', origDash || 'none')
        })

      const last = valid[valid.length-1]
      linesG.append('circle').attr('cx',xDD(last.year)).attr('cy',yDD(last[s.key])).attr('r',3.5)
        .attr('fill',s.color).attr('opacity',0)
        .transition().duration(400).delay(si * 150 + 900).attr('opacity',1)
      linesG.append('path').datum(valid).attr('fill','none').attr('stroke','transparent').attr('stroke-width',12).attr('d',lf)
        .on('mousemove',e=>{showTooltip(ddTooltip,tooltipHtml(s.label+' — '+name,[['Latest',last[s.key].toFixed(3)],['First',valid[0][s.key].toFixed(3)],['Change',((last[s.key]-valid[0][s.key])>=0?'+':'')+(last[s.key]-valid[0][s.key]).toFixed(3)]]),e)})
        .on('mouseleave',()=>hideTooltip(ddTooltip))
    })
  }

  // ── Scatter render ────────────────────────────────────────────
  function renderBubbles(year, animate) {
    let yearData = getDataForYear(sdrsData, year)

    // In country mode, show only the focused country's bubble prominently
    bubblesG.selectAll('circle.bubble').data(yearData, d=>d.iso3)
      .join(
        enter => enter.append('circle').attr('class','bubble')
          .attr('cx',d=>xSc(d.gender_penalty)).attr('cy',d=>ySc(d.vulnerability))
          .attr('r',0).attr('fill',d=>velColor(velocityMap[d.iso3]||0))
          .attr('opacity',0.75).attr('stroke','rgba(255,255,255,0.4)').attr('stroke-width',0.5)
          .style('cursor','pointer')
          .call(e=>e.transition().duration(400).attr('r',d=>Math.max(rSc(d.total_affected||0),4))),
        update => {
          const t = animate?update.transition().duration(600):update
          t.attr('cx',d=>xSc(d.gender_penalty)).attr('cy',d=>ySc(d.vulnerability))
           .attr('r',d=>Math.max(rSc(d.total_affected||0),4))
        },
        exit => exit.transition().duration(300).attr('r',0).remove()
      )

    // Opacity logic + crisis detection
    const activeIso = viewMode==='country' ? focusIso : clickedIso

    // "Compounding Crisis" = gender_penalty > 0.4 AND vulnerability > 0.55
    function isCrisis(d) {
      return d.gender_penalty > 0.4 && d.vulnerability > 0.55
    }

    bubblesG.selectAll('circle.bubble')
      .attr('opacity', d => {
        if (!activeIso) return isCrisis(d) ? 0.92 : 0.75
        return d.iso3===activeIso ? 1 : 0.18
      })
      .attr('stroke', d => {
        if (d.iso3===activeIso) return '#fff'
        if (isCrisis(d)) return 'rgba(255,255,255,0.65)'
        return 'rgba(255,255,255,0.3)'
      })
      .attr('stroke-width', d => {
        if (d.iso3===activeIso) return 2.5
        if (isCrisis(d)) return 1.2
        return 0.5
      })
      .attr('filter', d => {
        if (d.iso3===activeIso) return 'url(#bubble-glow-strong)'
        if (isCrisis(d) && !activeIso) return 'url(#bubble-glow)'
        return null
      })

    // Pulsing breathing ring on crisis bubbles (only when nothing is actively selected)
    ringsG.selectAll('circle.crisis-pulse').remove()
    ringsG.selectAll('circle.target-ring').remove()
    ringsG.selectAll('circle.target-ring-outer').remove()

    if (!activeIso) {
      // Breathing pulse on crisis countries
      const crisisData = yearData.filter(isCrisis)
      const pulses = ringsG.selectAll('circle.crisis-pulse')
        .data(crisisData, d => d.iso3)
        .join('circle')
        .attr('class', 'crisis-pulse')
        .attr('cx', d => xSc(d.gender_penalty))
        .attr('cy', d => ySc(d.vulnerability))
        .attr('r', d => Math.max(rSc(d.total_affected||0), 4))
        .attr('fill', 'none')
        .attr('stroke', '#C0392B')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.7)

      // Animate the pulse
      pulses.each(function(d, i) {
        const baseR = Math.max(rSc(d.total_affected||0), 4)
        const sel = d3.select(this)
        function pulse() {
          sel.attr('r', baseR).attr('opacity', 0.7)
            .transition().duration(1600).delay(i * 80).ease(d3.easeCubicOut)
            .attr('r', baseR * 2.2)
            .attr('opacity', 0)
            .on('end', pulse)
        }
        pulse()
      })
    }

    // Target-lock ring around active country (dual ring with rotation)
    if (activeIso) {
      const sel = yearData.find(d => d.iso3 === activeIso)
      if (sel) {
        const ax = xSc(sel.gender_penalty), ay = ySc(sel.vulnerability)
        const ar = Math.max(rSc(sel.total_affected||0), 4)

        // Outer rotating dashed ring
        const outerRing = ringsG.append('circle')
          .attr('class', 'target-ring-outer')
          .attr('cx', ax).attr('cy', ay)
          .attr('r', ar + 10)
          .attr('fill', 'none')
          .attr('stroke', '#E8614A')
          .attr('stroke-width', 1.2)
          .attr('stroke-dasharray', '3,4')
          .attr('opacity', 0.7)

        // Simple rotation via transform
        function rotate() {
          outerRing
            .attr('transform', `rotate(0 ${ax} ${ay})`)
            .transition().duration(6000).ease(d3.easeLinear)
            .attr('transform', `rotate(360 ${ax} ${ay})`)
            .on('end', rotate)
        }
        rotate()

        // Inner solid glow ring
        ringsG.append('circle')
          .attr('class', 'target-ring')
          .attr('cx', ax).attr('cy', ay)
          .attr('r', ar + 4)
          .attr('fill', 'none')
          .attr('stroke', 'rgba(232,97,74,0.4)')
          .attr('stroke-width', 2)
      }
    }

    // Velocity glyphs removed — cleaner bubble appearance
    bubblesG.selectAll('text.vel-glyph').remove()

    // Country journey path removed — cleaner visualization
    journeyG.selectAll('*').remove()

    // Resilience outlier
    annotG.selectAll('*').remove()
    if (resilienceOutlier && viewMode==='world') {
      const ro = yearData.find(d=>d.iso3===resilienceOutlier.iso3)
      if (ro) {
        const rx=xSc(ro.gender_penalty), ry=ySc(ro.vulnerability), r=Math.max(rSc(ro.total_affected||0),4)
        annotG.append('circle').attr('cx',rx).attr('cy',ry).attr('r',r+5)
          .attr('fill','none').attr('stroke','#0D9488').attr('stroke-width',1.5).attr('stroke-dasharray','3,2').attr('opacity',0.8)
        annotG.append('text').attr('x',rx+r+7).attr('y',ry-5).attr('fill','#0D9488').attr('font-size',7.5).attr('font-weight','700').text('✦ POLICY SUCCESS')
        annotG.append('text').attr('x',rx+r+7).attr('y',ry+5).attr('fill','#0D9488').attr('font-size',7.5).text(ro.name)
      }
    }

    // Label for active country
    labelG.selectAll('*').remove()
    const activeIso2 = viewMode==='country' ? focusIso : clickedIso
    if (activeIso2) {
      const sel = yearData.find(d=>d.iso3===activeIso2)
      if (sel) {
        const r = Math.max(rSc(sel.total_affected||0),4)
        labelG.append('text').attr('x',xSc(sel.gender_penalty)+r+4).attr('y',ySc(sel.vulnerability)-4)
          .attr('font-size',10).attr('font-weight','700').attr('fill','#1A1A2E').text(sel.name)
      }
    }

    updateInsights(year, yearData)
    attachEvents()
  }

  // ── Events ────────────────────────────────────────────────────
  function attachEvents() {
    bubblesG.selectAll('circle.bubble')
      .on('mousemove', function(event,d) {
        const vel=velocityMap[d.iso3]||0
        showTooltip(tooltip,tooltipHtml(d.name,[
          ['SDRS',d.sdrs!=null?d.sdrs.toFixed(3):'N/A'],
          ['Vulnerability',d.vulnerability.toFixed(3)],
          ['Gender Penalty',d.gender_penalty.toFixed(3)],
          ['Risk Velocity',(vel>=0?'+':'')+vel.toFixed(4)+'/yr'],
          ['Region',d.region],
        ]),event)

        // Hover: scale up + add radiant ring
        const self = d3.select(this)
        const origR = Math.max(rSc(d.total_affected||0), 4)
        self.transition().duration(150)
          .attr('r', origR * 1.35)
          .attr('stroke-width', 2)
          .attr('stroke', '#fff')

        // Remove any existing hover ring, add new one
        ringsG.selectAll('.hover-ring').remove()
        ringsG.append('circle')
          .attr('class', 'hover-ring')
          .attr('cx', xSc(d.gender_penalty))
          .attr('cy', ySc(d.vulnerability))
          .attr('r', origR)
          .attr('fill', 'none')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.8)
          .transition().duration(500).ease(d3.easeCubicOut)
          .attr('r', origR * 2.5)
          .attr('opacity', 0)
          .remove()
      })
      .on('mouseleave', function(event, d) {
        hideTooltip(tooltip)
        const self = d3.select(this)
        const origR = Math.max(rSc(d.total_affected||0), 4)
        const activeIso = viewMode==='country' ? focusIso : clickedIso
        const isActive = d.iso3 === activeIso
        self.transition().duration(200)
          .attr('r', origR)
          .attr('stroke-width', isActive ? 2.5 : (d.gender_penalty > 0.4 && d.vulnerability > 0.55 ? 1.2 : 0.5))
          .attr('stroke', isActive ? '#fff' : (d.gender_penalty > 0.4 && d.vulnerability > 0.55 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)'))
      })
      .on('click', function(event,d) {
        event.stopPropagation()
        // Always switch to Country Focus when clicking a bubble
        focusIso = d.iso3  // set before calling setViewMode to skip default-country logic
        setViewMode('country')
        setFocusCountry(d.iso3, d.name)
      })
  }

  // ── View mode toggle ──────────────────────────────────────────
  function setViewMode(mode) {
    viewMode = mode
    vmWorld.classList.toggle('active', mode==='world')
    vmCountry.classList.toggle('active', mode==='country')
    focusCtrl.classList.toggle('hidden', mode==='world')

    if (mode==='world') {
      focusIso = null
      journeyG.selectAll('*').remove()
      clickedIso = null
      drawTop12()
    } else {
      clickedIso = null
      if (focusIso) {
        drawCountryDrilldown(focusIso)
      } else {
        // Pre-select a default country — Pakistan tells the most dramatic story (2022 flood peak)
        const defaultIso = 'PAK'
        const defaultName = (countries.find(c => c[0] === defaultIso) || [,'Pakistan'])[1]
        if (sdrsData.some(d => d.iso3 === defaultIso)) {
          setFocusCountry(defaultIso, defaultName)
          return  // setFocusCountry already calls renderBubbles
        } else {
          ddTitle.textContent    = 'Country Focus'
          ddSubtitle.textContent = 'Search or click a bubble to select a country'
          linesG.selectAll('*').remove()
        }
      }
    }
    renderBubbles(currentYear, false)
  }

  function setFocusCountry(iso, name) {
    focusIso = iso
    countryInp.value = name || (countries.find(c=>c[0]===iso)||[,''])[1]
    drawCountryDrilldown(iso)
    renderBubbles(currentYear, false)
    document.getElementById('bi-selected').style.display = 'block'
    const vel = velocityMap[iso]||0
    document.getElementById('bi-selected').innerHTML =
      `🔍 <strong>${countryInp.value}</strong> — SDRS <strong>${(getDataForYear(sdrsData,currentYear).find(d=>d.iso3===iso)||{sdrs:null}).sdrs?.toFixed(3)||'N/A'}</strong> · velocity <strong>${vel>=0?'+':''}${vel.toFixed(4)}/yr</strong>`
  }

  vmWorld.addEventListener('click', ()=>setViewMode('world'))
  vmCountry.addEventListener('click', ()=>setViewMode('country'))

  // Country search
  countryInp.addEventListener('input', function() {
    const q = countryInp.value.toLowerCase()
    const matches = countries.filter(c=>c[1].toLowerCase().includes(q)).slice(0,10)
    countryDd.innerHTML = ''
    if (!matches.length||!q) { countryDd.classList.add('hidden'); return }
    matches.forEach(c => {
      const item = document.createElement('div')
      item.className='dropdown-item'; item.textContent=c[1]
      item.addEventListener('click',()=>{ countryDd.classList.add('hidden'); setFocusCountry(c[0],c[1]) })
      countryDd.appendChild(item)
    })
    countryDd.classList.remove('hidden')
  })
  document.addEventListener('click',e=>{ if(!countryInp.contains(e.target)&&!countryDd.contains(e.target)) countryDd.classList.add('hidden') })

  scatterSvg.on('click',()=>{
    if (viewMode==='world' && clickedIso) { clickedIso=null; drawTop12(); renderBubbles(currentYear,false) }
  })

  // ── Insights ──────────────────────────────────────────────────
  function updateInsights(year, yearData) {
    const sorted   = [...yearData].sort((a,b)=>b.sdrs-a.sdrs)
    const top1     = sorted[0]
    const inCrisis = yearData.filter(d=>d.gender_penalty>0.4&&d.vulnerability>0.55).length
    const sdrsList = yearData.map(d=>d.sdrs).sort((a,b)=>a-b)
    const gap      = sdrsList[sdrsList.length-1]-sdrsList[0]
    const fyd      = getDataForYear(sdrsData,years[0])
    const fg       = d3.max(fyd,d=>d.sdrs)-d3.min(fyd,d=>d.sdrs)
    const gc       = ((gap-fg)/fg*100).toFixed(1)

    const setCard = (id, bigValue, context) => {
      const card = document.getElementById(id)
      if (!card) return
      const content = card.querySelector('.bi-content')
      if (!content) return
      content.innerHTML = `
        <div class="bi-big">${bigValue}</div>
        <div class="bi-ctx">${context}</div>
      `
    }

    setCard(
      'bi-crisis',
      `<strong>${inCrisis}</strong> <span class="bi-unit">/ ${yearData.length}</span>`,
      `Countries in Compounding Crisis zone in ${year}`
    )
    setCard(
      'bi-top',
      top1 ? `<strong>${top1.name}</strong>` : '—',
      top1 ? `Highest SDRS at <span class="bi-val">${top1.sdrs.toFixed(3)}</span>` : ''
    )
    const changeLabel = +gc > 0 ? '▲ widened' : +gc < 0 ? '▼ narrowed' : '→ unchanged'
    const changeColor = +gc > 0 ? '#C0392B' : +gc < 0 ? '#0D9488' : '#9CA3AF'
    setCard(
      'bi-gap',
      `<strong>${gap.toFixed(3)}</strong>`,
      `Resilience gap — <span style="color:${changeColor};font-weight:600">${changeLabel} ${Math.abs(+gc)}%</span> since ${years[0]}`
    )
  }

  // ── Year control ──────────────────────────────────────────────
  const timeline       = document.querySelector('.bubble-timeline')
  const playIcon       = playBtn.querySelector('.play-icon')
  const pauseIcon      = playBtn.querySelector('.pause-icon')
  const progressRing   = playBtn.querySelector('.play-progress-fg')
  const progressFill   = document.getElementById('timeline-progress-fill')
  const thumbEl        = document.getElementById('timeline-thumb')
  const RING_CIRCUMF   = 100.53  // 2π × 16

  function updateProgress(year) {
    const pct = (year - years[0]) / (years[years.length-1] - years[0])
    // Progress ring on play button
    if (progressRing) progressRing.style.strokeDashoffset = RING_CIRCUMF * (1 - pct)
    // Linear fill — pure percentage, edge to edge
    if (progressFill) progressFill.style.width = (pct * 100) + '%'
    // Custom thumb position — 0% = left edge, 100% = right edge
    if (thumbEl) thumbEl.style.left = (pct * 100) + '%'
  }

  function togglePlayIcons(isPlaying) {
    if (playIcon)  playIcon.style.display  = isPlaying ? 'none' : ''
    if (pauseIcon) pauseIcon.style.display = isPlaying ? '' : 'none'
    if (timeline) timeline.classList.toggle('playing', isPlaying)
  }

  function setYear(year) {
    currentYear = year
    slider.value = year
    yearDisp.textContent = year
    updateProgress(year)
    renderBubbles(year, true)
  }

  function stopPlayback() {
    playing = false
    clearInterval(timer)
    togglePlayIcons(false)
  }

  playBtn.addEventListener('click', () => {
    playing = !playing
    togglePlayIcons(playing)
    if (playing) {
      if (currentYear >= years[years.length-1]) setYear(years[0])
      timer = setInterval(() => {
        const idx = years.indexOf(currentYear)
        if (idx >= years.length-1) {
          stopPlayback()
        } else {
          setYear(years[idx+1])
        }
      }, 800)
    } else {
      clearInterval(timer)
    }
  })

  slider.addEventListener('input', () => {
    stopPlayback()
    setYear(+slider.value)
  })

  // Custom pointer-based slider — works reliably across browsers
  const sliderWrap = document.getElementById('timeline-slider-wrap')
  if (sliderWrap) {
    let isDragging = false

    function yearFromPointer(clientX) {
      const rect = sliderWrap.getBoundingClientRect()
      let pct = (clientX - rect.left) / rect.width
      pct = Math.max(0, Math.min(1, pct))
      const yearIdx = Math.round(pct * (years.length - 1))
      return years[Math.max(0, Math.min(years.length - 1, yearIdx))]
    }

    function onPointerDown(e) {
      isDragging = true
      stopPlayback()
      setYear(yearFromPointer(e.clientX))
      e.preventDefault()
    }
    function onPointerMove(e) {
      if (!isDragging) return
      setYear(yearFromPointer(e.clientX))
    }
    function onPointerUp() { isDragging = false }

    sliderWrap.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  // Initialize progress on first render — force slider to start year
  slider.value = currentYear
  yearDisp.textContent = currentYear
  updateProgress(currentYear)

  // Initial
  drawTop12()
  renderBubbles(currentYear,false)
}
