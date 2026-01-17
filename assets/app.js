/**
 * Dice Roller Application
 * 
 * A simple tabletop dice roller supporting d4, d6, d8, d10, d12, d20, and d100.
 * 
 * State:
 *   - currentDie: number (4, 6, 8, 10, 12, 20, or 100)
 *   - isRolling: boolean
 *   - rollTimeout: timeout ID or null
 *   - announceTimeout: timeout ID or null
 */

const DIE_SHAPES = {
  4: { viewBox: '-50 -50 100 100', markup: '<polygon points="0,-50 -45,25 45,25" />' },
  6: { viewBox: '0 0 100 100', markup: '<rect x="10" y="10" width="80" height="80" rx="4" />' },
  8: { viewBox: '0 0 100 100', markup: '<polygon points="50,10 90,50 50,90 10,50" />' },
  10: { viewBox: '0 0 100 100', markup: '<polygon points="50,10 82,28 90,58 50,90 10,58 18,28" />' },
  12: { viewBox: '0 0 100 100', markup: '<polygon points="50,10 78,18 92,42 82,75 50,90 18,75 8,42 22,18" />' },
  20: { viewBox: '0 0 100 100', markup: '<polygon points="50,8 90,28 90,72 50,92 10,72 10,28" />' },
  100: { viewBox: '0 0 100 100', markup: '<polygon points="50,6 79,13 95,38 95,62 79,87 50,94 21,87 5,62 5,38 21,13" />' }
};

const ROLL_DURATION_MS = 500;

const dieButtons = document.querySelectorAll('[data-die]');
const dieContainer = document.getElementById('dieContainer');
const dieSvg = document.getElementById('dieSvg');
const resultDisplay = document.getElementById('result');
const announcements = document.getElementById('announcements');

let currentDie = 20;
let isRolling = false;
let rollTimeout = null;
let announceTimeout = null;
let rollStartTime = null;
let orbitBeforeRotation = Math.random() * 360;
let orbitAfterRotation = Math.random() * 360;

function initDieButtons() {
  dieButtons.forEach(btn => {
    btn.addEventListener('click', () => selectDie(btn));
  });
}

function selectDie(selectedButton) {
  const sides = parseInt(selectedButton.dataset.die, 10);
  if (!DIE_SHAPES[sides]) return;
  
  dieButtons.forEach(btn => btn.setAttribute('aria-checked', 'false'));
  selectedButton.setAttribute('aria-checked', 'true');
  
  cancelRoll();
  
  currentDie = sides;
  updateDieShape(currentDie);
  clearResult();
  
  announce(`Selected ${currentDie}-sided die`);
  
  requestAnimationFrame(() => roll());
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

function prepareOrbitalRings() {
  const beforeNorm = ((orbitBeforeRotation % 360) + 360) % 360;
  const afterNorm = ((orbitAfterRotation % 360) + 360) % 360;
  
  const beforeDelay = -(beforeNorm / 360) * 2.5;
  const afterDelay = -((360 - afterNorm) / 360) * 8;
  
  dieContainer.style.setProperty('--orbit-before-rotation', `${orbitBeforeRotation}deg`);
  dieContainer.style.setProperty('--orbit-after-rotation', `${orbitAfterRotation}deg`);
  dieContainer.style.setProperty('--orbit-before-delay', `${beforeDelay}s`);
  dieContainer.style.setProperty('--orbit-after-delay', `${afterDelay}s`);
}

function freezeOrbitalRings() {
  if (!rollStartTime) return;
  
  const elapsed = performance.now() - rollStartTime;
  
  orbitBeforeRotation += (elapsed / 2500) * 360;
  orbitAfterRotation -= (elapsed / 8000) * 360;
  
  dieContainer.style.setProperty('--orbit-before-rotation', `${orbitBeforeRotation}deg`);
  dieContainer.style.setProperty('--orbit-after-rotation', `${orbitAfterRotation}deg`);
}

function cancelRoll(keepRingsAnimating = false) {
  if (rollTimeout) {
    clearTimeout(rollTimeout);
    if (!keepRingsAnimating) {
      freezeOrbitalRings();
      dieContainer.classList.remove('rolling');
    }
    isRolling = false;
    rollTimeout = null;
    rollStartTime = null;
  }
}

function roll() {
  if (isRolling) {
    cancelRoll(true);
  }
  
  isRolling = true;
  rollStartTime = performance.now();
  prepareOrbitalRings();
  dieContainer.classList.add('rolling');
  resultDisplay.classList.remove('show');

  rollTimeout = setTimeout(() => {
    const result = randomInt(1, currentDie);
    resultDisplay.textContent = result;
    freezeOrbitalRings();
    dieContainer.classList.remove('rolling');
    resultDisplay.classList.add('show');
    
    dieContainer.setAttribute(
      'aria-label', 
      `Rolled ${result} on d${currentDie}. Click or press Space/Enter to roll again`
    );
    
    announce(`Rolled ${result} on d${currentDie}`);
    
    isRolling = false;
    rollTimeout = null;
    rollStartTime = null;
  }, ROLL_DURATION_MS);
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

function handleDieContainerClick() {
  clearResult();
  roll();
}

function handleKeydown(event) {
  if (event.code === 'Space' || event.code === 'Enter') {
    if (document.activeElement === document.body) {
      event.preventDefault();
      dieContainer.click();
    }
  }
}

initDieButtons();
dieContainer.addEventListener('click', handleDieContainerClick);
document.addEventListener('keydown', handleKeydown);

roll();
