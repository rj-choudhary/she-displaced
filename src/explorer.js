// Data Explorer — table with filters, sorting, pagination, export

const DATASETS = {
  sdrs: {
    label: 'SDRS Index',
    columns: [
      { key: 'iso3',          label: 'ISO3',        type: 'text' },
      { key: 'name',          label: 'Country',     type: 'text' },
      { key: 'year',          label: 'Year',        type: 'num' },
      { key: 'region',        label: 'Region',      type: 'text' },
      { key: 'sdrs',          label: 'SDRS',        type: 'score', color: true },
      { key: 'vulnerability', label: 'Vulnerability', type: 'score', color: true },
      { key: 'readiness',     label: 'Readiness',   type: 'score' },
      { key: 'gender_gap',          label: 'Gender Gap',       type: 'score' },
      { key: 'climate_hazard',      label: 'Climate Hazard',   type: 'score', color: true },
      { key: 'adaptive_gap',        label: 'Adaptive Gap',     type: 'score', color: true },
      { key: 'gender_penalty',      label: 'Gender Penalty',   type: 'score', color: true },
      { key: 'n_vulnerability',     label: 'n_Climate',        type: 'score', color: true },
      { key: 'n_adaptive_gap',      label: 'n_Adaptive',       type: 'score', color: true },
      { key: 'n_gender_penalty',    label: 'n_Gender',         type: 'score', color: true },
      { key: 'n_disaster_burden',   label: 'n_Disaster',       type: 'score', color: true },
      { key: 'total_deaths',        label: 'Deaths',           type: 'num' },
      { key: 'total_affected',      label: 'Affected',         type: 'num' },
      { key: 'disaster_count',      label: 'Disasters',        type: 'num' },
    ]
  },
  vulnerability: {
    label: 'Climate Vulnerability',
    columns: [
      { key: 'iso3',              label: 'ISO3',        type: 'text' },
      { key: 'name',              label: 'Country',     type: 'text' },
      { key: 'year',              label: 'Year',        type: 'num' },
      { key: 'region',            label: 'Region',      type: 'text' },
      { key: 'vulnerability',     label: 'Overall',     type: 'score', color: true },
      { key: 'vuln_exposure',     label: 'Exposure',    type: 'score', color: true },
      { key: 'vuln_food',         label: 'Food',        type: 'score', color: true },
      { key: 'vuln_water',        label: 'Water',       type: 'score', color: true },
      { key: 'vuln_health',       label: 'Health',      type: 'score', color: true },
      { key: 'vuln_habitat',      label: 'Habitat',     type: 'score', color: true },
      { key: 'ready_economic',    label: 'Econ Ready',  type: 'score' },
      { key: 'ready_governance',  label: 'Gov Ready',   type: 'score' },
      { key: 'ready_social',      label: 'Social Ready', type: 'score' },
    ]
  },
  gender: {
    label: 'Gender Gap Index',
    columns: [
      { key: 'iso3',                   label: 'ISO3',        type: 'text' },
      { key: 'name',                   label: 'Country',     type: 'text' },
      { key: 'year',                   label: 'Year',        type: 'num' },
      { key: 'region',                 label: 'Region',      type: 'text' },
      { key: 'gender_gap',             label: 'Overall',     type: 'score' },
      { key: 'econ_participation',     label: 'Economic',    type: 'score' },
      { key: 'political_empowerment',  label: 'Political',   type: 'score' },
      { key: 'educational_attainment', label: 'Education',   type: 'score' },
      { key: 'health_survival',        label: 'Health',      type: 'score' },
      { key: 'gender_penalty',         label: 'Penalty',     type: 'score', color: true },
    ]
  }
}

const PAGE_SIZE = 50

let state = {
  dataset:   'sdrs',
  data:      [],
  filtered:  [],
  sortKey:   'sdrs',
  sortDir:   'desc',
  page:      1,
  search:    '',
  region:    '',
  year:      '',
  sdrsMin:   '',
  sdrsMax:   '',
}

export function initExplorer(allData) {
  state.data = allData

  // Populate year dropdown
  const years = [...new Set(allData.map(d => d.year))].sort()
  const yearSel = document.getElementById('explorer-year')
  years.forEach(y => {
    const opt = document.createElement('option')
    opt.value = y
    opt.textContent = y
    yearSel.appendChild(opt)
  })

  // Dataset buttons
  document.querySelectorAll('.dataset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dataset-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      state.dataset = btn.dataset.dataset
      state.sortKey = state.dataset === 'sdrs' ? 'sdrs' : 'vulnerability'
      state.page = 1
      renderTable()
    })
  })

  // Filters
  document.getElementById('explorer-search').addEventListener('input', e => {
    state.search = e.target.value.toLowerCase()
    state.page = 1
    renderTable()
  })
  document.getElementById('explorer-region').addEventListener('change', e => {
    state.region = e.target.value
    state.page = 1
    renderTable()
  })
  document.getElementById('explorer-year').addEventListener('change', e => {
    state.year = e.target.value
    state.page = 1
    renderTable()
  })
  document.getElementById('explorer-sdrs-min').addEventListener('input', e => {
    state.sdrsMin = e.target.value
    state.page = 1
    renderTable()
  })
  document.getElementById('explorer-sdrs-max').addEventListener('input', e => {
    state.sdrsMax = e.target.value
    state.page = 1
    renderTable()
  })

  // Reset
  document.getElementById('explorer-reset').addEventListener('click', () => {
    state.search = ''; state.region = ''; state.year = ''
    state.sdrsMin = ''; state.sdrsMax = ''
    state.page = 1
    document.getElementById('explorer-search').value = ''
    document.getElementById('explorer-region').value = ''
    document.getElementById('explorer-year').value = ''
    document.getElementById('explorer-sdrs-min').value = ''
    document.getElementById('explorer-sdrs-max').value = ''
    renderTable()
  })

  // Export
  document.getElementById('explorer-export').addEventListener('click', exportCSV)

  // Pagination
  document.getElementById('page-prev').addEventListener('click', () => {
    if (state.page > 1) { state.page--; renderTable() }
  })
  document.getElementById('page-next').addEventListener('click', () => {
    const totalPages = Math.ceil(state.filtered.length / PAGE_SIZE)
    if (state.page < totalPages) { state.page++; renderTable() }
  })

  renderTable()
}

function applyFilters() {
  const ds = DATASETS[state.dataset]
  let rows = state.data.filter(d => {
    // Only rows that have the key columns for this dataset
    const firstScore = ds.columns.find(c => c.type === 'score')
    if (firstScore && d[firstScore.key] == null) return false
    return true
  })

  if (state.search) {
    rows = rows.filter(d =>
      (d.name || '').toLowerCase().includes(state.search) ||
      (d.iso3 || '').toLowerCase().includes(state.search)
    )
  }
  if (state.region) rows = rows.filter(d => d.region === state.region)
  if (state.year)   rows = rows.filter(d => String(d.year) === state.year)
  if (state.sdrsMin !== '') rows = rows.filter(d => d.sdrs >= +state.sdrsMin)
  if (state.sdrsMax !== '') rows = rows.filter(d => d.sdrs <= +state.sdrsMax)

  // Sort
  rows.sort((a, b) => {
    const av = a[state.sortKey]
    const bv = b[state.sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return state.sortDir === 'asc' ? cmp : -cmp
  })

  return rows
}

function renderTable() {
  const ds = DATASETS[state.dataset]
  state.filtered = applyFilters()

  // Sidebar meta
  const countries = new Set(state.filtered.map(d => d.iso3)).size
  const years = [...new Set(state.filtered.map(d => d.year))].sort()
  document.getElementById('meta-count').textContent = state.filtered.length.toLocaleString()
  document.getElementById('meta-countries').textContent = countries
  document.getElementById('meta-years').textContent = years.length > 0
    ? `${years[0]}–${years[years.length - 1]}`
    : '—'

  // Count label
  document.getElementById('explorer-count-label').textContent =
    `${state.filtered.length.toLocaleString()} rows`

  // Header
  const thead = document.getElementById('explorer-thead')
  thead.innerHTML = ''
  const tr = document.createElement('tr')
  ds.columns.forEach(col => {
    const th = document.createElement('th')
    th.textContent = col.label
    th.dataset.key = col.key
    if (state.sortKey === col.key) {
      th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc')
    }
    th.addEventListener('click', () => {
      if (state.sortKey === col.key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'
      } else {
        state.sortKey = col.key
        state.sortDir = col.type === 'text' ? 'asc' : 'desc'
      }
      state.page = 1
      renderTable()
    })
    tr.appendChild(th)
  })
  thead.appendChild(tr)

  // Body
  const tbody = document.getElementById('explorer-tbody')
  tbody.innerHTML = ''

  const start = (state.page - 1) * PAGE_SIZE
  const pageRows = state.filtered.slice(start, start + PAGE_SIZE)

  pageRows.forEach(row => {
    const tr = document.createElement('tr')
    ds.columns.forEach(col => {
      const td = document.createElement('td')
      const val = row[col.key]

      if (col.type === 'score' && val != null) {
        const pct = Math.round(val * 100)
        const colorClass = col.color
          ? (val > 0.55 ? 'td-high' : val > 0.35 ? 'td-mid' : 'td-low')
          : ''
        td.className = `td-bar-cell ${colorClass}`
        td.innerHTML = `
          <div class="td-bar-wrap">
            <span class="${colorClass}" style="min-width:38px;font-weight:600;font-size:12px">${val.toFixed(3)}</span>
            <div class="td-bar-bg">
              <div class="td-bar-fill" style="width:${pct}%;background:${col.color ? scoreColor(val) : '#9CA3AF'}"></div>
            </div>
          </div>`
      } else if (col.type === 'num' && val != null) {
        td.textContent = val > 0 ? val.toLocaleString() : '—'
        td.style.color = '#6B7280'
      } else {
        td.textContent = val != null ? val : '—'
        if (col.key === 'iso3') {
          td.style.cssText = 'font-family:monospace;font-size:12px;color:#9CA3AF;font-weight:600'
        }
      }
      tr.appendChild(td)
    })
    tbody.appendChild(tr)
  })

  // Pagination
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE))
  document.getElementById('page-info').textContent = `Page ${state.page} of ${totalPages}`
  document.getElementById('page-prev').disabled = state.page <= 1
  document.getElementById('page-next').disabled = state.page >= totalPages
}

function scoreColor(val) {
  if (val > 0.6) return '#E8614A'
  if (val > 0.45) return '#E8A84A'
  if (val > 0.3) return '#2AADAD'
  return '#1A7A7A'
}

function exportCSV() {
  const ds = DATASETS[state.dataset]
  const rows = state.filtered
  const headers = ds.columns.map(c => c.label)
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      ds.columns.map(col => {
        const v = row[col.key]
        if (v == null) return ''
        if (typeof v === 'string' && v.includes(',')) return `"${v}"`
        return v
      }).join(',')
    )
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `she-displaced-${state.dataset}-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
