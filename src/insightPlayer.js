// ============================================================
// Insight Podcast — floating audio player
// Single shared <audio> element controlled by both the hero
// invite button and the bottom-right floating card.
// ============================================================

const STORAGE_KEY = 'she-displaced:podcast-dismissed'

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function initInsightPlayer() {
  const audio     = document.getElementById('insight-audio')
  const player    = document.getElementById('insight-player')
  const playBtn   = document.getElementById('ip-play-btn')
  const heroBtn   = document.getElementById('hero-audio-btn')
  const closeBtn  = document.getElementById('ip-close')
  const slider    = document.getElementById('ip-slider')
  const curEl     = document.getElementById('ip-time-cur')
  const totalEl   = document.getElementById('ip-time-total')

  if (!audio || !player || !playBtn || !heroBtn) return

  // If user previously dismissed it this session, keep the card hidden.
  // Hero button still works.
  if (sessionStorage.getItem(STORAGE_KEY) === '1') {
    player.classList.add('is-hidden')
  } else {
    // Slight entrance delay so it doesn't collide with the initial loader fade.
    setTimeout(() => player.classList.add('is-visible'), 900)
  }

  // ── Play / pause toggle (shared) ────────────────────────────
  function togglePlay() {
    if (audio.paused) {
      audio.play().catch(err => {
        // Autoplay policy or missing file — surface silently in dev
        if (import.meta.env && import.meta.env.DEV) {
          console.warn('[insightPlayer] play rejected:', err)
        }
      })
    } else {
      audio.pause()
    }
  }

  playBtn.addEventListener('click', togglePlay)
  heroBtn.addEventListener('click', togglePlay)

  // ── Play-state UI sync ──────────────────────────────────────
  function syncPlayState() {
    const playing = !audio.paused && !audio.ended
    player.classList.toggle('is-playing', playing)
    playBtn.classList.toggle('is-playing', playing)
    heroBtn.classList.toggle('is-playing', playing)
    playBtn.setAttribute('aria-label', playing ? 'Pause podcast' : 'Start the podcast')
    heroBtn.setAttribute('aria-label', playing ? 'Pause podcast' : 'Start the podcast')

    const heroLabel = heroBtn.querySelector('.hero-audio-label')
    if (heroLabel) {
      heroLabel.textContent = playing ? 'Pause podcast' : 'Start the podcast · 5 min'
    }

    // If the hero triggered play, ensure the floating card is visible.
    if (playing && player.classList.contains('is-hidden')) {
      player.classList.remove('is-hidden')
      player.classList.add('is-visible')
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }

  audio.addEventListener('play',  syncPlayState)
  audio.addEventListener('pause', syncPlayState)
  audio.addEventListener('ended', () => {
    audio.currentTime = 0
    syncPlayState()
    updateProgress()
  })

  // ── Time + slider sync ──────────────────────────────────────
  let isSeeking = false

  function updateDuration() {
    if (isFinite(audio.duration) && audio.duration > 0) {
      totalEl.textContent = fmtTime(audio.duration)
    }
  }

  function updateProgress() {
    if (isSeeking) return
    if (!isFinite(audio.duration) || audio.duration === 0) return
    const pct = (audio.currentTime / audio.duration) * 100
    slider.value = pct
    curEl.textContent = fmtTime(audio.currentTime)
    // Progressive coral fill for the slider track
    slider.style.setProperty('--ip-progress', pct + '%')
  }

  audio.addEventListener('loadedmetadata', updateDuration)
  audio.addEventListener('durationchange', updateDuration)
  audio.addEventListener('timeupdate',     updateProgress)

  // If metadata was cached and already available, populate immediately.
  if (audio.readyState >= 1) updateDuration()

  // ── Scrubbing ───────────────────────────────────────────────
  slider.addEventListener('input', () => {
    isSeeking = true
    const pct = parseFloat(slider.value)
    slider.style.setProperty('--ip-progress', pct + '%')
    if (isFinite(audio.duration)) {
      curEl.textContent = fmtTime(audio.duration * (pct / 100))
    }
  })

  slider.addEventListener('change', () => {
    if (isFinite(audio.duration)) {
      audio.currentTime = audio.duration * (parseFloat(slider.value) / 100)
    }
    isSeeking = false
  })

  // Also release scrub state on mouseup/touchend in case 'change' fires late
  ;['mouseup', 'touchend', 'blur'].forEach(evt => {
    slider.addEventListener(evt, () => { isSeeking = false })
  })

  // ── Close button ────────────────────────────────────────────
  closeBtn.addEventListener('click', () => {
    // Stop playback when the user dismisses the floating card.
    // If they want to resume, the hero button will bring the card back.
    if (!audio.paused) audio.pause()
    audio.currentTime = 0
    player.classList.remove('is-visible')
    player.classList.add('is-hidden')
    sessionStorage.setItem(STORAGE_KEY, '1')
  })
}
