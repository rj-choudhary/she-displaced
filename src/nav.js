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

// Hash-route map — translates URL hashes to page ids.
// Dashboard is the implicit default (empty hash or unrecognized).
const HASH_ROUTES = {
  '#/methodology': 'methodology',
  '#/explorer':    'explorer',
}

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
    // Only run on dashboard
    const dashboard = document.getElementById('page-dashboard')
    if (!dashboard || !dashboard.classList.contains('active')) return

    const viewH = window.innerHeight
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

  // ── Page switching (internal; called by route handler) ────────
  function applyPage(pageId) {
    pages.forEach(p => {
      p.classList.toggle('active', p.id === `page-${pageId}`)
      p.classList.toggle('hidden', p.id !== `page-${pageId}`)
    })
    if (chapterBar) chapterBar.style.display = pageId === 'dashboard' ? '' : 'none'
    document.querySelectorAll('.nav-util-link').forEach(l => {
      l.classList.toggle('active', l.dataset.page === pageId)
    })
    // Clear chapter indicator when off-dashboard
    if (pageId !== 'dashboard') setActiveChapter(null)
  }

  // ── Hash routing ───────────────────────────────────────────────
  // Map the current URL hash to a page id; falls back to 'dashboard' for
  // empty/unknown hashes or for TOC anchors (#method-*) on the methodology page.
  function pageFromHash() {
    const hash = window.location.hash
    // Section anchors (method-*, section-*) imply staying on the current page
    if (hash.startsWith('#method-')) return 'methodology'
    if (hash.startsWith('#section-') || hash === '#hero' || hash === '') return 'dashboard'
    return HASH_ROUTES[hash] || 'dashboard'
  }

  function navigateToHash() {
    const pageId = pageFromHash()
    const prevPageId = document.querySelector('.page.active')?.id?.replace(/^page-/, '')
    const pageChanged = prevPageId !== pageId

    const hash = window.location.hash
    const isSectionAnchor = hash && hash.startsWith('#') && !HASH_ROUTES[hash]

    // Jump to top BEFORE page swap when we're switching to a different top-of-page
    // route. Doing this before applyPage() means we reset scroll while the old
    // (taller) page is still in the DOM, avoiding layout-shrink scroll clamping.
    // The global `html { scroll-behavior: smooth }` rule would normally animate
    // this — we override with behavior:'instant' so it snaps.
    if (pageChanged && !isSectionAnchor) {
      // Belt + suspenders: API call for modern browsers, direct prop for the rest.
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    applyPage(pageId)

    if (isSectionAnchor) {
      // Section anchor on the (possibly-just-shown) page → smooth scroll to it
      const target = document.getElementById(hash.slice(1))
      if (target) {
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
      }
    } else if (pageChanged) {
      // Second pass after layout — in case the new page's DOM height changed
      // the scroll position again. Still instant, still bypasses smooth CSS.
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      })
    }

    // Refresh chapter detection after route change
    setTimeout(detectCurrentChapter, 50)
  }

  // ── Utility link clicks (Data Explorer / Methodology) ─────────
  document.querySelectorAll('.nav-util-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const page = link.dataset.page
      const newHash = page === 'dashboard' ? '' : `#/${page}`
      if (window.location.hash !== newHash) {
        // Pushing the hash triggers `hashchange`, which calls navigateToHash()
        if (newHash) history.pushState(null, '', newHash)
        else history.pushState(null, '', window.location.pathname + window.location.search)
      }
      navigateToHash()
    })
  })

  // Brand click → dashboard
  const brand = document.querySelector('.nav-brand')
  if (brand) brand.addEventListener('click', e => {
    e.preventDefault()
    if (window.location.hash !== '') {
      history.pushState(null, '', window.location.pathname + window.location.search)
    }
    navigateToHash()
  })

  // Chapter pill clicks — jump to section anchor, staying on dashboard
  document.querySelectorAll('.chapter-pill').forEach(pill => {
    pill.addEventListener('click', e => {
      e.preventDefault()
      const sectionId = pill.getAttribute('href').slice(1)
      const target = document.getElementById(sectionId)
      const dashboard = document.getElementById('page-dashboard')
      const alreadyOnDashboard = dashboard && dashboard.classList.contains('active')
      if (!alreadyOnDashboard) {
        history.pushState(null, '', `#${sectionId}`)
        navigateToHash()
      } else if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Update hash without triggering scroll/popstate weirdness
        history.replaceState(null, '', `#${sectionId}`)
      }
    })
  })

  // Methodology TOC clicks — smooth-scroll inside the methodology page
  document.querySelectorAll('.method-toc-list a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const targetId = link.getAttribute('href').slice(1)
      const target = document.getElementById(targetId)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        history.replaceState(null, '', `#${targetId}`)
      }
    })
  })

  // ── Methodology TOC: highlight active section on scroll ────────
  const tocLinks = Array.from(document.querySelectorAll('.method-toc-list a[data-toc]'))
  const methodSections = tocLinks
    .map(a => document.getElementById(a.dataset.toc))
    .filter(Boolean)

  function detectActiveMethodSection() {
    const methodologyPage = document.getElementById('page-methodology')
    if (!methodologyPage || !methodologyPage.classList.contains('active')) return

    const viewH = window.innerHeight
    let active = methodSections[0]
    for (const sec of methodSections) {
      const rect = sec.getBoundingClientRect()
      if (rect.top < viewH * 0.35) active = sec
    }
    tocLinks.forEach(a => {
      a.classList.toggle('active', a.dataset.toc === (active && active.id))
    })
  }

  // ── Scroll handler ─────────────────────────────────────────────
  window.addEventListener('scroll', () => {
    nav.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,0.35)' : 'none'
    detectCurrentChapter()
    detectActiveMethodSection()
  }, { passive: true })

  // Hash change (back/forward button, TOC clicks, manual URL edits)
  window.addEventListener('hashchange', navigateToHash)
  window.addEventListener('popstate', navigateToHash)

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
  navigateToHash() // Apply the URL hash on first load
  detectCurrentChapter()
  setTimeout(() => {
    detectCurrentChapter()
    detectActiveMethodSection()
  }, 300)

  window.addEventListener('resize', () => {
    detectCurrentChapter()
    detectActiveMethodSection()
  }, { passive: true })
}
