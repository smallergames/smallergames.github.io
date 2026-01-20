/**
 * Dice Roller Application
 *
 * A simple tabletop dice roller supporting d4, d6, d8, d10, d12, d20, and d100.
 * Features an energy bar system where clicks add energy and the die rolls until depleted.
 */

import { initParticles, spawnParticles, spawnSparkles } from './particles.js';
import { initLoot, spawnLoot, spawnConsolationLoot, TIER_TRASH, TIER_ZZZ } from './loot.js';
import { initPhysics } from './physics.js';

// Motion warning for users with prefers-reduced-motion
const MOTION_WARNING_KEY = 'motion-warning-dismissed';
const motionWarning = document.getElementById('motionWarning');
const motionWarningDismiss = document.getElementById('motionWarningDismiss');

function checkMotionWarning() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let alreadyDismissed = false;
  try {
    alreadyDismissed = localStorage.getItem(MOTION_WARNING_KEY) === 'true';
  } catch (e) {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }

  if (prefersReducedMotion && !alreadyDismissed) {
    motionWarning.showModal();
    return true;
  }
  return false;
}

motionWarningDismiss.addEventListener('click', () => {
  try {
    localStorage.setItem(MOTION_WARNING_KEY, 'true');
  } catch (e) {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
  motionWarning.close();
  addEnergy(ENERGY_PER_CLICK_MS);
});


const DIE_SHAPES = {
  4: { viewBox: '-50 -50 100 100', shape: '<polygon points="0,-50 -45,25 45,25" />' },
  6: { viewBox: '0 0 100 100', shape: '<rect x="10" y="10" width="80" height="80" rx="4" />' },
  8: { viewBox: '0 0 100 100', shape: '<polygon points="50,10 90,50 50,90 10,50" />' },
  10: { viewBox: '0 0 100 100', shape: '<polygon points="50,10 82,28 90,58 50,90 10,58 18,28" />' },
  12: { viewBox: '0 0 100 100', shape: '<polygon points="50,10 78,18 92,42 82,75 50,90 18,75 8,42 22,18" />' },
  20: { viewBox: '0 0 100 100', shape: '<polygon points="50,8 90,28 90,72 50,92 10,72 10,28" />' },
  100: { viewBox: '0 0 100 100', shape: '<polygon points="50,6 79,13 95,38 95,62 79,87 50,94 21,87 5,62 5,38 21,13" />' }
};

const diceSelection = document.querySelector('.dice-selection');
const dieButtons = document.querySelectorAll('[data-die]');
const dieContainer = document.getElementById('dieContainer');
const dieSvg = document.getElementById('dieSvg');
const resultDisplay = document.getElementById('result');
const announcements = document.getElementById('announcements');
const energyLabel = document.querySelector('.energy-label');
const missLabel = document.querySelector('.state-item[data-state="loot-miss"]');

/**
 * Returns the currently selected die button element.
 * @returns {Element|null} The selected die button, or null if none selected
 */
function getSelectedDie() {
  return document.querySelector('[data-die][aria-checked="true"]');
}
// Game state machine - single source of truth
const GameState = {
  IDLE: 'idle',                    // No energy, waiting for input
  RAMPING: 'ramping',              // Building energy, die rolling
  RAMPED: 'ramped',                // Fully charged, +1 max active
  LOOT_RESOLUTION: 'loot_resolution' // Showing hit/miss result, input blocked
};

let gameState = GameState.IDLE;
let lootResult = null; // 'hit' or 'miss' during LOOT_RESOLUTION

// Valid state transitions
const validTransitions = {
  [GameState.IDLE]: [GameState.RAMPING],
  [GameState.RAMPING]: [GameState.IDLE, GameState.RAMPED],
  [GameState.RAMPED]: [GameState.RAMPING, GameState.LOOT_RESOLUTION],
  [GameState.LOOT_RESOLUTION]: [GameState.IDLE, GameState.RAMPING]
};

function setState(newState) {
  if (!validTransitions[gameState].includes(newState)) {
    console.error(`Invalid state transition: ${gameState} -> ${newState}`);
    return false;
  }

  const prevState = gameState;
  gameState = newState;
  updateVisuals(prevState, newState);
  return true;
}
let currentDie = 4;
let announceTimeout = null;
let pendingFinish = null; // stores {result, rolledDie} when waiting for animation cycle to end

// Energy system constants
const MAX_ENERGY_MS = 2000;           // Full charge threshold (triggers ramp)
const ENERGY_PER_CLICK_MS = 450;      // Energy added per click/tap
const HOLD_DRAIN_RATE = 0.1;          // Drain per ms while holding (slow - sustains charge)
const RELEASE_DRAIN_RATE = 1.5;       // Drain per ms after release (fast - forces decision)

// Win sequence timing
const WIN_SELECTOR_DURATION_MS = 400;  // How long selector stays highlighted before reverting
const WIN_LOOT_DELAY_MS = 950;         // Delay before loot flies to inventory
const MISS_FEEDBACK_MS = 800;          // How long miss state shows before returning to idle
const SETTLING_DURATION_MS = 3000;     // How long the settling wiggle animation runs
let energy = 0;
let energyDrainFrame = null;
let isHolding = false;
let holdInterval = null;

// Ramp system - rampedMax tracks the +1 value during RAMPED and LOOT_RESOLUTION states
let rampedMax = null;
let sparkleInterval = null; // Interval for ramp sparkle effect
let settlingTimeout = null; // Timeout for settling effect duration
let settlingAnimationFrame = null; // Animation frame for settling effect

function updateVisuals(prevState, newState) {
  const selectedBtn = getSelectedDie();

  // Map game state to energy label CSS state
  let labelState;
  if (newState === GameState.LOOT_RESOLUTION) {
    labelState = lootResult === 'hit' ? 'loot-hit' : 'loot-miss';
  } else if (newState === GameState.IDLE) {
    labelState = 'idle';
  } else if (newState === GameState.RAMPED) {
    labelState = 'ramped';
  } else {
    labelState = 'ramping';
  }
  if (energyLabel) {
    energyLabel.dataset.state = labelState;
  }

  // Ramped visual effects (sparkles, glow, d+1 label)
  const showRampedEffects = newState === GameState.RAMPED;
  diceSelection.classList.toggle('ramped', showRampedEffects);
  if (selectedBtn) {
    selectedBtn.classList.toggle('ramped', showRampedEffects);
    selectedBtn.textContent = showRampedEffects ? `d${rampedMax}` : `d${currentDie}`;
  }

  if (showRampedEffects) {
    startSparkles();
  } else {
    stopSparkles();
  }

  // Clear loot-resolution classes when leaving that state (adding is handled by runWinSequence)
  if (newState !== GameState.LOOT_RESOLUTION) {
    diceSelection.classList.remove('loot-resolution');
    dieContainer.classList.remove('loot-resolution');
  }

  // Rolling animation
  if (newState === GameState.RAMPING || newState === GameState.RAMPED) {
    if (prevState === GameState.IDLE || prevState === GameState.LOOT_RESOLUTION) {
      // Starting a new roll (from idle or interrupting a miss)
      dieContainer.classList.remove('ramping');
      void dieContainer.offsetWidth;
      dieContainer.classList.add('ramping');
      resultDisplay.classList.remove('show');
    }
  } else if (newState === GameState.IDLE || newState === GameState.LOOT_RESOLUTION) {
    dieContainer.classList.remove('ramping');
  }
}

function startSparkles() {
  if (sparkleInterval) return;
  sparkleInterval = setInterval(() => {
    const btn = getSelectedDie();
    if (btn) {
      const r = btn.getBoundingClientRect();
      spawnSparkles(r.left + r.width / 2, r.top + r.height / 2);
    }
  }, 150);
}

function stopSparkles() {
  if (sparkleInterval) {
    clearInterval(sparkleInterval);
    sparkleInterval = null;
  }
}

function canAcceptInput() {
  // Block input during loot hit animation, but allow during miss (try again)
  if (gameState === GameState.LOOT_RESOLUTION) {
    return lootResult === 'miss';
  }
  return true;
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
  if (!canAcceptInput()) return;
  isDraggingDice = true;
  hasDraggedSinceDiceDown = false;
  diceSelection.setPointerCapture(event.pointerId);
}

function findDieButtonAt(x) {
  const containerRect = diceSelection.getBoundingClientRect();
  const relativeX = x - containerRect.left;

  // Return null if pointer is significantly outside the container bounds
  const padding = 50;
  if (x < containerRect.left - padding || x > containerRect.right + padding) {
    return null;
  }

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
    addEnergy(ENERGY_PER_CLICK_MS);
  }
}

function endDiceDrag() {
  isDraggingDice = false;
  isHolding = false;
  if (holdInterval) {
    clearInterval(holdInterval);
    holdInterval = null;
  }
}

function handleDicePointerUp(event) {
  if (!isDraggingDice) return;
  
  const wasDrag = hasDraggedSinceDiceDown;
  endDiceDrag();
  diceSelection.releasePointerCapture(event.pointerId);

  if (!canAcceptInput()) return;

  if (!wasDrag) {
    const closestBtn = findDieButtonAt(event.clientX);
    if (closestBtn) {
      const sides = parseInt(closestBtn.dataset.die, 10);
      if (sides === currentDie) {
        addEnergy(ENERGY_PER_CLICK_MS);
      } else {
        selectDie(closestBtn);
      }
    }
  }
}

function handleDiceLostCapture() {
  endDiceDrag();
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
  if (!canAcceptInput()) return;
  const sides = parseInt(selectedButton.dataset.die, 10);
  if (!DIE_SHAPES[sides]) return;
  if (sides === currentDie) return; // Already selected

  // Changing dice while ramped -> fall back to RAMPING (loses +1 max)
  if (gameState === GameState.RAMPED) {
    rampedMax = null;
    setState(GameState.RAMPING);
  }

  dieButtons.forEach(btn => btn.setAttribute('aria-checked', 'false'));
  selectedButton.setAttribute('aria-checked', 'true');
  selectedButton.blur(); // Clear focus to prevent outline conflict with spacebar/enter
  updateIndicator(selectedButton);

  currentDie = sides;
  updateDieShape(currentDie);
  clearResult();

  // If there was a pending finish, cancel it and restart the roll
  // (energy may have hit 0 and drain stopped, so we need to add energy to continue)
  const hadPendingFinish = pendingFinish !== null;
  pendingFinish = null;

  announce(`Selected ${currentDie}-sided die`);

  // Kick off a new roll when switching dice, or restart if we cancelled a pending finish
  if (gameState === GameState.IDLE || hadPendingFinish) {
    addEnergy(ENERGY_PER_CLICK_MS);
  }
}

function updateDieShape(sides) {
  const shape = DIE_SHAPES[sides];
  if (!shape) return;
  dieSvg.setAttribute('viewBox', shape.viewBox);
  dieSvg.innerHTML = shape.shape;
  dieContainer.classList.toggle('d4', sides === 4);
  dieContainer.classList.toggle('d100', sides === 100);
}

function clearResult() {
  resultDisplay.classList.remove('show');
  resultDisplay.textContent = '';
  clearSettlingState();
}

function clearOutlineEffects() {
  if (settlingTimeout) {
    clearTimeout(settlingTimeout);
    settlingTimeout = null;
  }
  if (settlingAnimationFrame) {
    cancelAnimationFrame(settlingAnimationFrame);
    settlingAnimationFrame = null;
  }
  const magentaOutline = document.querySelector('.die-shape svg.magenta-outline');
  const whiteOutline = document.querySelector('.die-shape svg.white-outline');
  if (magentaOutline) magentaOutline.remove();
  if (whiteOutline) whiteOutline.remove();
}

function startSettlingAnimation(elements) {
  const startTime = performance.now();
  const startWiggle = 15;

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / SETTLING_DURATION_MS, 1);
    const wiggle = startWiggle * Math.pow(1 - progress, 2);

    elements.forEach(svg => {
      svg.style.setProperty('--wiggle-amount', `${wiggle}deg`);
    });

    if (progress < 1) {
      settlingAnimationFrame = requestAnimationFrame(animate);
    } else {
      clearSettlingState();
    }
  }

  settlingAnimationFrame = requestAnimationFrame(animate);
}

function clearSettlingState() {
  clearOutlineEffects();

  // Clear ramp value for next roll
  rampedMax = null;
  lootResult = null;

  // Transition to IDLE only if in LOOT_RESOLUTION
  if (gameState === GameState.LOOT_RESOLUTION) {
    setState(GameState.IDLE);
  }
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

function updateEnergyLevel() {
  const level = energy / MAX_ENERGY_MS;
  diceSelection.style.setProperty('--energy-level', level);
}

function addEnergy(amount) {
  if (!canAcceptInput()) return;

  const wasIdle = gameState === GameState.IDLE;
  energy = Math.min(energy + amount, MAX_ENERGY_MS);
  updateEnergyLevel();

  // Start energy drain if not already running
  if (!energyDrainFrame) {
    startEnergyDrain();
  }

  // Cancel any pending finish - user is adding more energy
  pendingFinish = null;

  // Handle state transitions
  if (wasIdle || (gameState === GameState.LOOT_RESOLUTION && lootResult === 'miss')) {
    // Starting fresh or interrupting a miss - clear result and enter RAMPING
    clearResult();
    setState(GameState.RAMPING);
  }

  // Check for RAMPING -> RAMPED transition when energy fills
  if (gameState === GameState.RAMPING && energy >= MAX_ENERGY_MS) {
    rampedMax = currentDie + 1;
    setState(GameState.RAMPED);

    // Spawn particles on ramp activation
    const selectedBtn = getSelectedDie();
    if (selectedBtn) {
      const rect = selectedBtn.getBoundingClientRect();
      spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }
}

function startEnergyDrain() {
  let lastTime = performance.now();

  function drain() {
    const now = performance.now();
    // Cap delta to 100ms to handle tab backgrounding gracefully
    const delta = Math.min(now - lastTime, 100);
    lastTime = now;

    const drainAmount = delta * (isHolding && canAcceptInput() ? HOLD_DRAIN_RATE : RELEASE_DRAIN_RATE);
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

function finishRoll() {
  // Use ramped max if power was full when roll started
  const effectiveMax = rampedMax || currentDie;
  const result = randomInt(1, effectiveMax);
  const rolledDie = effectiveMax;

  // Store pending finish - will complete when animation cycle ends
  // State transitions in completeRollFinish (RAMPED->LOOT_RESOLUTION, RAMPING->IDLE)
  pendingFinish = { result, rolledDie };
}

// Orchestrates the win sequence after a loot hit
function runWinSequence(centerX, centerY, die, rollResult) {
  const stateGuard = () => gameState === GameState.LOOT_RESOLUTION && lootResult === 'hit';

  // Immediate: Selector + die effects together
  diceSelection.classList.add('loot-resolution');
  dieContainer.classList.add('loot-resolution');
  spawnParticles(centerX, centerY);

  const magentaOutline = dieSvg.cloneNode(true);
  magentaOutline.classList.add('magenta-outline');
  magentaOutline.removeAttribute('id');
  dieSvg.parentElement.appendChild(magentaOutline);

  const whiteOutline = dieSvg.cloneNode(true);
  whiteOutline.classList.add('white-outline');
  whiteOutline.removeAttribute('id');
  dieSvg.parentElement.appendChild(whiteOutline);

  startSettlingAnimation([dieSvg, magentaOutline, whiteOutline]);

  // Selector reverts quickly so focus shifts to die
  setTimeout(() => {
    diceSelection.classList.remove('loot-resolution');
  }, WIN_SELECTOR_DURATION_MS);

  // Delayed: Loot flies to inventory
  setTimeout(() => {
    if (!stateGuard()) return;
    spawnLoot(die, rollResult, centerX, centerY);
  }, WIN_LOOT_DELAY_MS);
}

function completeRollFinish({ result, rolledDie }) {
  resultDisplay.textContent = result;
  resultDisplay.classList.add('show');

  dieContainer.setAttribute(
    'aria-label',
    `Rolled ${result} on d${rolledDie}. Click or press Space/Enter to roll again`
  );
  announce(`Rolled ${result} on d${rolledDie}`);

  // RAMPED state must go through LOOT_RESOLUTION (never directly to IDLE)
  if (gameState === GameState.RAMPED) {
    const isHit = result > currentDie;
    lootResult = isHit ? 'hit' : 'miss';
    setState(GameState.LOOT_RESOLUTION);

    if (isHit) {
      const rect = dieContainer.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      runWinSequence(centerX, centerY, currentDie, result);
    } else {
      // Loot miss - consolation trash then return to IDLE
      const rect = dieContainer.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const consolationType = spawnConsolationLoot(centerX, centerY);
      
      // Update miss text to show what dropped
      if (missLabel) {
        missLabel.textContent = consolationType === TIER_ZZZ ? 'try again. zzz.' : 'try again. just trash.';
      }
      setTimeout(() => clearSettlingState(), MISS_FEEDBACK_MS);
    }
  } else {
    // Was RAMPING (not ramped) - go directly to IDLE (no loot feedback)
    rampedMax = null;
    setState(GameState.IDLE);
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
  if (!canAcceptInput()) return;

  dieContainer.setPointerCapture(event.pointerId);

  // Guard against multiple calls (equivalent to keyboard's !event.repeat check)
  if (isHolding) return;

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
      if (!canAcceptInput()) return;

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
    if (!canAcceptInput()) return;

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
    addEnergy(ENERGY_PER_CLICK_MS);
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
  const selected = getSelectedDie();
  if (selected) {
    updateIndicator(selected);
  }
}

initDieButtons();
initParticles();
await initPhysics();
initLoot();

dieContainer.addEventListener('pointerdown', handlePointerDown);
dieContainer.addEventListener('pointerup', handlePointerUp);
dieContainer.addEventListener('pointercancel', handlePointerUp);
dieContainer.addEventListener('lostpointercapture', handlePointerUp);
diceSelection.addEventListener('pointerdown', handleDicePointerDown);
diceSelection.addEventListener('pointermove', handleDicePointerMove);
diceSelection.addEventListener('pointerup', handleDicePointerUp);
diceSelection.addEventListener('pointercancel', handleDiceLostCapture);
diceSelection.addEventListener('lostpointercapture', handleDiceLostCapture);
document.addEventListener('keydown', handleKeydown);
document.addEventListener('keyup', handleKeyup);
window.addEventListener('resize', initIndicator);

initIndicator();

// Start the first roll (unless motion warning is shown)
if (!checkMotionWarning()) {
  addEnergy(ENERGY_PER_CLICK_MS);
}

