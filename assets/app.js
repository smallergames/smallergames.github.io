/**
 * Dice Roller Application
 *
 * A simple tabletop dice roller supporting d4, d6, d8, d10, d12, d20, and d100.
 * Features an energy bar system where clicks add energy and the die rolls until depleted.
 */

import { initParticles, spawnParticles } from './particles.js';

const DIE_SHAPES = {
  4: { viewBox: '-50 -50 100 100', markup: '<polygon points="0,-50 -45,25 45,25" />' },
  6: { viewBox: '0 0 100 100', markup: '<rect x="10" y="10" width="80" height="80" rx="4" />' },
  8: { viewBox: '0 0 100 100', markup: '<polygon points="50,10 90,50 50,90 10,50" />' },
  10: { viewBox: '0 0 100 100', markup: '<polygon points="50,10 82,28 90,58 50,90 10,58 18,28" />' },
  12: { viewBox: '0 0 100 100', markup: '<polygon points="50,10 78,18 92,42 82,75 50,90 18,75 8,42 22,18" />' },
  20: { viewBox: '0 0 100 100', markup: '<polygon points="50,8 90,28 90,72 50,92 10,72 10,28" />' },
  100: { viewBox: '0 0 100 100', markup: '<polygon points="50,6 79,13 95,38 95,62 79,87 50,94 21,87 5,62 5,38 21,13" />' }
};

const diceSelection = document.querySelector('.dice-selection');
const dieButtons = document.querySelectorAll('[data-die]');
const dieContainer = document.getElementById('dieContainer');
const dieSvg = document.getElementById('dieSvg');
const resultDisplay = document.getElementById('result');
const announcements = document.getElementById('announcements');

let currentDie = 20;
let isRolling = false;
let announceTimeout = null;

const MAX_ENERGY_MS = 2000;
const ENERGY_PER_CLICK_MS = 400;
const ENERGY_FILL_RATE_MS = 50;
let energy = 0;
let energyDrainFrame = null;
let isHolding = false;
let holdInterval = null;

function initDieButtons() {
  dieButtons.forEach(btn => {
    btn.addEventListener('click', () => selectDie(btn));
  });
}

let isDraggingDice = false;
let hasDraggedSinceDiceDown = false;

function handleDicePointerDown(event) {
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
  
  if (!hasDraggedSinceDiceDown) {
    const closestBtn = findDieButtonAt(event.clientX);
    if (closestBtn) {
      selectDie(closestBtn);
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
  const sides = parseInt(selectedButton.dataset.die, 10);
  if (!DIE_SHAPES[sides]) return;

  dieButtons.forEach(btn => btn.setAttribute('aria-checked', 'false'));
  selectedButton.setAttribute('aria-checked', 'true');
  updateIndicator(selectedButton);

  stopEnergySystem();
  
  currentDie = sides;
  updateDieShape(currentDie);
  clearResult();
  
  announce(`Selected ${currentDie}-sided die`);
  
  requestAnimationFrame(() => addEnergy(ENERGY_PER_CLICK_MS));
}

function updateDieShape(sides) {
  const shape = DIE_SHAPES[sides];
  if (!shape) return;
  dieSvg.setAttribute('viewBox', shape.viewBox);
  dieSvg.innerHTML = shape.markup;
  dieContainer.classList.toggle('d4', sides === 4);
}

function clearResult() {
  resultDisplay.classList.remove('show');
  resultDisplay.textContent = '';
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
  isHolding = false;
  energy = 0;
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

function addEnergy(amount) {
  energy = Math.min(energy + amount, MAX_ENERGY_MS);
  updateEnergyLevel();
  
  if (!energyDrainFrame) {
    startEnergyDrain();
  }
  
  if (!isRolling) {
    clearResult();
    startContinuousRoll();
  } else {
    restartDieAnimation();
  }
}

function restartDieAnimation() {
  const svg = dieSvg;
  svg.style.animation = 'none';
  svg.offsetHeight; // Force reflow to restart animation
  svg.style.animation = '';
}

const HOLD_DRAIN_RATE = 0.1;
const RELEASE_DRAIN_RATE = 1.5;

function startEnergyDrain() {
  let lastTime = performance.now();
  
  function drain() {
    const now = performance.now();
    const delta = now - lastTime;
    lastTime = now;
    
    const drainAmount = delta * (isHolding ? HOLD_DRAIN_RATE : RELEASE_DRAIN_RATE);
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
  dieContainer.classList.add('rolling');
  resultDisplay.classList.remove('show');
}

function finishRoll() {
  const result = randomInt(1, currentDie);
  resultDisplay.textContent = result;
  dieContainer.classList.remove('rolling');
  resultDisplay.classList.add('show');

  // Spawn particles on max roll
  if (result === currentDie) {
    const selectedBtn = document.querySelector('[data-die][aria-checked="true"]');
    if (selectedBtn) {
      const rect = selectedBtn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      spawnParticles(centerX, centerY, currentDie);
    }
  }

  dieContainer.setAttribute(
    'aria-label',
    `Rolled ${result} on d${currentDie}. Click or press Space/Enter to roll again`
  );

  announce(`Rolled ${result} on d${currentDie}`);

  isRolling = false;
}

function handlePointerDown(event) {
  if (event.button && event.button !== 0) return;

  dieContainer.setPointerCapture(event.pointerId);
  isHolding = true;
  addEnergy(ENERGY_PER_CLICK_MS);

  holdInterval = setInterval(() => {
    if (isHolding) {
      addEnergy(ENERGY_PER_CLICK_MS);
    }
  }, 1000);
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
      addEnergy(ENERGY_PER_CLICK_MS);
    }
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
dieContainer.addEventListener('pointerdown', handlePointerDown);
dieContainer.addEventListener('pointerup', handlePointerUp);
dieContainer.addEventListener('pointercancel', handlePointerUp);
dieContainer.addEventListener('lostpointercapture', handlePointerUp);
diceSelection.addEventListener('pointerdown', handleDicePointerDown);
diceSelection.addEventListener('pointermove', handleDicePointerMove);
diceSelection.addEventListener('pointerup', handleDicePointerUp);
diceSelection.addEventListener('pointercancel', handleDicePointerUp);
document.addEventListener('keydown', handleKeydown);
window.addEventListener('resize', initIndicator);

initIndicator();
addEnergy(ENERGY_PER_CLICK_MS);
