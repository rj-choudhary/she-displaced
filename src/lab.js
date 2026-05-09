// ── Innovation Lab — Live SDRS Weight Sandbox ─────────────────

const PRESETS = {
  default:  { w_v: 0.30, w_r: 0.20, w_g: 0.35, w_d: 0.15, label: 'Default',         desc: 'Gender-forward · The thesis of this index' },
  equal:    { w_v: 0.25, w_r: 0.25, w_g: 0.25, w_d: 0.25, label: 'Equal',            desc: 'Agnostic baseline — all dimensions equal' },
  climate:  { w_v: 0.40, w_r: 0.25, w_g: 0.20, w_d: 0.15, label: 'Climate-forward',  desc: 'For climate-policy readers — physical risk first' },
  gender:   { w_v: 0.20, w_r: 0.15, w_g: 0.50, w_d: 0.15, label: 'Gender-strong',    desc: 'Gender gap dominates — maximum social lens' },
  disaster: { w_v: 0.20, w_r: 0.20, w_g: 0.20, w_d: 0.40, label: 'Disaster-forward', desc: 'Acute events dominate — realized impact first' },
}

const SLIDER_KEYS = ['climate', 'adaptive', 'gender', 'disaster']
const WEIGHT_KEYS = ['w_v', 'w_r', 'w_g', 'w_d']  // maps to slider order

const REGION_COLORS = {
  'Sub-Saharan Africa':        '#E8614A',
  'South Asia':                '#E8A84A',
  'MENA':                      '#C0392B',
  'East Asia & Pacific':       '#2AADAD',
  'Latin America & Caribbean': '#8B5CF6',
  'Europe':                    '#1A7A7A',
  'North America':             '#059669',
  'Central Asia':              '#F59E0B',
}

export function initLab(data) {
  // ── Filter to 2025 rows with all 4 normalized components ──────
  const year2025 = data.filter(d =>
    d.year === 2025 &&
    d.n_vulnerability != null &&
    d.n_adaptive_gap  != null &&
    d.n_gender_penalty != null &&
    d.n_disaster_burden != null
  )

  if (!year2025.length) {
    if (import.meta.env.DEV) console.warn('[lab] No 2025 data with normalized components')
    return
  }

  // Pre-compute default ranking for rank-shift display
  const defaultWeights = { ...PRESETS.default }
  const defaultScored  = scoreAndRank(year2025, defaultWeights)
  const defaultRankMap = {}
  const defaultScoreMap = {}
  defaultScored.forEach((d, i) => {
    defaultRankMap[d.iso3]  = i + 1
    defaultScoreMap[d.iso3] = d._score
  })

  // Current weights state
  let weights = { ...PRESETS.default }
  let spotlightIso = null

  // ── DOM refs ──────────────────────────────────────────────────
  const sliders     = {}
  const valLabels   = {}
  SLIDER_KEYS.forEach((k, i) => {
    sliders[k]   = document.getElementById(`weight-${k}`)
    valLabels[k] = document.getElementById(`weight-${k}-val`)
  })
  const sumBadge    = document.getElementById('lab-sum-badge')
  const presetDesc  = document.getElementById('lab-preset-desc')
  const leaderboard = document.getElementById('lab-leaderboard')
  const countryInp  = document.getElementById('lab-country-input')
  const countryDd   = document.getElementById('lab-country-dropdown')
  const spotResult  = document.getElementById('lab-spotlight-result')

  // ── Rescore function ──────────────────────────────────────────
  function scoreAndRank(rows, w) {
    return rows
      .map(d => ({
        ...d,
        _score: w.w_v * d.n_vulnerability
               + w.w_r * d.n_adaptive_gap
               + w.w_g * d.n_gender_penalty
               + w.w_d * d.n_disaster_burden
      }))
      .sort((a, b) => b._score - a._score)
  }

  // ── Render leaderboard ────────────────────────────────────────
  // Component palette — must match the slider accents visually.
  // w_v → climate (teal), w_r → adaptive gap (amber), w_g → gender (purple), w_d → disaster (coral)
  const COMPONENT_META = [
    { wk: 'w_v', nk: 'n_vulnerability',     color: '#2AADAD', label: 'Climate' },
    { wk: 'w_r', nk: 'n_adaptive_gap',      color: '#F59E0B', label: 'Adaptive gap' },
    { wk: 'w_g', nk: 'n_gender_penalty',    color: '#9b59b6', label: 'Gender' },
    { wk: 'w_d', nk: 'n_disaster_burden',   color: '#E8614A', label: 'Disaster' },
  ]

  function renderLeaderboard() {
    if (!leaderboard) return
    const ranked = scoreAndRank(year2025, weights)
    const top10  = ranked.slice(0, 10)

    const maxScore = top10[0]._score

    leaderboard.innerHTML = ''
    top10.forEach((d, i) => {
      const rank        = i + 1
      const defaultRank = defaultRankMap[d.iso3] || '—'
      const shift       = defaultRank !== '—' ? defaultRank - rank : 0
      const shiftText   = shift > 0 ? `▲${shift}` : shift < 0 ? `▼${Math.abs(shift)}` : '—'
      const shiftClass  = shift > 0 ? 'shift-up' : shift < 0 ? 'shift-down' : 'shift-none'
      const barPct      = Math.round((d._score / maxScore) * 100)
      const isSpotlight = d.iso3 === spotlightIso

      // Per-component contribution to THIS country's score.
      // share = (w × n) / score  →  sums to 1 across the 4 components.
      const segments = COMPONENT_META.map(c => {
        const contrib = weights[c.wk] * d[c.nk]
        const share   = d._score > 0 ? contrib / d._score : 0
        return { ...c, share, pct: share * 100 }
      })
      const tooltipText = segments
        .map(s => `${s.label}: ${(s.pct).toFixed(0)}%`)
        .join(' · ')

      const row = document.createElement('div')
      row.className = `lab-board-row${isSpotlight ? ' spotlight' : ''}`
      row.innerHTML = `
        <span class="lbr-rank">${rank}</span>
        <span class="lbr-name">${d.name.length > 18 ? d.name.slice(0,16)+'…' : d.name}</span>
        <div class="lbr-bar-wrap" title="${tooltipText}">
          <div class="lbr-bar-inner" style="width:${barPct}%">
            ${segments.map(s => `<span class="lbr-seg" style="width:${s.pct.toFixed(2)}%;background:${s.color}"></span>`).join('')}
          </div>
        </div>
        <span class="lbr-score">${d._score.toFixed(3)}</span>
        <span class="lbr-shift ${shiftClass}">${shiftText}</span>
      `
      leaderboard.appendChild(row)
    })

    // Update spotlight if active
    if (spotlightIso) {
      const spotIdx = ranked.findIndex(d => d.iso3 === spotlightIso)
      const spotRow = ranked[spotIdx]
      if (spotRow) {
        document.getElementById('lsr-current-rank').textContent  = spotIdx + 1
        document.getElementById('lsr-current-score').textContent = spotRow._score.toFixed(3)
      }
    }
  }

  // ── Slider logic with proportional constraint ─────────────────
  function onSliderChange(changedKey) {
    const newVal = parseFloat(sliders[changedKey].value)
    const wkMap  = { climate:'w_v', adaptive:'w_r', gender:'w_g', disaster:'w_d' }
    const changedWk = wkMap[changedKey]

    const oldVal  = weights[changedWk]
    const delta   = newVal - oldVal
    const others  = SLIDER_KEYS.filter(k => k !== changedKey)
    const otherSum = others.reduce((s, k) => s + weights[wkMap[k]], 0)

    if (Math.abs(delta) < 0.001) return

    // Proportional redistribution
    if (otherSum > 0.001) {
      others.forEach(k => {
        const wk = wkMap[k]
        const share = weights[wk] / otherSum
        weights[wk] = Math.max(0, weights[wk] - delta * share)
      })
    }
    weights[changedWk] = newVal

    // Clamp and renormalize to exactly 1.0
    const total = Object.values(weights).reduce((s, v) => s + v, 0)
    if (Math.abs(total - 1.0) > 0.001) {
      Object.keys(weights).forEach(k => { weights[k] = weights[k] / total })
    }

    updateSliderUI()
    deactivatePresets()
    renderLeaderboard()
  }

  function updateSliderUI() {
    const wkMap = { climate:'w_v', adaptive:'w_r', gender:'w_g', disaster:'w_d' }
    SLIDER_KEYS.forEach(k => {
      const v = weights[wkMap[k]]
      sliders[k].value    = v.toFixed(3)
      valLabels[k].textContent = v.toFixed(2)
    })
    const sum = Object.values(weights).reduce((s, v) => s + v, 0)
    if (sumBadge) {
      sumBadge.textContent = `= ${sum.toFixed(2)}`
      sumBadge.style.color = Math.abs(sum - 1.0) < 0.01 ? '#0D9488' : '#E8614A'
    }
  }

  // Attach slider events
  SLIDER_KEYS.forEach(k => {
    if (sliders[k]) sliders[k].addEventListener('input', () => onSliderChange(k))
  })

  // ── Presets ───────────────────────────────────────────────────
  function applyPreset(key) {
    const p = PRESETS[key]
    weights = { w_v: p.w_v, w_r: p.w_r, w_g: p.w_g, w_d: p.w_d }
    updateSliderUI()
    if (presetDesc) presetDesc.textContent = p.desc
    document.querySelectorAll('.lab-preset').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === key)
    })
    renderLeaderboard()
  }

  function deactivatePresets() {
    document.querySelectorAll('.lab-preset').forEach(btn => btn.classList.remove('active'))
    if (presetDesc) presetDesc.textContent = 'Custom weighting'
  }

  document.querySelectorAll('.lab-preset').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset))
  })

  // ── Country spotlight search ──────────────────────────────────
  const countries = [...new Map(
    year2025.filter(d => d.name).map(d => [d.iso3, d.name])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]))

  if (countryInp) {
    countryInp.addEventListener('input', function() {
      const q = countryInp.value.toLowerCase()
      const matches = countries.filter(c => c[1].toLowerCase().includes(q)).slice(0, 8)
      countryDd.innerHTML = ''
      if (!matches.length || !q) { countryDd.classList.add('hidden'); return }
      matches.forEach(c => {
        const item = document.createElement('div')
        item.className = 'dropdown-item'
        item.textContent = c[1]
        item.addEventListener('click', () => {
          countryInp.value = c[1]
          countryDd.classList.add('hidden')
          setSpotlight(c[0], c[1])
        })
        countryDd.appendChild(item)
      })
      countryDd.classList.remove('hidden')
    })

    document.addEventListener('click', e => {
      if (!countryInp.contains(e.target) && !countryDd.contains(e.target))
        countryDd.classList.add('hidden')
    })
  }

  function setSpotlight(iso, name) {
    spotlightIso = iso
    const defRank  = defaultRankMap[iso]  || '—'
    const defScore = defaultScoreMap[iso] != null ? defaultScoreMap[iso].toFixed(3) : '—'

    document.getElementById('lsr-name').textContent          = name
    document.getElementById('lsr-default-rank').textContent  = defRank
    document.getElementById('lsr-default-score').textContent = defScore

    if (spotResult) spotResult.classList.remove('hidden')
    renderLeaderboard()
  }

  // ── Initial render ────────────────────────────────────────────
  applyPreset('default')
}
