/**
 * Glitch Particle Effects System
 *
 * Uses Three.js to render digital glitch effects for max dice rolls.
 * Features scanlines, pixel fragments, RGB splits, and data corruption aesthetics.
 */

import * as THREE from 'three';

let scene, camera, renderer;
let particles = [];
let scanlines = [];
let animationId = null;

const PARTICLE_LIFETIME = 0.8; // seconds - faster for glitchy feel
const SCANLINE_LIFETIME = 0.4;

// Magnitude scaling by die size (affects count, speed, spread, intensity)
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

// Glitch color palette
const COLORS = {
  cyan: new THREE.Color(0x00f0ff),
  magenta: new THREE.Color(0xff00ff),
  white: new THREE.Color(0xffffff),
  red: new THREE.Color(0xff3366)
};

/**
 * Initialize the Three.js scene and renderer
 */
export function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  camera = new THREE.OrthographicCamera(0, width, height, 0, -1000, 1000);
  camera.position.z = 100;

  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false // Crisp pixels for glitch aesthetic
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  window.addEventListener('resize', onResize);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.right = width;
  camera.top = height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

/**
 * Create a pixel fragment mesh (rectangular)
 */
function createPixelFragment() {
  const width = 2 + Math.random() * 8;
  const height = 2 + Math.random() * 4;
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    color: COLORS.cyan,
    transparent: true,
    opacity: 1
  });
  return new THREE.Mesh(geometry, material);
}

/**
 * Create a horizontal scanline
 */
function createScanline(x, y, width) {
  const height = 1 + Math.random() * 3;
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    color: COLORS.cyan,
    transparent: true,
    opacity: 0.8
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, 0);
  return mesh;
}

/**
 * Spawn a glitch burst from a screen position
 * @param {number} x - Screen X coordinate
 * @param {number} y - Screen Y coordinate
 * @param {number} dieSize - The die size (4, 6, 8, 10, 12, 20, 100)
 */
export function spawnParticles(x, y, dieSize = 20) {
  if (!scene || !renderer) {
    return;
  }

  const threeY = window.innerHeight - y;
  const mag = DIE_MAGNITUDE[dieSize] || DEFAULT_MAGNITUDE;

  // Spawn pixel fragments
  for (let i = 0; i < mag.count; i++) {
    const mesh = createPixelFragment();
    
    // Start clustered around origin with magnitude-scaled spread
    const offsetX = (Math.random() - 0.5) * mag.spread * 2;
    const offsetY = (Math.random() - 0.5) * mag.spread * 2;
    mesh.position.set(x + offsetX, threeY + offsetY, 0);

    // Pick color with RGB split aesthetic
    const colorChoice = Math.random();
    if (colorChoice < 0.5) {
      mesh.material.color = COLORS.cyan.clone();
    } else if (colorChoice < 0.75) {
      mesh.material.color = COLORS.magenta.clone();
    } else if (colorChoice < 0.9) {
      mesh.material.color = COLORS.white.clone();
    } else {
      mesh.material.color = COLORS.red.clone();
    }

    // Glitchy velocity - magnitude-scaled speed
    const angle = Math.random() * Math.PI * 2;
    const speed = mag.speed * (0.5 + Math.random());
    
    const particle = {
      mesh,
      velocity: new THREE.Vector2(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.5 // Flatter trajectory
      ),
      life: mag.lifetime * (0.5 + Math.random() * 0.5),
      maxLife: mag.lifetime,
      nextGlitch: Math.random() * 0.1, // Time until next position glitch
      glitchIntensity: 0.5 + Math.random() * 0.5
    };

    particles.push(particle);
    scene.add(mesh);
  }

  // Spawn horizontal scanlines - magnitude-scaled count
  const scanlineCount = mag.scanlines + Math.floor(Math.random() * (mag.scanlines * 0.5));
  const scanSpread = mag.spread * 2;
  for (let i = 0; i < scanlineCount; i++) {
    const scanWidth = mag.spread + Math.random() * mag.spread * 2;
    const offsetY = (Math.random() - 0.5) * scanSpread;
    const mesh = createScanline(x, threeY + offsetY, scanWidth);
    
    // Slight color variation
    if (Math.random() > 0.7) {
      mesh.material.color = COLORS.magenta.clone();
    }

    const scanline = {
      mesh,
      velocity: (Math.random() > 0.5 ? 1 : -1) * (mag.speed + Math.random() * mag.speed),
      life: SCANLINE_LIFETIME * mag.lifetime * (0.5 + Math.random() * 0.5),
      maxLife: SCANLINE_LIFETIME * mag.lifetime,
      flickerRate: 0.05 + Math.random() * 0.1
    };

    scanlines.push(scanline);
    scene.add(mesh);
  }

  // Start animation loop if not running
  if (!animationId) {
    lastTime = performance.now();
    animate();
  }
}

let lastTime = 0;

function animate() {
  const now = performance.now();
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  // Update pixel fragments
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    // Glitchy position jumps
    p.nextGlitch -= delta;
    if (p.nextGlitch <= 0) {
      // Random teleport
      p.mesh.position.x += (Math.random() - 0.5) * 20 * p.glitchIntensity;
      p.mesh.position.y += (Math.random() - 0.5) * 10 * p.glitchIntensity;
      p.nextGlitch = 0.02 + Math.random() * 0.08;
      
      // Random scale glitch
      const scaleX = 0.5 + Math.random() * 2;
      const scaleY = 0.5 + Math.random() * 1.5;
      p.mesh.scale.set(scaleX, scaleY, 1);
    }

    // Apply velocity with decay
    p.mesh.position.x += p.velocity.x * delta;
    p.mesh.position.y += p.velocity.y * delta;
    p.velocity.x *= 0.95;
    p.velocity.y *= 0.95;

    p.life -= delta;

    // Flickering opacity (not smooth fade)
    const lifeRatio = p.life / p.maxLife;
    const flicker = Math.random() > 0.3 ? 1 : 0.2;
    p.mesh.material.opacity = lifeRatio * flicker;

    // Remove dead particles
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }

  // Update scanlines
  for (let i = scanlines.length - 1; i >= 0; i--) {
    const s = scanlines[i];

    // Horizontal sweep
    s.mesh.position.x += s.velocity * delta;

    s.life -= delta;

    // Sharp flicker
    const lifeRatio = s.life / s.maxLife;
    const visible = Math.random() > s.flickerRate;
    s.mesh.material.opacity = visible ? lifeRatio * 0.8 : 0;

    // Occasional height glitch
    if (Math.random() > 0.9) {
      s.mesh.scale.y = 0.5 + Math.random() * 2;
    }

    if (s.life <= 0) {
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
      scanlines.splice(i, 1);
    }
  }

  renderer.render(scene, camera);

  // Keep animating if anything exists
  if (particles.length > 0 || scanlines.length > 0) {
    animationId = requestAnimationFrame(animate);
  } else {
    animationId = null;
  }
}
