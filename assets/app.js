/**
 * Dice Roller Application
 * 
 * A simple tabletop dice roller supporting d4, d6, d8, d10, d12, d20, and d100.
 * 
 * State:
 *   - currentDie: number (4, 6, 8, 10, 12, 20, or 100)
 *   - isRolling: boolean
 *   - rollTimeout: timeout ID or null
 */

const DIE_SHAPES = {
  4: '<svg viewBox="-50 -50 100 100" x="0" y="0" width="100" height="100" style="overflow:visible" focusable="false"><polygon points="0,-50 -45,25 45,25" /></svg>',
  6: '<rect x="10" y="10" width="80" height="80" rx="4" />',
  8: '<polygon points="50,10 90,50 50,90 10,50" />',
  10: '<polygon points="50,10 82,28 90,58 50,90 10,58 18,28" />',
  12: '<polygon points="50,10 78,18 92,42 82,75 50,90 18,75 8,42 22,18" />',
  20: '<polygon points="50,8 90,28 90,72 50,92 10,72 10,28" />',
  100: '<polygon points="50,6 79,13 95,38 95,62 79,87 50,94 21,87 5,62 5,38 21,13" />'
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

function initDieButtons() {
  dieButtons.forEach(btn => {
    btn.addEventListener('click', () => selectDie(btn));
  });
}

function selectDie(selectedButton) {
  dieButtons.forEach(btn => btn.setAttribute('aria-pressed', 'false'));
  selectedButton.setAttribute('aria-pressed', 'true');
  
  cancelRoll();
  
  currentDie = parseInt(selectedButton.dataset.die, 10);
  updateDieShape(currentDie);
  clearResult();
  
  announce(`Selected ${currentDie}-sided die`);
  
  void dieContainer.offsetWidth;
  roll();
}

function updateDieShape(sides) {
  dieSvg.innerHTML = DIE_SHAPES[sides];
  dieContainer.classList.toggle('d4', sides === 4);
}

function clearResult() {
  resultDisplay.classList.remove('show');
  resultDisplay.textContent = '';
}

function cancelRoll() {
  if (rollTimeout) {
    clearTimeout(rollTimeout);
    dieContainer.classList.remove('rolling');
    isRolling = false;
    rollTimeout = null;
  }
}

function roll() {
  if (isRolling) return;
  
  isRolling = true;
  dieContainer.classList.add('rolling');
  resultDisplay.classList.remove('show');

  rollTimeout = setTimeout(() => {
    const result = randomInt(1, currentDie);
    resultDisplay.textContent = result;
    dieContainer.classList.remove('rolling');
    resultDisplay.classList.add('show');
    
    dieContainer.setAttribute(
      'aria-label', 
      `Rolled ${result} on d${currentDie}. Click or press Space/Enter to roll again`
    );
    
    announce(`Rolled ${result} on d${currentDie}`);
    
    isRolling = false;
    rollTimeout = null;
  }, ROLL_DURATION_MS);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function announce(message) {
  announcements.textContent = message;
  setTimeout(() => { announcements.textContent = ''; }, 1000);
}

function handleDieContainerClick() {
  cancelRoll();
  clearResult();
  void dieContainer.offsetWidth;
  roll();
}

function handleKeydown(event) {
  if (event.code === 'Space' || event.code === 'Enter') {
    const target = document.activeElement;
    if (target === dieContainer || target === document.body) {
      event.preventDefault();
      cancelRoll();
      clearResult();
      void dieContainer.offsetWidth;
      roll();
    }
  }
}

initDieButtons();
dieContainer.addEventListener('click', handleDieContainerClick);
document.addEventListener('keydown', handleKeydown);

roll();
