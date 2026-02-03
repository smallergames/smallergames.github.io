/**
 * Homepage Physics
 *
 * Simplified Rapier physics for ambient cubes on the homepage.
 * Uses oxidized color palette to match sepia noir aesthetic.
 */

import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier2d-compat@0.14.0/+esm';

// Oxidized color palette (tier 1 = rarest → tier 7 = trash)
const TIER_CONFIG = {
  1: { size: 24, color: '#F0C864' },
  2: { size: 20, color: '#D49A42' },
  3: { size: 18, color: '#B5702E' },
  4: { size: 16, color: '#8A4626' },
  5: { size: 14, color: '#6B4030' },
  6: { size: 12, color: '#523828' },
  7: { size: 10, color: '#3D2A20' }
};

// Physics constants
const WALL_THICKNESS = 20;
const PIXELS_PER_METER = 80;
const GRAVITY_MULTIPLIER = 1.8;
const DELTA_CAP_MS = 50;
const PHYSICS_TIMESTEP = 1 / 60;
const MAX_SUBSTEPS = 4;

// Pulse interaction constants
const PULSE_BASE_STRENGTH = 8;
const PULSE_FALLOFF_DIVISOR = 30;
const PULSE_IMPULSE_SCALE = 0.045;
const PULSE_SIZE_NORMALIZE = 16;
const FLOOR_CLICK_THRESHOLD = 80;
const FLOOR_BOOST_DISTANCE = 60;
const FLOOR_BOOST_HORIZONTAL = 80;
const FLOOR_BOOST_STRENGTH = 3;

// Containment constants
const SCREEN_EDGE_PADDING = 10;
const BOUNCE_DAMPING = 0.5;

// Impact mark constants
const MAX_IMPACTS = 50;
const IMPACT_BASE_WIDTH = 4;
const IMPACT_VELOCITY_SCALE = 20;
const IMPACT_GROWTH_RATE = 0.3;
const IMPACT_FADE_RATE = 0.004;

// Goodbye pop constants
const GOODBYE_POP_DELAY = 120;
const GOODBYE_POP_DURATION = 80;
const GOODBYE_POP_SCALE = 1.3;


let resizeTimeout = null;
const RESIZE_DEBOUNCE_MS = 100;

function darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
}

function lightenColor(hex, factor) {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// State
let world = null;
let floorCollider = null;
let floorHandle = null;
let canvas = null;
let ctx = null;
let cubes = [];
let bucketBounds = { left: 0, right: 0, bottom: 0, centerX: 0 };
let eventQueue = null;
let impacts = [];
let lastTime = 0;
let accumulator = 0;
let screenBounds = { left: SCREEN_EDGE_PADDING, right: 0, top: SCREEN_EDGE_PADDING };

// Goodbye mode state
let goodbyeMode = false;
let goodbyeGravityRestored = false;
let goodbyeGravityRestoredAt = 0;
let ceilingCollider = null;
let ceilingHandle = null;

const GOODBYE_SETTLE_VELOCITY = 0.5;

function toPhysics(px) { return px / PIXELS_PER_METER; }
function toPixels(m) { return m * PIXELS_PER_METER; }

export async function initPhysics() {
  canvas = document.getElementById('physicsCanvas');
  if (!canvas) return false;

  ctx = canvas.getContext('2d');
  if (!ctx) return false;

  await RAPIER.init();

  const gravity = { x: 0.0, y: 9.81 * GRAVITY_MULTIPLIER };
  world = new RAPIER.World(gravity);
  eventQueue = new RAPIER.EventQueue(true);

  resize();
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resize, RESIZE_DEBOUNCE_MS);
  });

  createFloor();
  setupPulseInteraction();

  lastTime = performance.now();
  animate();

  return true;
}

function updateScreenBounds() {
  screenBounds.left = SCREEN_EDGE_PADDING;
  screenBounds.right = window.innerWidth - SCREEN_EDGE_PADDING;
  screenBounds.top = SCREEN_EDGE_PADDING;
}

function containCube(body, pxX, pxY, physPos, vel) {
  if (pxX < screenBounds.left) {
    body.setTranslation({ x: toPhysics(screenBounds.left), y: physPos.y }, true);
    body.setLinvel({ x: Math.abs(vel.x) * BOUNCE_DAMPING, y: vel.y }, true);
  } else if (pxX > screenBounds.right) {
    body.setTranslation({ x: toPhysics(screenBounds.right), y: physPos.y }, true);
    body.setLinvel({ x: -Math.abs(vel.x) * BOUNCE_DAMPING, y: vel.y }, true);
  }
  // Skip top containment during goodbye mode - let ceiling collider handle it
  if (!goodbyeMode && pxY < screenBounds.top) {
    body.setTranslation({ x: physPos.x, y: toPhysics(screenBounds.top) }, true);
    body.setLinvel({ x: vel.x, y: Math.abs(vel.y) * BOUNCE_DAMPING }, true);
  }
  if (pxY > bucketBounds.bottom) {
    body.setTranslation({ x: physPos.x, y: toPhysics(bucketBounds.bottom) }, true);
    body.setLinvel({ x: vel.x, y: -Math.abs(vel.y) * BOUNCE_DAMPING }, true);
  }
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';

  updateScreenBounds();

  if (world) createFloor();

  cubes.forEach(cube => {
    const pos = cube.body.translation();
    const pxX = toPixels(pos.x);
    const pxY = toPixels(pos.y);
    let newX = pos.x, newY = pos.y, clamped = false;

    if (pxX < screenBounds.left) { newX = toPhysics(screenBounds.left + 20); clamped = true; }
    else if (pxX > screenBounds.right) { newX = toPhysics(screenBounds.right - 20); clamped = true; }
    if (pxY < screenBounds.top) { newY = toPhysics(screenBounds.top + 20); clamped = true; }
    else if (pxY > bucketBounds.bottom) { newY = toPhysics(bucketBounds.bottom - 20); clamped = true; }

    if (clamped) {
      cube.body.setTranslation({ x: newX, y: newY }, true);
      cube.body.setLinvel({ x: 0, y: 0 }, true);
    }
  });
}

function createFloor() {
  if (floorCollider !== null) {
    world.removeCollider(floorCollider, true);
    floorCollider = null;
  }

  const bucketContainer = document.getElementById('bucketContainer');
  if (!bucketContainer) return;

  const rect = bucketContainer.getBoundingClientRect();
  bucketBounds = { left: rect.left, right: rect.right, bottom: rect.bottom, centerX: rect.left + rect.width / 2 };

  const floorDesc = RAPIER.ColliderDesc.cuboid(toPhysics(window.innerWidth), toPhysics(WALL_THICKNESS / 2))
    .setTranslation(toPhysics(window.innerWidth / 2), toPhysics(bucketBounds.bottom + WALL_THICKNESS / 2))
    .setRestitution(0.2)
    .setFriction(0.3)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

  floorCollider = world.createCollider(floorDesc);
  floorHandle = floorCollider.handle;
}

function setupPulseInteraction() {
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, nav, dialog, a, [role="radio"]')) return;
    if (cubes.length === 0) return;

    const touchX = e.clientX;
    const touchY = e.clientY;
    const clickNearFloor = touchY > bucketBounds.bottom - FLOOR_CLICK_THRESHOLD;

    cubes.forEach(cube => {
      const pos = cube.body.translation();
      const posX = toPixels(pos.x);
      const posY = toPixels(pos.y);

      const dx = posX - touchX;
      const dy = posY - touchY;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const radialStrength = Math.max(0, PULSE_BASE_STRENGTH - dist / PULSE_FALLOFF_DIVISOR);

      const distFromBottom = bucketBounds.bottom - posY;
      const horizontalDist = Math.abs(posX - touchX);
      const floorBoost = (clickNearFloor && distFromBottom < FLOOR_BOOST_DISTANCE && horizontalDist < FLOOR_BOOST_HORIZONTAL)
        ? FLOOR_BOOST_STRENGTH : 0;

      const sizeScale = cube.config.size / PULSE_SIZE_NORMALIZE;
      const impulseX = (dx / dist) * radialStrength * PULSE_IMPULSE_SCALE * sizeScale;
      const impulseY = ((dy / dist) * radialStrength - floorBoost) * PULSE_IMPULSE_SCALE * sizeScale;

      cube.body.applyImpulse({ x: impulseX, y: impulseY }, true);
    });
  });
}

export function getCubeCount() {
  return cubes.length;
}

export function triggerGoodbye() {
  if (goodbyeMode || cubes.length === 0) return false;
  goodbyeMode = true;
  goodbyeGravityRestored = false;
  
  // Create ceiling collider for impact detection at top of screen
  if (ceilingCollider) {
    world.removeCollider(ceilingCollider, true);
  }
  const ceilingY = SCREEN_EDGE_PADDING - WALL_THICKNESS / 2;
  const ceilingDesc = RAPIER.ColliderDesc.cuboid(toPhysics(window.innerWidth), toPhysics(WALL_THICKNESS / 2))
    .setTranslation(toPhysics(window.innerWidth / 2), toPhysics(ceilingY))
    .setRestitution(0.3)
    .setFriction(0.3)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  ceilingCollider = world.createCollider(ceilingDesc);
  ceilingHandle = ceilingCollider.handle;
  
  // Reverse gravity
  world.gravity = { x: 0, y: -9.81 * GRAVITY_MULTIPLIER };
  
  return true;
}

export function isGoodbyeActive() {
  return goodbyeMode;
}

function updateGoodbyeMode() {
  if (!goodbyeMode) return;

  // End goodbye mode when all cubes are gone
  if (cubes.length === 0) {
    if (ceilingCollider) {
      world.removeCollider(ceilingCollider, true);
      ceilingCollider = null;
      ceilingHandle = null;
    }
    world.gravity = { x: 0, y: 9.81 * GRAVITY_MULTIPLIER };
    goodbyeMode = false;
  }
}

export function spawnCube(tier, originX, originY) {
  if (!world || goodbyeMode) return;

  const config = TIER_CONFIG[tier] || TIER_CONFIG[7];
  const startX = originX + (Math.random() - 0.5) * 20;
  const startY = originY + (Math.random() - 0.5) * 20;

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(toPhysics(startX), toPhysics(startY))
    .setRotation(Math.random() * Math.PI * 2)
    .setLinearDamping(0.01)
    .setAngularDamping(0.3);

  const body = world.createRigidBody(bodyDesc);

  const halfSize = toPhysics(config.size / 2);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(halfSize, halfSize)
    .setRestitution(0.3)
    .setFriction(0.2)
    .setDensity(1.0);

  const collider = world.createCollider(colliderDesc, body);

  const angle = Math.random() * Math.PI * 2;
  const speed = 2 + Math.random() * 3;
  body.setLinvel({ x: Math.cos(angle) * speed * 0.15, y: (Math.sin(angle) * speed + 1) * 0.15 }, true);
  body.setAngvel((Math.random() - 0.5) * 2, true);

  const pos = body.translation();
  cubes.push({ body, collider, tier, config, alpha: 1, scale: 1, prevX: pos.x, prevY: pos.y, prevAngle: body.rotation() });
}

function animate() {
  const now = performance.now();
  const delta = Math.min(now - lastTime, DELTA_CAP_MS);
  lastTime = now;

  updateGoodbyeMode();

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
  const alpha = (steps > 0 && accumulator < PHYSICS_TIMESTEP)
    ? accumulator / PHYSICS_TIMESTEP
    : 1;
  if (accumulator >= PHYSICS_TIMESTEP) accumulator = 0;

  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    if (!started) return;
    
    const isFloorCollision = handle1 === floorHandle || handle2 === floorHandle;
    const isCeilingCollision = ceilingHandle && (handle1 === ceilingHandle || handle2 === ceilingHandle);
    
    if (!isFloorCollision && !isCeilingCollision) return;

    const cubeHandle = (handle1 === floorHandle || handle1 === ceilingHandle) ? handle2 : handle1;
    const cube = cubes.find(c => c.collider.handle === cubeHandle);
    if (!cube) return;

    // Handle goodbye mode collisions
    if (goodbyeMode) {
      if (isFloorCollision && goodbyeGravityRestored && !cube.poppingAt) {
        // Start pop animation after short delay
        cube.poppingAt = performance.now() + GOODBYE_POP_DELAY;
      }
    }

    // Create impact marks for floor and ceiling hits
    if (impacts.length < MAX_IMPACTS) {
      const pos = cube.body.translation();
      const vel = cube.body.linvel();
      const velocity = Math.abs(vel.y) + Math.abs(vel.x) * 0.5;
      const impactY = isCeilingCollision ? SCREEN_EDGE_PADDING : bucketBounds.bottom;
      impacts.push({ x: toPixels(pos.x), y: impactY, width: IMPACT_BASE_WIDTH + velocity * IMPACT_VELOCITY_SCALE, alpha: 1, color: cube.config.color });
    }
  });

  impacts = impacts.filter(imp => {
    imp.width += delta * IMPACT_GROWTH_RATE;
    imp.alpha -= delta * IMPACT_FADE_RATE;
    return imp.alpha > 0;
  });

  // Check if all cubes have passed halfway to top, then restore gravity
  if (goodbyeMode && !goodbyeGravityRestored) {
    const halfwayY = window.innerHeight / 2;
    const allPastHalfway = cubes.every(cube => {
      const posY = toPixels(cube.body.translation().y);
      return posY < halfwayY;
    });
    if (allPastHalfway) {
      world.gravity = { x: 0, y: 9.81 * GRAVITY_MULTIPLIER };
      goodbyeGravityRestored = true;
      goodbyeGravityRestoredAt = now;
    }
  }

  // Pop settled cubes that missed their floor collision event
  if (goodbyeMode && goodbyeGravityRestored) {
    cubes.forEach(cube => {
      if (cube.poppingAt) return;
      const vel = cube.body.linvel();
      const speed = Math.abs(vel.x) + Math.abs(vel.y);
      if (speed < GOODBYE_SETTLE_VELOCITY) {
        cube.poppingAt = now;
      }
    });
  }

  // Update pop animations
  cubes.forEach(cube => {
    if (cube.poppingAt && now >= cube.poppingAt) {
      const elapsed = now - cube.poppingAt;
      const progress = Math.min(elapsed / GOODBYE_POP_DURATION, 1);
      // Quick scale up then down to zero
      if (progress < 0.3) {
        cube.scale = 1 + (GOODBYE_POP_SCALE - 1) * (progress / 0.3);
      } else {
        cube.scale = GOODBYE_POP_SCALE * (1 - (progress - 0.3) / 0.7);
      }
      cube.alpha = 1 - progress * 0.5;
      if (progress >= 1) {
        cube.markedForRemoval = true;
      }
    }
  });

  // Filter out marked cubes BEFORE render
  const toRemove = cubes.filter(c => c.markedForRemoval);
  if (toRemove.length > 0) {
    cubes = cubes.filter(c => !c.markedForRemoval);
  }

  render(alpha);

  // Deferred physics body removal (after render to avoid Rapier aliasing errors)
  if (toRemove.length > 0) {
    toRemove.forEach(cube => world.removeRigidBody(cube.body));
  }

  requestAnimationFrame(animate);
}

function render(t) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  for (let i = 0; i < impacts.length; i++) {
    const imp = impacts[i];
    ctx.globalAlpha = imp.alpha * 0.7;
    ctx.fillStyle = imp.color;
    ctx.fillRect(imp.x - imp.width / 2, imp.y - 1, imp.width, 2);
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < cubes.length; i++) {
    const cube = cubes[i];
    const { body, config, alpha, scale, tier, prevX, prevY, prevAngle } = cube;
    const pos = body.translation();
    const vel = body.linvel();
    const curAngle = body.rotation();
    const lerpX = prevX + (pos.x - prevX) * t;
    const lerpY = prevY + (pos.y - prevY) * t;
    const angle = prevAngle + (curAngle - prevAngle) * t;
    const posX = toPixels(lerpX);
    const posY = toPixels(lerpY);

    containCube(body, posX, posY, pos, vel);

    ctx.save();
    ctx.translate(posX, posY);
    ctx.rotate(angle);

    const size = config.size * scale;
    const halfSize = size / 2;

    // Subtle glow for rare tiers
    if (tier <= 3) {
      ctx.shadowColor = config.color;
      ctx.shadowBlur = (4 - tier) * 3;
    }

    ctx.globalAlpha = alpha * 0.95;
    ctx.fillStyle = config.color;
    ctx.fillRect(-halfSize, -halfSize, size, size);

    ctx.shadowBlur = 0;

    // Tier-specific borders
    ctx.globalAlpha = alpha * 0.9;
    if (tier <= 2) {
      ctx.strokeStyle = lightenColor(config.color, 1.4);
      ctx.lineWidth = 1.5;
    } else if (tier <= 4) {
      ctx.strokeStyle = lightenColor(config.color, 1.2);
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = darkenColor(config.color, 0.5);
      ctx.lineWidth = 1;
    }
    ctx.strokeRect(-halfSize, -halfSize, size, size);

    ctx.restore();
  }
}
