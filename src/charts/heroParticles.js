/**
 * Hero World-Dot Animation
 * Loads pre-computed dot positions from /hero-dots.json (generated offline).
 * Each dot has normalized [x, y, risk] where risk: 0=low, 1=moderate, 2=high.
 * No geo computation at runtime — instant render.
 */

const RISK_CONFIG = [
  // risk 0: low
  { color: [255, 255, 255], baseAlpha: [0.08, 0.15], radius: 1.2, pulseAmp: 0.12, pulseSpeed: [0.008, 0.016] },
  // risk 1: moderate (teal)
  { color: [42, 173, 173],  baseAlpha: [0.3, 0.55],  radius: 1.8, pulseAmp: 0.12, pulseSpeed: [0.008, 0.016] },
  // risk 2: high (coral)
  { color: [232, 97, 74],   baseAlpha: [0.6, 0.9],   radius: 2.2, pulseAmp: 0.25, pulseSpeed: [0.02, 0.035] },
]

export async function initHeroParticles() {
  const container = document.getElementById('hero-particles')
  if (!container) return

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  container.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1

  let displayW = container.offsetWidth
  let displayH = container.offsetHeight

  function resize() {
    displayW = container.offsetWidth
    displayH = container.offsetHeight
    canvas.width = displayW * dpr
    canvas.height = displayH * dpr
    canvas.style.width = displayW + 'px'
    canvas.style.height = displayH + 'px'
  }
  resize()

  // Load pre-computed dots
  let rawDots
  try {
    const resp = await fetch('/hero-dots.json')
    rawDots = await resp.json()
  } catch (e) {
    return // silently fail — hero still looks fine without particles
  }

  // Build dot objects from compact [nx, ny, risk] arrays
  const dots = rawDots.map(([nx, ny, risk]) => {
    const cfg = RISK_CONFIG[risk]
    const baseAlpha = cfg.baseAlpha[0] + Math.random() * (cfg.baseAlpha[1] - cfg.baseAlpha[0])
    return {
      nx, ny, // normalized 0-1 coordinates
      risk,
      color: cfg.color,
      baseAlpha,
      alpha: baseAlpha,
      radius: cfg.radius,
      phase: Math.random() * Math.PI * 2,
      pulseSpeed: cfg.pulseSpeed[0] + Math.random() * (cfg.pulseSpeed[1] - cfg.pulseSpeed[0]),
      pulseAmp: cfg.pulseAmp,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.1,
      ox: 0, oy: 0,
    }
  })

  let animId = null

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, displayW, displayH)

    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i]

      // Pulse
      dot.phase += dot.pulseSpeed
      dot.alpha = dot.baseAlpha + Math.sin(dot.phase) * dot.pulseAmp

      // Drift
      dot.ox += dot.vx
      dot.oy += dot.vy
      if (Math.abs(dot.ox) > 3) dot.vx *= -1
      if (Math.abs(dot.oy) > 3) dot.vy *= -1

      // Scale normalized coords to current viewport
      const x = dot.nx * displayW + dot.ox
      const y = dot.ny * displayH + dot.oy

      ctx.beginPath()
      ctx.arc(x, y, dot.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${dot.color[0]},${dot.color[1]},${dot.color[2]},${Math.max(0, dot.alpha)})`
      ctx.fill()

      // Glow for high-risk
      if (dot.risk === 2 && dot.alpha > 0.7) {
        ctx.beginPath()
        ctx.arc(x, y, dot.radius * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${dot.color[0]},${dot.color[1]},${dot.color[2]},${(dot.alpha - 0.7) * 0.3})`
        ctx.fill()
      }
    }

    animId = requestAnimationFrame(draw)
  }

  // Start immediately
  draw()

  // Pause when hero scrolls out of view
  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) {
      cancelAnimationFrame(animId)
      animId = null
    } else if (!animId) {
      draw()
    }
  }, { threshold: 0.1 })
  observer.observe(document.getElementById('hero'))

  window.addEventListener('resize', () => {
    resize()
  })
}
