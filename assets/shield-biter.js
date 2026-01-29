import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier2d-compat@0.14.0/+esm';

const PIXEL_STEP = 6;
const CUBE_SIZE = 6;
const BODY_GRID = 3;
const DARK_THRESHOLD = 30;
const IDLE_TIMEOUT = 5000;
const SPRING_K = 8;
const SPRING_DAMPING = 4;
const SETTLE_DIST = 1;
const SETTLE_VEL = 0.5;
const IMPULSE_STRENGTH = 10000;
const GRAVITY_Y = 9.81;

export async function init(canvas) {
  await RAPIER.init();

  const ctx = canvas.getContext('2d');
  let width, height;

  const pixels = await extractPixels('/shield-biter.png');
  if (!pixels.length) return;

  // Precompute pixel grid bounds (static, never changes)
  const minCol = pixels.reduce((m, p) => Math.min(m, p.col), Infinity);
  const minRow = pixels.reduce((m, p) => Math.min(m, p.row), Infinity);
  const maxCol = pixels.reduce((m, p) => Math.max(m, p.col), 0);
  const maxRow = pixels.reduce((m, p) => Math.max(m, p.row), 0);
  const imgW = maxCol - minCol + 1;
  const imgH = maxRow - minRow + 1;
  const totalW = imgW * CUBE_SIZE;
  const totalH = imgH * CUBE_SIZE;

  const world = new RAPIER.World({ x: 0, y: 0 });
  let gravityOn = false;

  let bodies = [];
  let floorBody = null;
  let wallBodies = [];
  let groundY = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    rebuildBodies();
  }

  function rebuildBodies() {
    for (const b of bodies) world.removeRigidBody(b.body);
    if (floorBody) world.removeRigidBody(floorBody);
    for (const w of wallBodies) world.removeRigidBody(w);
    bodies = [];
    floorBody = null;
    wallBodies = [];

    const main = document.querySelector('main');
    const mainRect = main.getBoundingClientRect();
    const mobile = width <= 768;

    let offsetX, offsetY, scale, cubeSize;

    if (mobile) {
      const topY = mainRect.bottom + 16;
      const availH = height * 0.9 - topY;
      scale = Math.min((width * 0.7) / totalW, availH / totalH, 1);
      cubeSize = CUBE_SIZE * scale;
      offsetX = mainRect.left;
      offsetY = topY;
    } else {
      const topY = mainRect.top;
      const availH = height * 0.8;
      scale = Math.min((width * 0.4) / totalW, availH / totalH, 1);
      cubeSize = CUBE_SIZE * scale;
      offsetX = width - imgW * cubeSize - 40;
      offsetY = topY;
    }

    groundY = offsetY + imgH * cubeSize;

    // Group pixels into body clusters
    const clusters = new Map();
    for (const p of pixels) {
      const adjCol = p.col - minCol;
      const adjRow = p.row - minRow;
      const bCol = Math.floor(adjCol / BODY_GRID);
      const bRow = Math.floor(adjRow / BODY_GRID);
      const key = `${bCol},${bRow}`;
      if (!clusters.has(key)) clusters.set(key, { bCol, bRow, pixels: [] });
      clusters.get(key).pixels.push({ ...p, adjCol, adjRow });
    }

    for (const [, cluster] of clusters) {
      const cx = offsetX + (cluster.bCol * BODY_GRID + BODY_GRID / 2) * cubeSize;
      const cy = offsetY + (cluster.bRow * BODY_GRID + BODY_GRID / 2) * cubeSize;

      const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(cx, cy);
      const body = world.createRigidBody(bodyDesc);

      const halfCluster = (BODY_GRID * cubeSize) / 2;
      const colliderDesc = RAPIER.ColliderDesc.cuboid(halfCluster, halfCluster)
        .setRestitution(0.3)
        .setFriction(0.5)
        .setDensity(0.5)
        .setCollisionGroups(0x0001FFFF);
      world.createCollider(colliderDesc, body);

      const cubes = cluster.pixels.map(p => ({
        color: p.color,
        offX: (offsetX + p.adjCol * cubeSize + cubeSize / 2) - cx,
        offY: (offsetY + p.adjRow * cubeSize + cubeSize / 2) - cy,
        size: cubeSize
      }));

      bodies.push({ body, cubes, homeX: cx, homeY: cy });
    }

    // Floor at ground line
    const fd = RAPIER.RigidBodyDesc.fixed().setTranslation(width / 2, groundY + 10);
    floorBody = world.createRigidBody(fd);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(width, 10).setCollisionGroups(0x0002FFFF),
      floorBody
    );

    // Walls
    const wl = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-10, height / 2));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(10, height).setCollisionGroups(0x0002FFFF),
      wl
    );
    wallBodies.push(wl);
    const wr = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(width + 10, height / 2));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(10, height).setCollisionGroups(0x0002FFFF),
      wr
    );
    wallBodies.push(wr);
  }

  function setCubeCollisions(collideWithCubes) {
    const filter = collideWithCubes ? 0x0001FFFF : 0x00010002;
    for (const b of bodies) {
      const numColliders = b.body.numColliders();
      for (let i = 0; i < numColliders; i++) {
        b.body.collider(i).setCollisionGroups(filter);
      }
    }
  }

  let lastClickTime = 0;
  let reforming = false;

  document.addEventListener('pointerdown', (e) => {
    if (!gravityOn) {
      gravityOn = true;
      world.gravity = { x: 0, y: GRAVITY_Y * 80 };
    }

    const cx = e.clientX;
    const cy = e.clientY;
    const screenScale = Math.min(width, 1200) / 1200;

    for (const b of bodies) {
      if (b.body.bodyType() !== RAPIER.RigidBodyType.Dynamic) {
        b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        b.body.setLinearDamping(0.1);
      }
      const pos = b.body.translation();
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const strength = IMPULSE_STRENGTH * 80 * screenScale / Math.max(dist, 50);
      b.body.applyImpulse({ x: dx / dist * strength, y: dy / dist * strength }, true);
    }

    reforming = false;
    setCubeCollisions(true);
    lastClickTime = performance.now();
  });

  window.addEventListener('resize', () => {
    resize();
    gravityOn = false;
    reforming = false;
    lastClickTime = 0;
    world.gravity = { x: 0, y: 0 };
  });

  resize();

  let lastTime = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (reforming) {
      let allSettled = true;
      for (const b of bodies) {
        const pos = b.body.translation();
        const vel = b.body.linvel();
        const dx = b.homeX - pos.x;
        const dy = b.homeY - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const fx = SPRING_K * dx - SPRING_DAMPING * vel.x;
        const fy = SPRING_K * dy - SPRING_DAMPING * vel.y;
        b.body.applyImpulse({ x: fx * dt * 60, y: fy * dt * 60 }, true);

        const ang = b.body.rotation();
        const angvel = b.body.angvel();
        b.body.applyTorqueImpulse((-SPRING_K * ang - SPRING_DAMPING * angvel) * dt * 60, true);

        if (dist > SETTLE_DIST || Math.abs(vel.x) > SETTLE_VEL || Math.abs(vel.y) > SETTLE_VEL) {
          allSettled = false;
        }
      }

      if (allSettled) {
        for (const b of bodies) {
          b.body.setTranslation({ x: b.homeX, y: b.homeY }, true);
          b.body.setLinvel({ x: 0, y: 0 }, true);
          b.body.setAngvel(0, true);
          b.body.setRotation(0, true);
          b.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        }
        reforming = false;
        gravityOn = false;
        world.gravity = { x: 0, y: 0 };
      }
    }

    world.step();

    // Reform 5s after last click
    if (!reforming && gravityOn && lastClickTime > 0 && now - lastClickTime > IDLE_TIMEOUT) {
      reforming = true;
      gravityOn = false;
      world.gravity = { x: 0, y: 0 };
      setCubeCollisions(false);
      for (const b of bodies) {
        if (b.body.bodyType() !== RAPIER.RigidBodyType.Dynamic) {
          b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        }
      }
    }

    // Render
    ctx.clearRect(0, 0, width, height);

    // Ground line
    ctx.strokeStyle = 'rgba(184,139,90,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    for (const b of bodies) {
      const pos = b.body.translation();
      const rot = b.body.rotation();
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      for (const c of b.cubes) {
        const wx = pos.x + c.offX * cos - c.offY * sin;
        const wy = pos.y + c.offX * sin + c.offY * cos;
        const half = c.size / 2;
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-half, -half, c.size, c.size);
        ctx.restore();
      }
    }
  }

  requestAnimationFrame(loop);
}

async function extractPixels(src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = src;
  });

  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;

  const pixels = [];
  for (let y = 0; y < img.height; y += PIXEL_STEP) {
    for (let x = 0; x < img.width; x += PIXEL_STEP) {
      const i = (y * img.width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 128) continue;
      if (r + g + b < DARK_THRESHOLD) continue;
      pixels.push({
        col: x / PIXEL_STEP,
        row: y / PIXEL_STEP,
        color: `rgb(${r},${g},${b})`
      });
    }
  }
  return pixels;
}
