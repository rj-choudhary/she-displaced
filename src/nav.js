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
    const navH = 70 // nav height + buffer
    const viewH = window.innerHeight

    // Walk chapters in reverse — last one that has entered the viewport wins
    let current = CHAPTERS[0].id
    for (const ch of CHAPTERS) {
      const el = document.getElementById(ch.id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      // Section top is above 60% of viewport
      if (rect.top < viewH * 0.6) {
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
      showPage('dashboard')
      const target = document.querySelector(pill.getAttribute('href'))
      if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
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

  // Set initial active chapter — try multiple times to handle layout timing
  setActiveChapter('section-map')
  setTimeout(() => {
    setActiveChapter('section-map')
    detectCurrentChapter()
  }, 300)

  // Re-position on resize
  window.addEventListener('resize', () => {
    detectCurrentChapter()
  }, { passive: true })
}
