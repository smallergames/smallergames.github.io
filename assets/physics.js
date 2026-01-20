/**
 * Physics Loot System
 *
 * Matter.js physics engine for cube loot that collects on screen.
 */


// Matter.js aliases
const { Engine, World, Bodies, Body, Events, Composite, Sleeping } = Matter;

// Tier definitions with sizes and point values
const TIER_CONFIG = {
  1: { name: 'JAWESOME', size: 24, points: 100, color: '#00f0ff' },
  2: { name: 'SHEESH', size: 20, points: 50, color: '#fb923c' },
  3: { name: 'BASED', size: 18, points: 25, color: '#c084fc' },
  4: { name: 'DOPE', size: 16, points: 10, color: '#60a5fa' },
  5: { name: 'DECENT', size: 14, points: 5, color: '#4ade80' },
  6: { name: 'ZZZ', size: 12, points: 2, color: '#aaaaaa' },
  7: { name: 'TRASH', size: 10, points: 1, color: '#888888' }
};

// Constants
const WALL_THICKNESS = 20;

// State
let engine = null;
let world = null;
let canvas = null;
let ctx = null;
let cubes = []; // Track our cube bodies with metadata
let walls = [];
let bucketBounds = { left: 0, right: 0, bottom: 0, centerX: 0 };
let animationId = null;

// Impact marks - thin lines that spread from impact
let impacts = []; // { x, width, alpha, color }


/**
 * Initialize the physics system
 */
export function initPhysics() {
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


  // Create Matter.js engine with sleeping enabled for stability
  engine = Engine.create({
    enableSleeping: true,
    positionIterations: 10,
    velocityIterations: 10
  });
  world = engine.world;

  // Reduce gravity slightly for more floaty feel
  engine.world.gravity.y = 0.8;

  // Setup canvas size
  resize();
  window.addEventListener('resize', resize);

  // Create bucket walls
  createBucket();

  // Setup collision detection for forcefield effect
  setupCollisionDetection();

  // Setup click/touch pulse interaction
  setupPulseInteraction();

  // Start render loop
  lastTime = performance.now();
  animate();

  return true;
}

function setupCollisionDetection() {
  // Detect collisions with floor
  Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach(pair => {
      const { bodyA, bodyB } = pair;

      // Check if one body is the floor (walls[0])
      const isFloorCollision = bodyA === walls[0] || bodyB === walls[0];
      if (!isFloorCollision) return;

      // Get the cube body and find its data
      const cubeBody = bodyA === walls[0] ? bodyB : bodyA;
      const cube = cubes.find(c => c.body === cubeBody);
      if (!cube) return;

      // Add impact mark - width based on impact velocity
      const velocity = Math.abs(cubeBody.velocity.y) + Math.abs(cubeBody.velocity.x) * 0.5;
      const baseWidth = 4 + velocity * 3;
      impacts.push({ x: cubeBody.position.x, width: baseWidth, alpha: 1, color: cube.config.color });
    });
  });
}

function containCubes() {
  const margin = 10;
  const screenLeft = margin;
  const screenRight = window.innerWidth - margin;
  const screenTop = margin;

  cubes.forEach(cube => {
    const { body } = cube;
    const pos = body.position;
    const vel = body.velocity;

    // Bounce off left edge
    if (pos.x < screenLeft && vel.x < 0) {
      Body.setPosition(body, { x: screenLeft, y: pos.y });
      Body.setVelocity(body, { x: Math.abs(vel.x) * 0.7, y: vel.y });
    }

    // Bounce off right edge
    if (pos.x > screenRight && vel.x > 0) {
      Body.setPosition(body, { x: screenRight, y: pos.y });
      Body.setVelocity(body, { x: -Math.abs(vel.x) * 0.7, y: vel.y });
    }

    // Bounce off top edge
    if (pos.y < screenTop && vel.y < 0) {
      Body.setPosition(body, { x: pos.x, y: screenTop });
      Body.setVelocity(body, { x: vel.x, y: Math.abs(vel.y) * 0.7 });
    }
  });
}


let lastTime = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';

  // Recreate bucket on resize
  if (world) {
    createBucket();
  }
}

function createBucket() {
  // Remove old walls
  walls.forEach(wall => Composite.remove(world, wall));
  walls = [];

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

  // Only create floor - walls handled by screen edge bounce
  const wallOptions = {
    isStatic: true,
    friction: 0.3,
    restitution: 0.4,
    render: { visible: false }
  };

  // Bottom wall (floor) - spans full screen width
  const bottomWall = Bodies.rectangle(
    window.innerWidth / 2,
    bucketBounds.bottom + WALL_THICKNESS / 2,
    window.innerWidth * 2,
    WALL_THICKNESS,
    wallOptions
  );

  walls = [bottomWall];
  Composite.add(world, walls);
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
      const pos = cube.body.position;
      const vel = cube.body.velocity;

      // Radial pulse from touch point - always applies
      const dx = pos.x - touchX;
      const dy = pos.y - touchY;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const radialStrength = Math.max(0, 8 - dist / 30);

      // Floor bounce: only if clicking near floor AND cube is near bottom AND horizontally close
      const distFromBottom = bucketBounds.bottom - pos.y;
      const horizontalDist = Math.abs(pos.x - touchX);
      const floorBoost = (clickNearFloor && distFromBottom < 60 && horizontalDist < 80) ? 5 : 0;

      // Wake sleeping bodies so they respond to pulse
      Sleeping.set(cube.body, false);

      Body.setVelocity(cube.body, {
        x: vel.x + (dx / dist) * radialStrength,
        y: vel.y + (dy / dist) * radialStrength - floorBoost
      });
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

  // Create physics body
  const body = Bodies.rectangle(startX, startY, config.size, config.size, {
    friction: 0.5,
    restitution: 0.3,
    density: 0.001,
    slop: 0.05,
    angle: Math.random() * Math.PI * 2,
    chamfer: { radius: 2 }
  });

  // Spray outward with random velocity
  const angle = Math.random() * Math.PI * 2;
  const speed = 2 + Math.random() * 3;
  Body.setVelocity(body, {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed + 1 // slight downward bias
  });

  // Add spin
  Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);

  Composite.add(world, body);

  cubes.push({
    body,
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

  // Update physics
  Engine.update(engine, delta);

  // Contain cubes - prevent escape from bucket top
  containCubes();

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
  const dpr = Math.min(window.devicePixelRatio, 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  // Draw impact marks - 1px thin lines spreading from impact
  const floorY = bucketBounds.bottom;
  impacts.forEach(imp => {
    ctx.globalAlpha = imp.alpha * 0.6;
    ctx.fillStyle = imp.color;
    ctx.fillRect(imp.x - imp.width / 2, floorY - 1, imp.width, 1);
  });
  ctx.globalAlpha = 1;

  // Draw cubes
  cubes.forEach(cube => {
    const { body, config, alpha, scale } = cube;
    const { position, angle } = body;

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(angle);

    const size = config.size * scale;
    const halfSize = size / 2;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = config.color;
    ctx.fillRect(-halfSize, -halfSize, size, size);

    ctx.restore();
  });
}

/**
 * Get the current cube count (for external checks)
 */
export function getCubeCount() {
  return cubes.length;
}

