/**
 * Glitch Particle Effects System
 *
 * Lightweight 2D canvas implementation for digital glitch effects on max dice rolls.
 * Features scanlines, pixel fragments, RGB splits, and data corruption aesthetics.
 */

let canvas, ctx;
let particles = [];
let scanlines = [];
let animationId = null;
let lastTime = 0;

const DIE_MAGNITUDE = {
  4: { count: 8, speed: 80, spread: 30, scanlines: 1, lifetime: 0.5 },
  6: { count: 14, speed: 100, spread: 40, scanlines: 2, lifetime: 0.6 },
  8: { count: 20, speed: 120, spread: 50, scanlines: 2, lifetime: 0.65 },
  10: { count: 28, speed: 150, spread: 55, scanlines: 3, lifetime: 0.7 },
  12: { count: 36, speed: 180, spread: 60, scanlines: 4, lifetime: 0.75 },
  20: { count: 50, speed: 220, spread: 70, scanlines: 5, lifetime: 0.8 },
  100: { count: 80, speed: 300, spread: 100, scanlines: 8, lifetime: 1.0 }
};

const DEFAULT_MAGNITUDE = { count: 30, speed: 150, spread: 60, scanlines: 3, lifetime: 0.8 };

const COLORS = ['#00f0ff', '#ff00ff', '#ffffff', '#ff3366'];

/**
 * Initialize the canvas renderer
 */
export function initParticles() {
  canvas = document.getElementById('particleCanvas');
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.scale(dpr, dpr);
}

/**
 * Spawn a glitch burst from a screen position
 * @param {number} x - Screen X coordinate
 * @param {number} y - Screen Y coordinate
 * @param {number} dieSize - The die size (4, 6, 8, 10, 12, 20, 100)
 */
export function spawnParticles(x, y, dieSize = 20) {
  if (!ctx) return;

  const mag = DIE_MAGNITUDE[dieSize] || DEFAULT_MAGNITUDE;

  for (let i = 0; i < mag.count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = mag.speed * (0.5 + Math.random());

    particles.push({
      x: x + (Math.random() - 0.5) * mag.spread * 2,
      y: y + (Math.random() - 0.5) * mag.spread * 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.5,
      width: 2 + Math.random() * 8,
      height: 2 + Math.random() * 4,
      color: COLORS[Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? 1 : Math.random() < 0.6 ? 2 : 3],
      life: mag.lifetime * (0.5 + Math.random() * 0.5),
      maxLife: mag.lifetime,
      nextGlitch: Math.random() * 0.1,
      glitchIntensity: 0.5 + Math.random() * 0.5,
      scaleX: 1,
      scaleY: 1
    });
  }

  const scanlineCount = mag.scanlines + Math.floor(Math.random() * (mag.scanlines * 0.5));
  const scanSpread = mag.spread * 2;

  for (let i = 0; i < scanlineCount; i++) {
    scanlines.push({
      x: x,
      y: y + (Math.random() - 0.5) * scanSpread,
      width: mag.spread + Math.random() * mag.spread * 2,
      height: 1 + Math.random() * 3,
      vx: (Math.random() > 0.5 ? 1 : -1) * (mag.speed + Math.random() * mag.speed),
      color: Math.random() > 0.7 ? '#ff00ff' : '#00f0ff',
      life: 0.4 * mag.lifetime * (0.5 + Math.random() * 0.5),
      maxLife: 0.4 * mag.lifetime,
      flickerRate: 0.05 + Math.random() * 0.1,
      scaleY: 1
    });
  }

  if (!animationId) {
    lastTime = performance.now();
    animate();
  }
}

function animate() {
  const now = performance.now();
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  const dpr = Math.min(window.devicePixelRatio, 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    p.nextGlitch -= delta;
    if (p.nextGlitch <= 0) {
      p.x += (Math.random() - 0.5) * 20 * p.glitchIntensity;
      p.y += (Math.random() - 0.5) * 10 * p.glitchIntensity;
      p.nextGlitch = 0.02 + Math.random() * 0.08;
      p.scaleX = 0.5 + Math.random() * 2;
      p.scaleY = 0.5 + Math.random() * 1.5;
    }

    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life -= delta;

    const lifeRatio = p.life / p.maxLife;
    const flicker = Math.random() > 0.3 ? 1 : 0.2;
    const alpha = lifeRatio * flicker;

    if (alpha > 0.01) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(
        p.x - (p.width * p.scaleX) / 2,
        p.y - (p.height * p.scaleY) / 2,
        p.width * p.scaleX,
        p.height * p.scaleY
      );
    }

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  for (let i = scanlines.length - 1; i >= 0; i--) {
    const s = scanlines[i];

    s.x += s.vx * delta;
    s.life -= delta;

    if (Math.random() > 0.9) {
      s.scaleY = 0.5 + Math.random() * 2;
    }

    const lifeRatio = s.life / s.maxLife;
    const visible = Math.random() > s.flickerRate;
    const alpha = visible ? lifeRatio * 0.8 : 0;

    if (alpha > 0.01) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.fillRect(
        s.x - s.width / 2,
        s.y - (s.height * s.scaleY) / 2,
        s.width,
        s.height * s.scaleY
      );
    }

    if (s.life <= 0) {
      scanlines.splice(i, 1);
    }
  }

  ctx.globalAlpha = 1;

  if (particles.length > 0 || scanlines.length > 0) {
    animationId = requestAnimationFrame(animate);
  } else {
    animationId = null;
  }
}
