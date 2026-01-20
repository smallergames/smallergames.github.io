/**
 * Physics Loot System
 *
 * Rapier physics engine for cube loot that collects on screen.
 */

import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier2d-compat@0.14.0/+esm';

// Tier definitions with sizes and point values
// Vaporwave palette: cyan → pink → violet → blue → magenta → cool grays
const TIER_CONFIG = {
  1: { name: 'JAWESOME', size: 24, points: 100, color: '#00f0ff' },
  2: { name: 'SHEESH', size: 20, points: 50, color: '#ff3366' },
  3: { name: 'BASED', size: 18, points: 25, color: '#ff00ff' },
  4: { name: 'DOPE', size: 16, points: 10, color: '#ff6b2b' },
  5: { name: 'DECENT', size: 14, points: 5, color: '#4d6bff' },
  6: { name: 'ZZZ', size: 12, points: 2, color: '#5a5a70' },
  7: { name: 'TRASH', size: 10, points: 1, color: '#3a3a4a' }
};

// Constants
const WALL_THICKNESS = 20;
const PIXELS_PER_METER = 50; // Scale factor for physics

// Mobile detection for performance tuning
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1);

// Darken a hex color by a factor (0 = black, 1 = original)
function darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

// State
let world = null;
let floorCollider = null;
let floorHandle = null;
let canvas = null;
let ctx = null;
let cubes = []; // Track our cube bodies with metadata
let bucketBounds = { left: 0, right: 0, bottom: 0, centerX: 0 };
let animationId = null;
let eventQueue = null;

// Impact marks - thin lines that spread from impact
let impacts = []; // { x, width, alpha, color }

// Convert pixels to physics units
function toPhysics(px) { return px / PIXELS_PER_METER; }
function toPixels(m) { return m * PIXELS_PER_METER; }

/**
 * Initialize the physics system
 */
export async function initPhysics() {
  canvas = document.getElementById('physicsCanvas');
  if (!canvas) {
    console.warn('[physics] Canvas not found');
    return false;
  }

  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('[physics] Could not get 2D context');
    return false;
  }

  // Initialize Rapier WASM
  await RAPIER.init();

  // Create physics world with gravity
  const gravity = { x: 0.0, y: 9.81 * 1.2 }; // Snappier gravity
  world = new RAPIER.World(gravity);

  // Create event queue for collision detection
  eventQueue = new RAPIER.EventQueue(true);

  // Setup canvas size
  resize();
  window.addEventListener('resize', resize);

  // Create floor
  createFloor();

  // Setup click/touch pulse interaction
  setupPulseInteraction();

  // Start render loop
  lastTime = performance.now();
  animate();

  return true;
}

// Screen boundary constants for containment (updated on resize)
let screenBounds = { left: 10, right: 0, top: 10 };

function updateScreenBounds() {
  screenBounds.left = 10;
  screenBounds.right = window.innerWidth - 10;
  screenBounds.top = 10;
}

function containCube(body, pxX, pxY, physPos, vel) {
  // pxX/pxY are pixel coords, physPos is raw physics position
  // Bounce off left edge
  if (pxX < screenBounds.left && vel.x < 0) {
    body.setTranslation({ x: toPhysics(screenBounds.left), y: physPos.y }, true);
    body.setLinvel({ x: Math.abs(vel.x) * 0.7, y: vel.y }, true);
  }
  // Bounce off right edge
  else if (pxX > screenBounds.right && vel.x > 0) {
    body.setTranslation({ x: toPhysics(screenBounds.right), y: physPos.y }, true);
    body.setLinvel({ x: -Math.abs(vel.x) * 0.7, y: vel.y }, true);
  }
  // Bounce off top edge
  if (pxY < screenBounds.top && vel.y < 0) {
    body.setTranslation({ x: physPos.x, y: toPhysics(screenBounds.top) }, true);
    body.setLinvel({ x: vel.x, y: Math.abs(vel.y) * 0.7 }, true);
  }
}


let lastTime = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';

  // Update screen bounds for containment
  updateScreenBounds();

  // Recreate floor on resize
  if (world) {
    createFloor();
  }
}

function createFloor() {
  // Remove old floor if exists
  if (floorCollider !== null) {
    world.removeCollider(floorCollider, true);
    floorCollider = null;
  }

  // Get actual bucket container position from DOM
  const bucketContainer = document.getElementById('bucketContainer');
  if (!bucketContainer) return;

  const rect = bucketContainer.getBoundingClientRect();

  bucketBounds = {
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    top: rect.top,
    centerX: rect.left + rect.width / 2,
    width: rect.width,
    height: rect.height
  };

  // Create floor as a fixed collider (no rigid body needed for static geometry)
  const floorDesc = RAPIER.ColliderDesc.cuboid(
    toPhysics(window.innerWidth),
    toPhysics(WALL_THICKNESS / 2)
  )
    .setTranslation(
      toPhysics(window.innerWidth / 2),
      toPhysics(bucketBounds.bottom + WALL_THICKNESS / 2)
    )
    .setRestitution(0.4)
    .setFriction(0.3)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

  floorCollider = world.createCollider(floorDesc);
  floorHandle = floorCollider.handle;
}

function setupPulseInteraction() {
  // Listen on document but only pulse if click isn't on interactive elements
  document.addEventListener('pointerdown', (e) => {
    // Ignore clicks on buttons and interactive elements
    if (e.target.closest('button, nav, dialog, [role="radio"]')) return;
    if (cubes.length === 0) return;

    const touchX = e.clientX;
    const touchY = e.clientY;

    // Only trigger floor bounce if clicking near the floor
    const clickNearFloor = touchY > bucketBounds.bottom - 80;

    cubes.forEach(cube => {
      const pos = cube.body.translation();
      const vel = cube.body.linvel();
      const posX = toPixels(pos.x);
      const posY = toPixels(pos.y);

      // Radial pulse from touch point - always applies
      const dx = posX - touchX;
      const dy = posY - touchY;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const radialStrength = Math.max(0, 8 - dist / 30);

      // Floor bounce: only if clicking near floor AND cube is near bottom AND horizontally close
      const distFromBottom = bucketBounds.bottom - posY;
      const horizontalDist = Math.abs(posX - touchX);
      const floorBoost = (clickNearFloor && distFromBottom < 60 && horizontalDist < 80) ? 3 : 0;

      // Apply impulse (convert to physics scale)
      const impulseX = (dx / dist) * radialStrength * 0.035;
      const impulseY = ((dy / dist) * radialStrength - floorBoost) * 0.035;

      cube.body.applyImpulse({ x: impulseX, y: impulseY }, true);
    });
  });
}

/**
 * Spawn a physics cube for a loot drop
 * @param {number} tier - Loot tier (1-7)
 * @param {number} originX - Starting X position
 * @param {number} originY - Starting Y position
 */
export function spawnCube(tier, originX, originY) {
  if (!world) return;

  const config = TIER_CONFIG[tier] || TIER_CONFIG[7];

  // Start from origin with slight random offset
  const startX = originX + (Math.random() - 0.5) * 20;
  const startY = originY + (Math.random() - 0.5) * 20;

  // Create rigid body
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(toPhysics(startX), toPhysics(startY))
    .setRotation(Math.random() * Math.PI * 2)
    .setLinearDamping(0.15)
    .setAngularDamping(0.3);

  const body = world.createRigidBody(bodyDesc);

  // Create collider (the shape)
  // Note: collision events only on floor collider - cubes don't need them
  const halfSize = toPhysics(config.size / 2);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(halfSize, halfSize)
    .setRestitution(0.3)
    .setFriction(0.2)
    .setDensity(1.0);

  const collider = world.createCollider(colliderDesc, body);

  // Spray outward with random velocity
  const angle = Math.random() * Math.PI * 2;
  const speed = 2 + Math.random() * 3;
  body.setLinvel({
    x: Math.cos(angle) * speed * 0.15,
    y: (Math.sin(angle) * speed + 1) * 0.15
  }, true);

  // Add spin
  body.setAngvel((Math.random() - 0.5) * 2, true);

  cubes.push({
    body,
    collider,
    tier,
    config,
    alpha: 1,
    scale: 1
  });
}



function animate() {
  const now = performance.now();
  const delta = Math.min(now - lastTime, 50); // Cap delta for tab switching
  lastTime = now;

  // Step physics world
  world.step(eventQueue);

  // Handle collision events for impact marks
  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    if (!started) return;

    // Check if one of the colliders is the floor
    const isFloorCollision = handle1 === floorHandle || handle2 === floorHandle;
    if (!isFloorCollision) return;

    // Find the cube that collided
    const cubeHandle = handle1 === floorHandle ? handle2 : handle1;
    const cube = cubes.find(c => c.collider.handle === cubeHandle);
    if (!cube) return;

    // Add impact mark
    const pos = cube.body.translation();
    const vel = cube.body.linvel();
    const velocity = Math.abs(vel.y) + Math.abs(vel.x) * 0.5;
    const baseWidth = 4 + velocity * 20;
    impacts.push({
      x: toPixels(pos.x),
      width: baseWidth,
      alpha: 1,
      color: cube.config.color
    });
  });

  // Grow and fade impacts
  impacts = impacts.filter(imp => {
    imp.width += delta * 0.3;
    imp.alpha -= delta * 0.004;
    return imp.alpha > 0;
  });

  // Render
  render();

  animationId = requestAnimationFrame(animate);
}

function render() {
  const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const floorY = bucketBounds.bottom;
  const cubeCount = cubes.length;

  // Draw impact marks - thin lines spreading from impact
  for (let i = 0; i < impacts.length; i++) {
    const imp = impacts[i];
    ctx.globalAlpha = imp.alpha * 0.7;
    ctx.fillStyle = imp.color;
    ctx.fillRect(imp.x - imp.width / 2, floorY - 1, imp.width, 2);
  }
  ctx.globalAlpha = 1;

  // Draw cubes and apply containment in single pass
  for (let i = 0; i < cubeCount; i++) {
    const cube = cubes[i];
    const { body, config, alpha, scale } = cube;
    const pos = body.translation();
    const vel = body.linvel();
    const angle = body.rotation();

    // Convert to pixels once
    const posX = toPixels(pos.x);
    const posY = toPixels(pos.y);

    // Containment check (merged from containCubes)
    containCube(body, posX, posY, pos, vel);

    ctx.save();
    ctx.translate(posX, posY);
    ctx.rotate(angle);

    const size = config.size * scale;
    const halfSize = size / 2;

    // Fill with slight transparency for holographic feel
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = config.color;
    ctx.fillRect(-halfSize, -halfSize, size, size);

    // Darker border for definition
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = darkenColor(config.color, 0.4);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-halfSize, -halfSize, size, size);

    ctx.restore();
  }
}
