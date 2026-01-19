/**
 * Glitch Particle Effects System
 *
 * Lightweight 2D canvas implementation for digital glitch effects on max dice rolls.
 * Features scanlines, pixel fragments, RGB splits, and data corruption aesthetics.
 * Uses object pooling to minimize GC pressure during animation.
 */

let canvas, ctx;
let particles = [];
let scanlines = [];
let animationId = null;
let lastTime = 0;
let isEnabled = false;

// Object pools for reuse (avoids GC pressure in animation loop)
const particlePool = [];
const scanlinePool = [];

function createParticle() {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    width: 0, height: 0, color: '',
    life: 0, maxLife: 0,
    nextGlitch: 0, glitchIntensity: 0,
    scaleX: 1, scaleY: 1
  };
}

function createScanline() {
  return {
    x: 0, y: 0, vx: 0,
    width: 0, height: 0, color: '',
    life: 0, maxLife: 0,
    flickerRate: 0, scaleY: 1
  };
}

function acquireParticle() {
  return particlePool.length > 0 ? particlePool.pop() : createParticle();
}

function releaseParticle(p) {
  particlePool.push(p);
}

function acquireScanline() {
  return scanlinePool.length > 0 ? scanlinePool.pop() : createScanline();
}

function releaseScanline(s) {
  scanlinePool.push(s);
}

// Particle burst configuration (standardized across all dice)
const PARTICLE_MAGNITUDE = { count: 20, speed: 120, spread: 50, scanlines: 2, lifetime: 0.65 };

const COLORS = ['#00f0ff', '#ff00ff', '#ffffff', '#ff3366'];

/**
 * Initialize the canvas renderer
 * @returns {boolean} Whether initialization was successful
 */
export function initParticles() {
  canvas = document.getElementById('particleCanvas');
  if (!canvas) {
    console.warn('[particles] Canvas element #particleCanvas not found. Particle effects disabled.');
    isEnabled = false;
    return false;
  }

  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('[particles] Failed to get 2D context from canvas. Particle effects disabled.');
    isEnabled = false;
    return false;
  }

  isEnabled = true;
  resize();

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resize, 100);
  });
  return true;
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
 * Spawn tiny sparkle particles around a position (for boost effect)
 * @param {number} x - Screen X coordinate
 * @param {number} y - Screen Y coordinate
 */
export function spawnSparkles(x, y) {
  if (!isEnabled || !ctx) return;

  const count = 2 + Math.floor(Math.random() * 2); // 2-3 particles

  for (let i = 0; i < count; i++) {
    const offsetX = (Math.random() - 0.5) * 60;
    const offsetY = (Math.random() - 0.5) * 30;
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 40;

    const p = acquireParticle();
    p.x = x + offsetX;
    p.y = y + offsetY;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.width = 2 + Math.random() * 4;
    p.height = 1 + Math.random() * 2;
    p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    p.life = 0.3 + Math.random() * 0.2;
    p.maxLife = 0.5;
    p.nextGlitch = Math.random() * 0.05;
    p.glitchIntensity = 0.3 + Math.random() * 0.3;
    p.scaleX = 1;
    p.scaleY = 1;
    particles.push(p);
  }

  if (!animationId) {
    lastTime = performance.now();
    animate();
  }
}

/**
 * Spawn a glitch burst from a screen position
 * @param {number} x - Screen X coordinate
 * @param {number} y - Screen Y coordinate
 * @param {number} dieSize - The die size (4, 6, 8, 10, 12, 20, 100)
 */
export function spawnParticles(x, y) {
  if (!isEnabled || !ctx) return;

  const mag = PARTICLE_MAGNITUDE;

  for (let i = 0; i < mag.count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = mag.speed * (0.5 + Math.random());

    const p = acquireParticle();
    p.x = x + (Math.random() - 0.5) * mag.spread * 2;
    p.y = y + (Math.random() - 0.5) * mag.spread * 2;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed * 0.5;
    p.width = 2 + Math.random() * 8;
    p.height = 2 + Math.random() * 4;
    p.color = COLORS[Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? 1 : Math.random() < 0.6 ? 2 : 3];
    p.life = mag.lifetime * (0.5 + Math.random() * 0.5);
    p.maxLife = mag.lifetime;
    p.nextGlitch = Math.random() * 0.1;
    p.glitchIntensity = 0.5 + Math.random() * 0.5;
    p.scaleX = 1;
    p.scaleY = 1;
    particles.push(p);
  }

  const scanlineCount = mag.scanlines + Math.floor(Math.random() * (mag.scanlines * 0.5));
  const scanSpread = mag.spread * 2;

  for (let i = 0; i < scanlineCount; i++) {
    const s = acquireScanline();
    s.x = x;
    s.y = y + (Math.random() - 0.5) * scanSpread;
    s.width = mag.spread + Math.random() * mag.spread * 2;
    s.height = 1 + Math.random() * 3;
    s.vx = (Math.random() > 0.5 ? 1 : -1) * (mag.speed + Math.random() * mag.speed);
    s.color = Math.random() > 0.7 ? '#ff00ff' : '#00f0ff';
    s.life = 0.4 * mag.lifetime * (0.5 + Math.random() * 0.5);
    s.maxLife = 0.4 * mag.lifetime;
    s.flickerRate = 0.05 + Math.random() * 0.1;
    s.scaleY = 1;
    scanlines.push(s);
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

  // Process particles with swap-and-pop removal (O(1) instead of splice's O(n))
  let i = 0;
  while (i < particles.length) {
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
      // Swap with last element and pop (O(1) removal)
      releaseParticle(p);
      particles[i] = particles[particles.length - 1];
      particles.pop();
      // Don't increment i - need to process the swapped element
    } else {
      i++;
    }
  }

  // Process scanlines with swap-and-pop removal
  i = 0;
  while (i < scanlines.length) {
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
      // Swap with last element and pop (O(1) removal)
      releaseScanline(s);
      scanlines[i] = scanlines[scanlines.length - 1];
      scanlines.pop();
      // Don't increment i - need to process the swapped element
    } else {
      i++;
    }
  }

  ctx.globalAlpha = 1;

  if (particles.length > 0 || scanlines.length > 0) {
    animationId = requestAnimationFrame(animate);
  } else {
    animationId = null;
  }
}
