export function initHeroParticles() {
  const container = document.getElementById('hero-particles')
  if (!container) return

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0.4'
  container.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  let W, H, particles = [], animId

  function resize() {
    W = canvas.width = container.offsetWidth
    H = canvas.height = container.offsetHeight
  }

  function createParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.4 - 0.1,
      alpha: Math.random() * 0.6 + 0.2,
      color: Math.random() > 0.5 ? '#E8614A' : '#2AADAD'
    }
  }

  resize()
  for (let i = 0; i < 120; i++) particles.push(createParticle())

  window.addEventListener('resize', resize)

  function draw() {
    ctx.clearRect(0, 0, W, H)
    particles.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.globalAlpha = p.alpha
      ctx.fill()

      p.x += p.vx
      p.y += p.vy
      p.alpha -= 0.001

      if (p.y < -10 || p.alpha <= 0) {
        Object.assign(p, createParticle(), { y: H + 10 })
      }
    })
    ctx.globalAlpha = 1
    animId = requestAnimationFrame(draw)
  }

  draw()

  // Stop when hero scrolls out of view
  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) {
      cancelAnimationFrame(animId)
      observer.disconnect()
    }
  })
  observer.observe(document.getElementById('hero'))
}
