/**
 * Loot System
 *
 * Determines loot drops and spawns physics cubes via the physics module.
 */

import { spawnCube } from './physics.js';

// Tier definitions - tier number determines rarity (1 = rarest, 7 = most common)
const TIER_TRASH = 7;
const TIER_ZZZ = 6;

const LOOT_TIERS = {
  [TIER_TRASH]: { name: 'TRASH', color: '#4a4a5a' },
  [TIER_ZZZ]: { name: 'ZZZ', color: '#5a5a6a' },
  5: { name: 'DECENT', color: '#e040fb' },
  4: { name: 'DOPE', color: '#00bfff' },
  3: { name: 'BASED', color: '#bf5fff' },
  2: { name: 'SHEESH', color: '#ff3366' },
  1: { name: 'JAWESOME', color: '#00f0ff' }
};

export { TIER_TRASH, TIER_ZZZ };

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

// Timing - scales based on drop count
const BASE_DROP_INTERVAL_MS = 150;
const MIN_DROP_INTERVAL_MS = 30;

// State
let dropsInFlight = 0; // Counter for animations in progress
let lootQueue = []; // Queue for pending loot drops { dieSize, originX, originY }

// DOM elements
let announcements = null;

export function initLoot() {
  announcements = document.getElementById('announcements');
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

export function spawnLoot(dieSize, rollResult, originX, originY) {
  // Queue loot if drops are in flight
  if (dropsInFlight > 0) {
    lootQueue.push({ dieSize, rollResult, originX, originY });
    return;
  }

  processLootDrop(dieSize, rollResult, originX, originY);
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

function processLootDrop(dieSize, rollResult, originX, originY) {
  const drops = [];

  // Roll result = number of rolled drops
  for (let i = 0; i < rollResult; i++) {
    drops.push(rollTier(dieSize));
  }

  // Plus 1 guaranteed trash
  drops.push(TIER_TRASH);

  // Pity upgrade: if all loot is tier 6-7, upgrade the best one by 1
  const allTrash = drops.every(tier => tier >= TIER_ZZZ);
  if (allTrash) {
    const bestIndex = drops.indexOf(Math.min(...drops));
    drops[bestIndex] = drops[bestIndex] - 1;
  }

  processDrops(drops, originX, originY);
}

function processDrops(drops, originX, originY) {
  // Sort drops by tier (worst first, rarest last) for consistent animation order
  drops.sort((a, b) => b - a);

  // Find best tier for announcement
  const bestTier = Math.min(...drops);
  const tierData = LOOT_TIERS[bestTier];

  // Announce if we got something decent (tier 5 or better)
  if (bestTier <= 5) {
    announce(`${tierData.name}!`);
  }

  // Scale drop interval based on quantity (faster for large drops)
  const dropInterval = Math.max(
    MIN_DROP_INTERVAL_MS,
    BASE_DROP_INTERVAL_MS - drops.length * 1.2
  );

  // Stagger each drop
  drops.forEach((tier, index) => {
    setTimeout(() => {
      dropsInFlight++;

      // Spawn physics cube
      spawnCube(tier, originX, originY);

      // Mark drop as complete after a short delay
      setTimeout(() => {
        dropsInFlight--;

        if (dropsInFlight === 0 && lootQueue.length > 0) {
          const next = lootQueue.shift();
          processLootDrop(next.dieSize, next.rollResult, next.originX, next.originY);
        }
      }, 100);
    }, index * dropInterval);
  });
}
