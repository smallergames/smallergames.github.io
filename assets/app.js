/**
 * Dice Roller Application
 *
 * A simple tabletop dice roller supporting d4, d6, d8, d10, d12, d20, and d100.
 * Features an energy bar system where clicks add energy and the die rolls until depleted.
 */

import { initParticles, spawnParticles, spawnSparkles } from './particles.js';
import { initLoot, spawnLoot, hasLootOnGround, incrementChargedRolls } from './loot.js';

const DIE_SHAPES = {
  4: { viewBox: '-50 -50 100 100', shape: '<polygon points="0,-50 -45,25 45,25" />' },
  6: { viewBox: '0 0 100 100', shape: '<rect x="10" y="10" width="80" height="80" rx="4" />' },
  8: { viewBox: '0 0 100 100', shape: '<polygon points="50,10 90,50 50,90 10,50" />' },
  10: { viewBox: '0 0 100 100', shape: '<polygon points="50,10 82,28 90,58 50,90 10,58 18,28" />' },
  12: { viewBox: '0 0 100 100', shape: '<polygon points="50,10 78,18 92,42 82,75 50,90 18,75 8,42 22,18" />' },
  20: { viewBox: '0 0 100 100', shape: '<polygon points="50,8 90,28 90,72 50,92 10,72 10,28" />' },
  100: { viewBox: '0 0 100 100', shape: '<polygon points="50,6 79,13 95,38 95,62 79,87 50,94 21,87 5,62 5,38 21,13" />' }
};

function buildDieMarkup(shapeConfig) {
  const { shape } = shapeConfig;
  return shape;
}

const diceSelection = document.querySelector('.dice-selection');
const dieButtons = document.querySelectorAll('[data-die]');
const dieContainer = document.getElementById('dieContainer');
const dieSvg = document.getElementById('dieSvg');
const resultDisplay = document.getElementById('result');
const announcements = document.getElementById('announcements');

let currentDie = 4;
let isRolling = false;
let announceTimeout = null;
let pendingFinish = null; // stores {result, rolledDie} when waiting for animation cycle to end

const MAX_ENERGY_MS = 2000;
const ENERGY_PER_CLICK_MS = 450;
const ENERGY_FILL_RATE_MS = 50;
let energy = 0;
let energyDrainFrame = null;
let isHolding = false;
let holdInterval = null;

// Boost system - when power meter is full, dice max is increased by 1
let isBoosted = false;
let boostedMax = null; // The max+1 value when boosted
let sparkleInterval = null; // Interval for boost sparkle effect
let overchargedTimeout = null; // Timeout for overcharged effect duration
let overchargedSettleFrame = null; // Animation frame for settling effect

function isOvercharged() {
  return isBoosted;
}

function initDieButtons() {
  dieButtons.forEach(btn => {
    btn.addEventListener('click', () => selectDie(btn));
  });
}

let isDraggingDice = false;
let hasDraggedSinceDiceDown = false;
let lastArrowKeyTime = 0;
let keyHoldInterval = null;
const HOLD_INTERVAL_MS = 500;


function handleDicePointerDown(event) {
  if (isOvercharged()) return;
  isDraggingDice = true;
  hasDraggedSinceDiceDown = false;
  diceSelection.setPointerCapture(event.pointerId);
}

function findDieButtonAt(x) {
  const containerRect = diceSelection.getBoundingClientRect();
  const relativeX = x - containerRect.left;
  
  let closestBtn = null;
  let closestDist = Infinity;
  
  dieButtons.forEach(btn => {
    const btnRect = btn.getBoundingClientRect();
    const btnCenter = btnRect.left + btnRect.width / 2 - containerRect.left;
    const dist = Math.abs(relativeX - btnCenter);
    if (dist < closestDist) {
      closestDist = dist;
      closestBtn = btn;
    }
  });
  
  return closestBtn;
}

function handleDicePointerMove(event) {
  if (!isDraggingDice) return;
  
  hasDraggedSinceDiceDown = true;
  const closestBtn = findDieButtonAt(event.clientX);
  
  if (closestBtn && closestBtn.getAttribute('aria-checked') !== 'true') {
    selectDie(closestBtn);
  }
}

function handleDicePointerUp(event) {
  if (!isDraggingDice) return;
  isDraggingDice = false;
  diceSelection.releasePointerCapture(event.pointerId);

  if (isOvercharged()) return;

  if (!hasDraggedSinceDiceDown) {
    const closestBtn = findDieButtonAt(event.clientX);
    if (closestBtn) {
      const sides = parseInt(closestBtn.dataset.die, 10);
      if (sides === currentDie) {
        // Clicking on already-selected die triggers a roll
        addEnergy(ENERGY_PER_CLICK_MS);
      } else {
        selectDie(closestBtn);
      }
    }
  }
}

function updateIndicator(button) {
  const containerRect = diceSelection.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const left = buttonRect.left - containerRect.left - 4; // 4px padding offset
  const width = buttonRect.width;

  diceSelection.style.setProperty('--indicator-left', `${left}px`);
  diceSelection.style.setProperty('--indicator-width', `${width}px`);
}

function selectDie(selectedButton) {
  if (isOvercharged()) return;
  const sides = parseInt(selectedButton.dataset.die, 10);
  if (!DIE_SHAPES[sides]) return;
  if (sides === currentDie) return; // Already selected

  // Transfer boost state to new button if boosted
  const wasBoosted = isBoosted;
  if (wasBoosted) {
    deactivateBoost(); // Remove from old button
  }

  dieButtons.forEach(btn => btn.setAttribute('aria-checked', 'false'));
  selectedButton.setAttribute('aria-checked', 'true');
  updateIndicator(selectedButton);

  currentDie = sides;
  updateDieShape(currentDie);
  clearResult();
  pendingFinish = null; // Cancel any pending result from old die

  // Recalculate and reactivate boost for new die
  if (wasBoosted) {
    boostedMax = currentDie + 1;
    isBoosted = true;
    selectedButton.textContent = `d${boostedMax}`;
    selectedButton.classList.add('boosted');
    
    // Restart sparkle effect on new button
    if (sparkleInterval) clearInterval(sparkleInterval);
    sparkleInterval = setInterval(() => {
      const btn = document.querySelector('[data-die][aria-checked="true"]');
      if (btn) {
        const r = btn.getBoundingClientRect();
        spawnSparkles(r.left + r.width / 2, r.top + r.height / 2);
      }
    }, 150);
  }
  
  announce(`Selected ${currentDie}-sided die`);

  // Kick off a new roll when switching dice via slider (if not already rolling)
  if (!isRolling) {
    addEnergy(ENERGY_PER_CLICK_MS);
  }
}

function updateDieShape(sides) {
  const shape = DIE_SHAPES[sides];
  if (!shape) return;
  dieSvg.setAttribute('viewBox', shape.viewBox);
  dieSvg.innerHTML = buildDieMarkup(shape);
  dieContainer.classList.toggle('d4', sides === 4);
  dieContainer.classList.toggle('d100', sides === 100);
}

function clearResult() {
  resultDisplay.classList.remove('show');
  resultDisplay.textContent = '';
  clearOverchargedState();
}

function clearOverchargedState() {
  if (overchargedTimeout) {
    clearTimeout(overchargedTimeout);
    overchargedTimeout = null;
  }
  if (overchargedSettleFrame) {
    cancelAnimationFrame(overchargedSettleFrame);
    overchargedSettleFrame = null;
  }
  dieContainer.classList.remove('overcharged');
  const magentaOutline = document.querySelector('.die-shape svg.magenta-outline');
  const whiteOutline = document.querySelector('.die-shape svg.white-outline');
  if (magentaOutline) {
    magentaOutline.remove();
  }
  if (whiteOutline) {
    whiteOutline.remove();
  }

  // Clear boost after overcharged effect has settled
  deactivateBoost();
  boostedMax = null;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function announce(message) {
  if (announceTimeout) {
    clearTimeout(announceTimeout);
  }
  announcements.textContent = message;
  announceTimeout = setTimeout(() => { 
    announcements.textContent = ''; 
    announceTimeout = null;
  }, 1000);
}

function stopEnergySystem() {
  if (energyDrainFrame) {
    cancelAnimationFrame(energyDrainFrame);
    energyDrainFrame = null;
  }
  if (holdInterval) {
    clearInterval(holdInterval);
    holdInterval = null;
  }
  pendingFinish = null;
  isHolding = false;
  energy = 0;

  // Clear boost state
  deactivateBoost();
  boostedMax = null;

  // Clear overcharged state
  clearOverchargedState();

  updateEnergyLevel();

  if (isRolling) {
    dieContainer.classList.remove('rolling');
    isRolling = false;
  }
}

function updateEnergyLevel() {
  const level = energy / MAX_ENERGY_MS;
  diceSelection.style.setProperty('--energy-level', level);
}

function activateBoost() {
  if (isBoosted) return; // Already boosted

  isBoosted = true;
  const selectedBtn = document.querySelector('[data-die][aria-checked="true"]');
  if (!selectedBtn) return;

  // Calculate boosted max (die value + 1)
  boostedMax = currentDie + 1;

  // Update button text to show boosted value
  selectedBtn.textContent = `d${boostedMax}`;
  selectedBtn.classList.add('boosted');

  // Spawn glitch particles on overload
  const rect = selectedBtn.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  spawnParticles(centerX, centerY, currentDie);

  // Start sparkle effect
  sparkleInterval = setInterval(() => {
    const btn = document.querySelector('[data-die][aria-checked="true"]');
    if (btn) {
      const r = btn.getBoundingClientRect();
      spawnSparkles(r.left + r.width / 2, r.top + r.height / 2);
    }
  }, 150);
}

function deactivateBoost() {
  if (!isBoosted) return;

  isBoosted = false;

  // Stop sparkle effect
  if (sparkleInterval) {
    clearInterval(sparkleInterval);
    sparkleInterval = null;
  }

  const selectedBtn = document.querySelector('[data-die][aria-checked="true"]');
  if (selectedBtn) {
    selectedBtn.textContent = `d${currentDie}`;
    selectedBtn.classList.remove('boosted');
  }
}

function addEnergy(amount) {
  if (isOvercharged()) return;
  energy = Math.min(energy + amount, MAX_ENERGY_MS);
  updateEnergyLevel();

  // Activate boost when energy hits max (boost stays until roll completes)
  if (energy >= MAX_ENERGY_MS) {
    activateBoost();
  }

  if (!energyDrainFrame) {
    startEnergyDrain();
  }

  if (!isRolling) {
    clearResult();
    startContinuousRoll();
  }
}

const HOLD_DRAIN_RATE = 0.1;
const RELEASE_DRAIN_RATE = 1.5;

function startEnergyDrain() {
  let lastTime = performance.now();
  
  function drain() {
    const now = performance.now();
    const delta = now - lastTime;
    lastTime = now;
    
    const drainAmount = delta * (isHolding && !isOvercharged() ? HOLD_DRAIN_RATE : RELEASE_DRAIN_RATE);
    energy = Math.max(0, energy - drainAmount);
    updateEnergyLevel();
    
    if (energy <= 0) {
      energyDrainFrame = null;
      finishRoll();
      return;
    }
    
    energyDrainFrame = requestAnimationFrame(drain);
  }
  
  energyDrainFrame = requestAnimationFrame(drain);
}

function startContinuousRoll() {
  isRolling = true;
  pendingFinish = null; // Cancel any pending finish if user adds more energy
  dieContainer.classList.add('rolling');
  resultDisplay.classList.remove('show');
}

function finishRoll() {
  // Use boosted max if power was full when roll started
  const effectiveMax = boostedMax || currentDie;
  const result = randomInt(1, effectiveMax);
  const rolledDie = effectiveMax;

  // Store pending finish - will complete when animation cycle ends
  pendingFinish = { result, rolledDie };
  isRolling = false;
}

function completeRollFinish({ result, rolledDie }) {
  resultDisplay.textContent = result;
  dieContainer.classList.remove('rolling');
  resultDisplay.classList.add('show');

  // Track charged rolls (any roll with full energy bar)
  if (rolledDie > currentDie) {
    incrementChargedRolls();
  }

  // Spawn glitch particle explosion and add overcharged effect if result is in overload range
  if (result > currentDie) {
    const rect = dieContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    spawnParticles(centerX, centerY, currentDie);

    // Spawn loot
    if (!hasLootOnGround()) {
      spawnLoot(currentDie, centerX, centerY);
    }

    // Add triple wiggling outlines effect
    dieContainer.classList.add('overcharged');
    const magentaOutline = dieSvg.cloneNode(true);
    magentaOutline.classList.add('magenta-outline');
    magentaOutline.removeAttribute('id');
    dieSvg.parentElement.appendChild(magentaOutline);

    const whiteOutline = dieSvg.cloneNode(true);
    whiteOutline.classList.add('white-outline');
    whiteOutline.removeAttribute('id');
    dieSvg.parentElement.appendChild(whiteOutline);

    // Animate settling: burst starts strong, gradually settles to rest
    const duration = 3000;
    const startTime = performance.now();
    const startWiggle = 15; // degrees at burst
    const allOutlines = [dieSvg, magentaOutline, whiteOutline];

    function animateSettle(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out - fast decay at start, slow settle at end
      const wiggle = startWiggle * Math.pow(1 - progress, 2);

      allOutlines.forEach(svg => {
        svg.style.setProperty('--wiggle-amount', `${wiggle}deg`);
      });

      if (progress < 1) {
        overchargedSettleFrame = requestAnimationFrame(animateSettle);
      } else {
        clearOverchargedState();
      }
    }

    overchargedSettleFrame = requestAnimationFrame(animateSettle);
  }

  dieContainer.setAttribute(
    'aria-label',
    `Rolled ${result} on d${rolledDie}. Click or press Space/Enter to roll again`
  );

  announce(`Rolled ${result} on d${rolledDie}`);

  // Clear boost for next roll (delay if overcharged to let effect settle)
  if (result <= currentDie) {
    deactivateBoost();
    boostedMax = null;
  }
}

// Handle animation cycle completion - fires exactly when animation reaches 100%
dieSvg.addEventListener('animationiteration', () => {
  if (pendingFinish) {
    const finish = pendingFinish;
    pendingFinish = null;
    completeRollFinish(finish);
  }
});

function handlePointerDown(event) {
  if (event.button && event.button !== 0) return;
  if (isOvercharged()) return;

  dieContainer.setPointerCapture(event.pointerId);
  isHolding = true;
  addEnergy(ENERGY_PER_CLICK_MS);

  holdInterval = setInterval(() => {
    if (isHolding) {
      addEnergy(ENERGY_PER_CLICK_MS);
    }
  }, HOLD_INTERVAL_MS);
}

function handlePointerUp(event) {
  if (event.pointerId !== undefined) {
    dieContainer.releasePointerCapture(event.pointerId);
  }
  isHolding = false;
  if (holdInterval) {
    clearInterval(holdInterval);
    holdInterval = null;
  }
}

function handleKeydown(event) {
  if (event.code === 'Space' || event.code === 'Enter') {
    if (document.activeElement === document.body || document.activeElement === dieContainer) {
      event.preventDefault();
      if (isOvercharged()) return;

      if (!event.repeat) {
        isHolding = true;
        addEnergy(ENERGY_PER_CLICK_MS);
        keyHoldInterval = setInterval(() => {
          addEnergy(ENERGY_PER_CLICK_MS);
        }, HOLD_INTERVAL_MS);
      }
    }
  }

  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault();
    const now = performance.now();
    if (event.repeat && now - lastArrowKeyTime < HOLD_INTERVAL_MS) return;
    lastArrowKeyTime = now;

    // Clear focus from die buttons to prevent focus-visible outline staying behind
    if (document.activeElement && document.activeElement.classList.contains('die-btn')) {
      document.activeElement.blur();
    }

    isHolding = true;
    if (isOvercharged()) return;

    const currentIndex = Array.from(dieButtons).findIndex(btn => btn.getAttribute('aria-checked') === 'true');
    if (currentIndex === -1) return;

    const newIndex = event.code === 'ArrowLeft'
      ? currentIndex - 1
      : currentIndex + 1;

    if (newIndex < 0 || newIndex >= dieButtons.length) {
      diceSelection.classList.remove('bump-left', 'bump-right');
      void diceSelection.offsetWidth;
      diceSelection.classList.add(event.code === 'ArrowLeft' ? 'bump-left' : 'bump-right');
      addEnergy(ENERGY_PER_CLICK_MS);
      return;
    }
    selectDie(dieButtons[newIndex]);
  }
}

function handleKeyup(event) {
  if (event.code === 'Space' || event.code === 'Enter') {
    isHolding = false;
    if (keyHoldInterval) {
      clearInterval(keyHoldInterval);
      keyHoldInterval = null;
    }
  }

  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    isHolding = false;
  }
}

function initIndicator() {
  const selected = document.querySelector('[data-die][aria-checked="true"]');
  if (selected) {
    updateIndicator(selected);
  }
}

initDieButtons();
initParticles();
initLoot();

dieContainer.addEventListener('pointerdown', handlePointerDown);
dieContainer.addEventListener('pointerup', handlePointerUp);
dieContainer.addEventListener('pointercancel', handlePointerUp);
dieContainer.addEventListener('lostpointercapture', handlePointerUp);
diceSelection.addEventListener('pointerdown', handleDicePointerDown);
diceSelection.addEventListener('pointermove', handleDicePointerMove);
diceSelection.addEventListener('pointerup', handleDicePointerUp);
diceSelection.addEventListener('pointercancel', handleDicePointerUp);
document.addEventListener('keydown', handleKeydown);
document.addEventListener('keyup', handleKeyup);
window.addEventListener('resize', initIndicator);

initIndicator();
addEnergy(ENERGY_PER_CLICK_MS);

