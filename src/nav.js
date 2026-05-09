// ── Chapter map ───────────────────────────────────────────────
const CHAPTERS = [
  { id: 'section-map',      num: '01', name: 'Global Pulse' },
  { id: 'section-gender',   num: '02', name: 'The Penalty'  },
  { id: 'section-radar',    num: '03', name: 'Diagnosis'    },
  { id: 'section-disaster', num: '04', name: 'Triggers'     },
  { id: 'section-bubble',   num: '05', name: 'Momentum'     },
  { id: 'section-lab',      num: '06', name: 'The Lab'      },
  { id: 'section-hope',     num: '07', name: 'Hope'         },
]

export function initNav() {
  const nav        = document.getElementById('top-nav')
  const chapterBar = document.getElementById('chapter-bar')
  const mobileNum  = document.getElementById('chapter-mobile-num')
  const mobileName = document.getElementById('chapter-mobile-name')
  const pages      = document.querySelectorAll('.page')

  // ── Sliding indicator ─────────────────────────────────────────
  const indicator = document.createElement('div')
  indicator.id = 'chapter-indicator'
  if (chapterBar) chapterBar.appendChild(indicator)

  function moveIndicator(pill) {
    if (!pill || !indicator) return
    indicator.style.width   = pill.offsetWidth + 'px'
    indicator.style.left    = pill.offsetLeft + 'px'
    indicator.style.opacity = '1'
  }

  // ── Set active chapter ────────────────────────────────────────
  let activeChapterId = null

  function setActiveChapter(chapterId) {
    // chapterId === null ⇒ deactivate all (user is in hero or above section 1)
    if (chapterId === null) {
      if (activeChapterId === null) return
      activeChapterId = null
      document.querySelectorAll('.chapter-pill').forEach(pill => pill.classList.remove('active'))
      if (indicator) indicator.style.opacity = '0'
      if (mobileNum)  mobileNum.textContent  = ''
      if (mobileName) mobileName.textContent = ''
      return
    }

    const chapter = CHAPTERS.find(c => c.id === chapterId)
    if (!chapter) return
    if (activeChapterId === chapterId) {
      // Still re-move indicator in case layout changed
      const activePill = document.querySelector('.chapter-pill.active')
      if (activePill) moveIndicator(activePill)
      return
    }
    activeChapterId = chapterId

    let activePill = null
    document.querySelectorAll('.chapter-pill').forEach(pill => {
      const isActive = pill.dataset.chapter === chapter.num
      pill.classList.toggle('active', isActive)
      if (isActive) activePill = pill
    })

    if (activePill) moveIndicator(activePill)
    if (mobileNum)  mobileNum.textContent  = chapter.num
    if (mobileName) mobileName.textContent = chapter.name
  }

  // ── Detect which chapter is currently in view ─────────────────
  function detectCurrentChapter() {
    const viewH = window.innerHeight

    // Walk chapters in order — last one whose top has crossed 40% of viewport wins.
    // If none qualifies (e.g. user is in hero), leave current = null to clear the nav.
    let current = null
    for (const ch of CHAPTERS) {
      const el = document.getElementById(ch.id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (rect.top < viewH * 0.4) {
        current = ch.id
      }
    }
    setActiveChapter(current)
  }

  // ── Page switching ────────────────────────────────────────────
  function showPage(pageId) {
    pages.forEach(p => {
      p.classList.toggle('active', p.id === `page-${pageId}`)
      p.classList.toggle('hidden', p.id !== `page-${pageId}`)
    })
    if (chapterBar) chapterBar.style.display = pageId === 'dashboard' ? '' : 'none'
    document.querySelectorAll('.nav-util-link').forEach(l => {
      l.classList.toggle('active', l.dataset.page === pageId)
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  document.querySelectorAll('.nav-util-link').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); showPage(link.dataset.page) })
  })

  const brand = document.querySelector('.nav-brand')
  if (brand) brand.addEventListener('click', e => { e.preventDefault(); showPage('dashboard') })

  document.querySelectorAll('.chapter-pill').forEach(pill => {
    pill.addEventListener('click', e => {
      e.preventDefault()
      const target = document.querySelector(pill.getAttribute('href'))
      // Only page-switch if we're not already on the dashboard — avoids a
      // redundant scroll-to-top flash before scrolling to the chapter.
      const dashboard = document.getElementById('page-dashboard')
      const alreadyOnDashboard = dashboard && dashboard.classList.contains('active')
      if (alreadyOnDashboard) {
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        showPage('dashboard')
        // Wait for page switch to settle, then scroll straight to target
        if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      }
    })
  })

  // ── Scroll: detect chapter + nav shadow ───────────────────────
  window.addEventListener('scroll', () => {
    // Nav shadow
    nav.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,0.35)' : 'none'
    // Chapter detection on every scroll
    detectCurrentChapter()
  }, { passive: true })

  // ── Scroll animations: section fade-in ───────────────────────
  const animObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view')
        animObserver.unobserve(entry.target)
      }
    })
  }, { threshold: 0.08, rootMargin: '-40px 0px' })

  document.querySelectorAll('.viz-section, .narrative-section').forEach(el => {
    animObserver.observe(el)
  })

  // ── Init ──────────────────────────────────────────────────────
  showPage('dashboard')

  // Detect current chapter — no explicit pre-selection so hero stays clean.
  // Run a couple of times to handle layout timing (fonts, images, hero height).
  detectCurrentChapter()
  setTimeout(detectCurrentChapter, 300)

  // Re-position on resize
  window.addEventListener('resize', () => {
    detectCurrentChapter()
  }, { passive: true })
}
