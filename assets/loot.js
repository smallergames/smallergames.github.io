/**
 * Loot System
 *
 * Loot drops directly to footer inventory with pixel trails and glitch effects.
 */

import { spawnParticles } from './particles.js';

// Tier definitions - tier number determines rarity (1 = rarest, 7 = most common)
const TIER_TRASH = 7;
const TIER_ZZZ = 6;

const LOOT_TIERS = {
  [TIER_TRASH]: { name: 'TRASH', color: '#888' },
  [TIER_ZZZ]: { name: 'ZZZ', color: '#aaa' },
  5: { name: 'DECENT', color: '#4ade80' },
  4: { name: 'DOPE', color: '#60a5fa' },
  3: { name: 'BASED', color: '#c084fc' },
  2: { name: 'SHEESH', color: '#fb923c' },
  1: { name: 'JAWESOME', color: '#00f0ff' }
};

export { TIER_TRASH, TIER_ZZZ };

// Drop quantity range [min, max]
const DROP_COUNT = [3, 5];

// Rarity weights per die (percentages for each tier 1-7)
// Lower dice heavily favor trash, rare items require higher dice
const RARITY_WEIGHTS = {
  4:   { 1: 0.5,  2: 1,    3: 3,    4: 8,    5: 15,   6: 25,   7: 47.5 },
  6:   { 1: 1,    2: 2,    3: 5,    4: 10,   5: 17,   6: 25,   7: 40 },
  8:   { 1: 2,    2: 3,    3: 7,    4: 13,   5: 20,   6: 25,   7: 30 },
  10:  { 1: 3,    2: 5,    3: 10,   4: 16,   5: 22,   6: 24,   7: 20 },
  12:  { 1: 4,    2: 7,    3: 12,   4: 18,   5: 23,   6: 21,   7: 15 },
  20:  { 1: 6,    2: 9,    3: 14,   4: 20,   5: 22,   6: 17,   7: 12 },
  100: { 1: 10,   2: 12,   3: 16,   4: 20,   5: 18,   6: 14,   7: 10 }
};

// Timing
const DROP_INTERVAL_MS = 200; // Uniform rate for each drop
const PIXEL_TRAVEL_MS = 400; // How long pixel takes to reach inventory
const COLOR_FADE_MS = 5000; // How long color stays before fading to grey

// State
let collectedLoot = {}; // { tier: count }
let dropsInFlight = 0; // Counter for animations in progress
let lootQueue = []; // Queue for pending loot drops { dieSize, originX, originY }
let hasCollectedAll = false;

// DOM elements
let footerLabel = null;
let pixelContainer = null;
let announcements = null;

export function initLoot() {
  footerLabel = document.getElementById('footerLabel');
  announcements = document.getElementById('announcements');

  // Create pixel container if it doesn't exist
  pixelContainer = document.querySelector('.loot-pixels');
  if (!pixelContainer) {
    pixelContainer = document.createElement('div');
    pixelContainer.className = 'loot-pixels';
    document.body.appendChild(pixelContainer);
  }

  renderLabel();
}

function announce(message) {
  if (!announcements) return;
  announcements.textContent = message;
  setTimeout(() => {
    if (announcements.textContent === message) {
      announcements.textContent = '';
    }
  }, 1000);
}

function checkWinCondition() {
  if (hasCollectedAll) return;

  const allTiersCollected = [1, 2, 3, 4, 5, 6, 7].every(tier => collectedLoot[tier] > 0);
  if (allTiersCollected) {
    hasCollectedAll = true;
    celebrateWin();
  }
}

function celebrateWin() {
  if (!footerLabel) return;

  announce('All loot tiers collected!');

  // Spawn particle bursts at footer location
  const rect = footerLabel.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Multiple bursts with slight delays for dramatic effect
  spawnParticles(centerX, centerY);
  setTimeout(() => spawnParticles(centerX - 50, centerY), 100);
  setTimeout(() => spawnParticles(centerX + 50, centerY), 200);

  // Add win effect
  footerLabel.classList.add('win-reveal');
}

// No longer exported - spawnLoot handles queuing internally

function rollTier(dieSize) {
  const weights = RARITY_WEIGHTS[dieSize] || RARITY_WEIGHTS[20];
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (let tier = 1; tier <= 7; tier++) {
    cumulative += weights[tier];
    if (roll < cumulative) {
      return tier;
    }
  }
  return 7;
}

function getDropCount() {
  const [min, max] = DROP_COUNT;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function spawnLoot(dieSize, originX, originY) {
  // Queue loot if drops are in flight
  if (dropsInFlight > 0) {
    lootQueue.push({ dieSize, originX, originY });
    return;
  }

  processLootDrop(dieSize, originX, originY);
}

export function spawnConsolationLoot(originX, originY) {
  // 1-3 trash guaranteed, 25% chance for 1 zzz
  const trashCount = 1 + Math.floor(Math.random() * 3);
  const includeZzz = Math.random() < 0.25;
  
  const drops = [];
  for (let i = 0; i < trashCount; i++) {
    drops.push(TIER_TRASH);
  }
  if (includeZzz) {
    drops.push(TIER_ZZZ);
  }
  
  processDrops(drops, originX, originY);
  
  // Return best tier for UI feedback
  return includeZzz ? TIER_ZZZ : TIER_TRASH;
}

function processLootDrop(dieSize, originX, originY) {
  const dropCount = getDropCount();
  const drops = [];

  for (let i = 0; i < dropCount; i++) {
    drops.push(rollTier(dieSize));
  }

  processDrops(drops, originX, originY);
}

function processDrops(drops, originX, originY) {
  if (!footerLabel) initLoot();

  // Sort drops by tier (worst first, rarest last) for consistent animation order
  drops.sort((a, b) => b - a);

  // Stagger each drop at uniform rate
  drops.forEach((tier, index) => {
    setTimeout(() => {
      dropsInFlight++;

      const isNewDiscovery = !collectedLoot[tier];
      collectedLoot[tier] = (collectedLoot[tier] || 0) + 1;
      renderLabel();

      const tierEl = footerLabel.querySelector(`[data-tier="${tier}"]`);
      let destX, destY;

      if (tierEl) {
        const tierRect = tierEl.getBoundingClientRect();
        destX = tierRect.left + tierRect.width / 2;
        destY = tierRect.top + tierRect.height / 2;
      } else {
        const footerRect = footerLabel.getBoundingClientRect();
        destX = footerRect.left + footerRect.width / 2;
        destY = footerRect.top;
      }

      spawnPixelTrail(tier, originX, originY, destX, destY);

      setTimeout(() => {
        glitchTier(tier);
        energizeTier(tier);
        if (isNewDiscovery) {
          announce(`Discovered ${LOOT_TIERS[tier].name}`);
        }
        checkWinCondition();

        dropsInFlight--;

        if (dropsInFlight === 0 && lootQueue.length > 0) {
          const next = lootQueue.shift();
          processLootDrop(next.dieSize, next.originX, next.originY);
        }
      }, PIXEL_TRAVEL_MS);
    }, index * DROP_INTERVAL_MS);
  });
}

function spawnPixelTrail(tier, startX, startY, endX, endY) {
  const tierData = LOOT_TIERS[tier];
  const rawIntensity = 8 - tier; // 1 for trash, 7 for jawesome
  const intensity = rawIntensity + 3; // Floor boost: 4 for trash, 10 for jawesome

  // Rarer = bigger pixel (8px for trash, 20px for jawesome)
  const pixelSize = 6 + intensity;

  // Rarer = more pixels in cluster (1 for trash, up to 5 for jawesome)
  const pixelCount = Math.ceil(intensity / 1.5);

  // Rarer = longer travel time for more drama
  const travelTime = PIXEL_TRAVEL_MS + (intensity * 30);

  for (let i = 0; i < pixelCount; i++) {
    const delay = i * 30; // Stagger cluster
    const offsetX = (Math.random() - 0.5) * intensity * 8;
    const offsetY = (Math.random() - 0.5) * intensity * 8;
    const sizeVariation = pixelSize * (0.6 + Math.random() * 0.4);

    setTimeout(() => {
      const pixel = document.createElement('div');
      pixel.className = 'loot-pixel';
      if (rawIntensity >= 4) pixel.classList.add('trailing'); // Add trail for DOPE+

      pixel.style.setProperty('--loot-color', tierData.color);
      pixel.style.setProperty('--start-x', `${startX + offsetX}px`);
      pixel.style.setProperty('--start-y', `${startY + offsetY}px`);
      pixel.style.setProperty('--end-x', `${endX}px`);
      pixel.style.setProperty('--end-y', `${endY}px`);
      pixel.style.setProperty('--travel-time', `${travelTime}ms`);
      pixel.style.setProperty('--pixel-size', `${sizeVariation}px`);
      pixel.style.setProperty('--glow-size', `${intensity * 3}px`);

      pixelContainer.appendChild(pixel);

      // Remove after animation
      setTimeout(() => pixel.remove(), travelTime + 50);
    }, delay);
  }

  // Spawn burst particles on arrival for rare items (DECENT and above)
  if (rawIntensity >= 3) {
    setTimeout(() => {
      spawnLandingBurst(tier, endX, endY);
    }, travelTime - 50);
  }
}

function spawnLandingBurst(tier, x, y) {
  const tierData = LOOT_TIERS[tier];
  const intensity = 8 - tier;
  const burstCount = 4 + intensity * 2;

  for (let i = 0; i < burstCount; i++) {
    const angle = (Math.PI * 2 * i) / burstCount + Math.random() * 0.5;
    const distance = 20 + intensity * 8;
    const size = 2 + Math.random() * intensity;

    // Pre-compute end position
    const endX = x + Math.cos(angle) * distance;
    const endY = y + Math.sin(angle) * distance;

    const particle = document.createElement('div');
    particle.className = 'loot-burst';
    particle.style.setProperty('--loot-color', tierData.color);
    particle.style.setProperty('--start-x', `${x}px`);
    particle.style.setProperty('--start-y', `${y}px`);
    particle.style.setProperty('--end-x', `${endX}px`);
    particle.style.setProperty('--end-y', `${endY}px`);
    particle.style.setProperty('--size', `${size}px`);
    particle.style.setProperty('--duration', `${300 + Math.random() * 200}ms`);

    pixelContainer.appendChild(particle);

    setTimeout(() => particle.remove(), 600);
  }
}

function energizeTier(tier) {
  const tierEl = footerLabel.querySelector(`[data-tier="${tier}"]`);
  if (!tierEl) return;

  const rawIntensity = 8 - tier;
  const intensity = rawIntensity + 3; // Floor boost: 4 for trash, 10 for jawesome

  // Rarer = longer color retention (4s for trash, 13s for jawesome)
  const fadeDuration = 2500 + (intensity * 1000);

  // Reset any existing fade
  tierEl.classList.remove('energized');
  void tierEl.offsetWidth; // Force reflow

  // Add energized class for full color + glow
  tierEl.classList.add('energized');
  tierEl.style.setProperty('--fade-duration', `${fadeDuration}ms`);
  tierEl.style.setProperty('--glow-intensity', intensity);

  // Start fade after a brief moment (let the color "land")
  setTimeout(() => {
    tierEl.classList.remove('energized');
  }, 50);
}

function glitchTier(tier) {
  const tierEl = footerLabel.querySelector(`[data-tier="${tier}"]`);
  if (!tierEl) return;

  // Rarer tiers (lower number) get more intense glitch
  const rawIntensity = 8 - tier;
  const intensity = rawIntensity + 3; // Floor boost: 4 for trash, 10 for jawesome
  tierEl.style.setProperty('--glitch-intensity', intensity);
  tierEl.classList.add('glitch');

  const duration = 150 + (intensity * 50); // 200ms for trash, 500ms for jawesome
  setTimeout(() => tierEl.classList.remove('glitch'), duration);
}

function renderLabel() {
  if (!footerLabel) return;

  const tierOrder = [7, 6, 5, 4, 3, 2, 1];

  // Build discovered tier entries (sorted: trash first, jawesome last)
  const discoveredEntries = tierOrder
    .filter(tier => collectedLoot[tier] > 0)
    .map(tier => {
      const tierData = LOOT_TIERS[tier];
      const count = collectedLoot[tier];
      return `<span class="loot-tier" data-tier="${tier}" style="--loot-color: ${tierData.color}">${tierData.name}: ${count}</span>`;
    });

  footerLabel.innerHTML = discoveredEntries.join('<span class="loot-separator">|</span>');
}
