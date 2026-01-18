/**
 * Particle Effects System
 *
 * Uses Three.js to render celebratory particle bursts for max dice rolls.
 */

import * as THREE from 'three';

let scene, camera, renderer;
let particles = [];
let animationId = null;

const PARTICLE_LIFETIME = 1.5; // seconds
const GRAVITY = -400;
const INITIAL_SPEED = 300;

// Particle counts scaled by die size
const PARTICLE_COUNTS = {
  4: 8,
  6: 12,
  8: 16,
  10: 20,
  12: 25,
  20: 35,
  100: 50
};

// Cyan accent color matching the app theme
const PARTICLE_COLOR = new THREE.Color(0x00f0ff);

/**
 * Initialize the Three.js scene and renderer
 */
export function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;

  // Orthographic camera for 2D overlay
  // Parameters: left, right, top, bottom, near, far
  // top > bottom for standard Y-up coordinate system
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera = new THREE.OrthographicCamera(0, width, height, 0, -1000, 1000);
  camera.position.z = 100;

  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true
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
 * Create a single particle mesh
 */
function createParticleMesh() {
  const geometry = new THREE.CircleGeometry(4, 8);
  const material = new THREE.MeshBasicMaterial({
    color: PARTICLE_COLOR,
    transparent: true,
    opacity: 1
  });
  return new THREE.Mesh(geometry, material);
}

/**
 * Spawn a burst of particles from a screen position
 * @param {number} x - Screen X coordinate
 * @param {number} y - Screen Y coordinate
 * @param {number} dieSize - The die size (4, 6, 8, 10, 12, 20, 100)
 */
export function spawnParticles(x, y, dieSize = 20) {
  if (!scene || !renderer) {
    return;
  }

  // Convert screen coords to Three.js coords (Y is flipped)
  const threeY = window.innerHeight - y;
  const count = PARTICLE_COUNTS[dieSize] || 20;

  for (let i = 0; i < count; i++) {
    const mesh = createParticleMesh();
    mesh.position.set(x, threeY, 0);

    // Random direction in a circle
    const angle = Math.random() * Math.PI * 2;
    const speed = INITIAL_SPEED * (0.5 + Math.random() * 0.5);

    const particle = {
      mesh,
      velocity: new THREE.Vector2(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      ),
      life: PARTICLE_LIFETIME,
      maxLife: PARTICLE_LIFETIME
    };

    // Vary the size a bit
    const scale = 0.5 + Math.random() * 1;
    mesh.scale.set(scale, scale, 1);

    // Slight color variation
    const hue = 0.5 + (Math.random() - 0.5) * 0.1; // Cyan-ish
    mesh.material.color.setHSL(hue, 1, 0.6);

    particles.push(particle);
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

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    // Apply gravity
    p.velocity.y += GRAVITY * delta;

    // Update position
    p.mesh.position.x += p.velocity.x * delta;
    p.mesh.position.y += p.velocity.y * delta;

    // Decrease life
    p.life -= delta;

    // Fade out
    const lifeRatio = p.life / p.maxLife;
    p.mesh.material.opacity = lifeRatio;

    // Shrink slightly
    const scale = p.mesh.scale.x * (0.98 + lifeRatio * 0.02);
    p.mesh.scale.set(scale, scale, 1);

    // Remove dead particles
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }

  renderer.render(scene, camera);

  // Keep animating if particles exist
  if (particles.length > 0) {
    animationId = requestAnimationFrame(animate);
  } else {
    animationId = null;
  }
}
