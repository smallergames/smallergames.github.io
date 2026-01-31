/**
 * Physics Loot System
 *
 * Rapier physics engine for cube loot that accumulates on screen.
 */

import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier2d-compat@0.14.0/+esm';

// Tier definitions with sizes and point values
// Warm palette: gold → amethyst → azure → mint → silver → bronze → ash
const TIER_CONFIG = {
  1: { name: 'JAWESOME', size: 24, points: 100, color: '#F5C66A' },
  2: { name: 'SHEESH', size: 20, points: 50, color: '#B58CFF' },
  3: { name: 'BASED', size: 18, points: 25, color: '#5FA8FF' },
  4: { name: 'DOPE', size: 16, points: 10, color: '#62D49A' },
  5: { name: 'DECENT', size: 14, points: 5, color: '#A7B0BA' },
  6: { name: 'ZZZ', size: 12, points: 2, color: '#B88B5A' },
  7: { name: 'TRASH', size: 10, points: 1, color: '#4E4A46' }
};

// Physics constants
const WALL_THICKNESS = 20;
const PIXELS_PER_METER = 80;           // Scale factor for physics
const GRAVITY_MULTIPLIER = 1.8;        // Snappier feel than default 9.81
const DELTA_CAP_MS = 50;               // Max physics step to handle tab backgrounding
const PHYSICS_TIMESTEP = 1 / 60;
const MAX_SUBSTEPS = 4;

// Pulse interaction constants
const PULSE_BASE_STRENGTH = 8;         // Base radial pulse strength
const PULSE_FALLOFF_DIVISOR = 30;      // Distance divisor for pulse falloff
const PULSE_IMPULSE_SCALE = 0.045;     // Impulse multiplier
const PULSE_SIZE_NORMALIZE = 16;       // Mid-tier cube size for impulse scaling
const FLOOR_CLICK_THRESHOLD = 80;      // Max pixels from floor to trigger floor boost
const FLOOR_BOOST_DISTANCE = 60;       // Max cube distance from floor for boost
const FLOOR_BOOST_HORIZONTAL = 80;     // Max horizontal distance for floor boost
const FLOOR_BOOST_STRENGTH = 3;        // Extra upward impulse when clicking near floor

// Containment constants
const SCREEN_EDGE_PADDING = 10;        // Padding from screen edges
const BOUNCE_DAMPING = 0.5;            // Velocity retention on edge bounce

// Impact mark constants
const MAX_IMPACTS = 50;                // Maximum concurrent impact marks
const IMPACT_BASE_WIDTH = 4;           // Base width of impact mark
const IMPACT_VELOCITY_SCALE = 20;      // Width scaling based on impact velocity
const IMPACT_GROWTH_RATE = 0.3;        // How fast impacts expand per ms
const IMPACT_FADE_RATE = 0.004;        // How fast impacts fade per ms

// Mobile detection for performance tuning
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1);

// Resize debounce
let resizeTimeout = null;
const RESIZE_DEBOUNCE_MS = 100;

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
  const gravity = { x: 0.0, y: 9.81 * GRAVITY_MULTIPLIER };
  world = new RAPIER.World(gravity);

  // Create event queue for collision detection
  eventQueue = new RAPIER.EventQueue(true);

  // Setup canvas size
  resize();
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resize, RESIZE_DEBOUNCE_MS);
  });

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
let screenBounds = { left: SCREEN_EDGE_PADDING, right: 0, top: SCREEN_EDGE_PADDING };

function updateScreenBounds() {
  screenBounds.left = SCREEN_EDGE_PADDING;
  screenBounds.right = window.innerWidth - SCREEN_EDGE_PADDING;
  screenBounds.top = SCREEN_EDGE_PADDING;
}

function containCube(body, pxX, pxY, physPos, vel) {
  // Bounce off left edge
  if (pxX < screenBounds.left) {
    body.setTranslation({ x: toPhysics(screenBounds.left), y: physPos.y }, true);
    body.setLinvel({ x: Math.abs(vel.x) * BOUNCE_DAMPING, y: vel.y }, true);
  }
  // Bounce off right edge
  else if (pxX > screenBounds.right) {
    body.setTranslation({ x: toPhysics(screenBounds.right), y: physPos.y }, true);
    body.setLinvel({ x: -Math.abs(vel.x) * BOUNCE_DAMPING, y: vel.y }, true);
  }
  // Bounce off top edge
  if (pxY < screenBounds.top) {
    body.setTranslation({ x: physPos.x, y: toPhysics(screenBounds.top) }, true);
    body.setLinvel({ x: vel.x, y: Math.abs(vel.y) * BOUNCE_DAMPING }, true);
  }
  // Bounce off floor
  if (pxY > bucketBounds.bottom) {
    body.setTranslation({ x: physPos.x, y: toPhysics(bucketBounds.bottom) }, true);
    body.setLinvel({ x: vel.x, y: -Math.abs(vel.y) * BOUNCE_DAMPING }, true);
  }
}


let lastTime = 0;
let accumulator = 0;

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

  // Clamp existing cubes to new bounds to prevent launch on resize
  cubes.forEach(cube => {
    const pos = cube.body.translation();
    const pxX = toPixels(pos.x);
    const pxY = toPixels(pos.y);
    let newX = pos.x;
    let newY = pos.y;
    let clamped = false;

    // Clamp X axis
    if (pxX < screenBounds.left) {
      newX = toPhysics(screenBounds.left + 20);
      clamped = true;
    } else if (pxX > screenBounds.right) {
      newX = toPhysics(screenBounds.right - 20);
      clamped = true;
    }

    // Clamp Y axis
    if (pxY < screenBounds.top) {
      newY = toPhysics(screenBounds.top + 20);
      clamped = true;
    } else if (pxY > bucketBounds.bottom) {
      newY = toPhysics(bucketBounds.bottom - 20);
      clamped = true;
    }

    if (clamped) {
      cube.body.setTranslation({ x: newX, y: newY }, true);
      cube.body.setLinvel({ x: 0, y: 0 }, true);
    }
  });
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
    centerX: rect.left + rect.width / 2
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
    .setRestitution(0.2)
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
    const clickNearFloor = touchY > bucketBounds.bottom - FLOOR_CLICK_THRESHOLD;

    cubes.forEach(cube => {
      const pos = cube.body.translation();
      const posX = toPixels(pos.x);
      const posY = toPixels(pos.y);

      // Radial pulse from touch point - always applies
      const dx = posX - touchX;
      const dy = posY - touchY;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const radialStrength = Math.max(0, PULSE_BASE_STRENGTH - dist / PULSE_FALLOFF_DIVISOR);

      // Floor bounce: only if clicking near floor AND cube is near bottom AND horizontally close
      const distFromBottom = bucketBounds.bottom - posY;
      const horizontalDist = Math.abs(posX - touchX);
      const floorBoost = (clickNearFloor && distFromBottom < FLOOR_BOOST_DISTANCE && horizontalDist < FLOOR_BOOST_HORIZONTAL)
        ? FLOOR_BOOST_STRENGTH
        : 0;

      // Scale impulse by cube size - larger cubes get more impulse to bounce,
      // smaller cubes get less so they don't fly at ridiculous speeds
      const sizeScale = cube.config.size / PULSE_SIZE_NORMALIZE;
      const impulseX = (dx / dist) * radialStrength * PULSE_IMPULSE_SCALE * sizeScale;
      const impulseY = ((dy / dist) * radialStrength - floorBoost) * PULSE_IMPULSE_SCALE * sizeScale;

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
  if (!world) {
    console.warn('[physics] spawnCube called before physics initialized');
    return;
  }

  const config = TIER_CONFIG[tier] || TIER_CONFIG[7];

  // Start from origin with slight random offset
  const startX = originX + (Math.random() - 0.5) * 20;
  const startY = originY + (Math.random() - 0.5) * 20;

  // Create rigid body
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(toPhysics(startX), toPhysics(startY))
    .setRotation(Math.random() * Math.PI * 2)
    .setLinearDamping(0.01)
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

  const initPos = body.translation();
  cubes.push({
    body,
    collider,
    tier,
    config,
    alpha: 1,
    scale: 1,
    prevX: initPos.x,
    prevY: initPos.y,
    prevAngle: body.rotation()
  });
}

function animate() {
  const now = performance.now();
  const delta = Math.min(now - lastTime, DELTA_CAP_MS);
  lastTime = now;

  // Step physics world with fixed timestep
  accumulator += delta / 1000;
  let steps = 0;
  while (accumulator >= PHYSICS_TIMESTEP && steps < MAX_SUBSTEPS) {
    for (let i = 0; i < cubes.length; i++) {
      const c = cubes[i];
      const p = c.body.translation();
      c.prevX = p.x;
      c.prevY = p.y;
      c.prevAngle = c.body.rotation();
    }
    world.timestep = PHYSICS_TIMESTEP;
    world.step(eventQueue);
    accumulator -= PHYSICS_TIMESTEP;
    steps++;
  }
  // When substep cap is hit, snap to current position (alpha=1) instead of
  // rendering behind, which caused floaty/laggy feel on mobile
  const interpAlpha = (steps > 0 && accumulator < PHYSICS_TIMESTEP)
    ? accumulator / PHYSICS_TIMESTEP
    : 1;
  if (accumulator >= PHYSICS_TIMESTEP) accumulator = 0;

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

    // Add impact mark (cap array size to prevent unbounded growth)
    if (impacts.length < MAX_IMPACTS) {
      const pos = cube.body.translation();
      const vel = cube.body.linvel();
      const velocity = Math.abs(vel.y) + Math.abs(vel.x) * 0.5;
      const baseWidth = IMPACT_BASE_WIDTH + velocity * IMPACT_VELOCITY_SCALE;
      impacts.push({
        x: toPixels(pos.x),
        width: baseWidth,
        alpha: 1,
        color: cube.config.color
      });
    }
  });

  // Grow and fade impacts
  impacts = impacts.filter(imp => {
    imp.width += delta * IMPACT_GROWTH_RATE;
    imp.alpha -= delta * IMPACT_FADE_RATE;
    return imp.alpha > 0;
  });

  // Render
  render(interpAlpha);

  requestAnimationFrame(animate);
}

function render(t) {
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
    const { body, config, alpha, scale, prevX, prevY, prevAngle } = cube;
    const pos = body.translation();
    const vel = body.linvel();
    const curAngle = body.rotation();
    const lerpX = prevX + (pos.x - prevX) * t;
    const lerpY = prevY + (pos.y - prevY) * t;
    const angle = prevAngle + (curAngle - prevAngle) * t;

    // Convert to pixels once
    const posX = toPixels(lerpX);
    const posY = toPixels(lerpY);

    // Containment check
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
