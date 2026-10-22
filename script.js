const canvas = document.querySelector('#gameCanvas');
const context = canvas.getContext('2d');
const lifeMeter = document.querySelector('#lifeMeter');
const lifePips = Array.from(lifeMeter.querySelectorAll('.life-pip'));
const coinCountOutput = document.querySelector('#coinCount');
const shieldStatus = document.querySelector('#shieldStatus');
const scoreOutput = document.querySelector('#score');
const bestScoreOutput = document.querySelector('#bestScore');
const gameOverlay = document.querySelector('#gameOverlay');
const overlayKicker = document.querySelector('#overlayKicker');
const overlayTitle = document.querySelector('#overlayTitle');
const overlayText = document.querySelector('#overlayText');
const startButton = document.querySelector('#startButton');
const jumpButton = document.querySelector('#jumpButton');
const gameStatus = document.querySelector('#gameStatus');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_Y = 258;
const PLAYER_X = 112;
const PLAYER_WIDTH = 100;
const PLAYER_HEIGHT = 100;
const MAX_LIVES = 4;
const MAX_JUMPS = 2;
const SHIELD_DURATION = 3;
const STORAGE_KEY = 'wild-runner-best';
const playerSprite = new Image();
playerSprite.src = './活潑綠色小恐龍躍動貼圖.png';
const hurtSprite = new Image();
hurtSprite.src = './受傷哀嚎的可愛小恐龍.png';
const unconsciousSprite = new Image();
unconsciousSprite.src = './昏倒的可愛綠色小恐龍.png';

let state = 'ready';
let bestScore = 0;
let score = 0;
let speed = 320;
let elapsed = 0;
let worldDistance = 0;
let spawnDistance = 440;
let pickupDistance = 620;
let lastFrame = 0;
let animationFrameId = null;
let livesRemaining = MAX_LIVES;
let invulnerability = 0;
let hurtPoseTimer = 0;
let shieldTimer = 0;
let coinCount = 0;
let jumpsRemaining = MAX_JUMPS;
let obstacles = [];
let pickups = [];
let groundMarks = Array.from({ length: 24 }, (_, index) => ({ x: index * 48, width: 8 + (index % 3) * 4 }));
const player = { y: GROUND_Y - PLAYER_HEIGHT, velocityY: 0, onGround: true };

try {
  bestScore = Number(localStorage.getItem(STORAGE_KEY)) || 0;
} catch (error) {
  bestScore = 0;
}
bestScoreOutput.textContent = formatScore(bestScore);

function formatScore(value) {
  return String(Math.floor(value)).padStart(5, '0').slice(-5);
}

function beginRun() {
  score = 0;
  coinCount = 0;
  livesRemaining = MAX_LIVES;
  invulnerability = 0;
  hurtPoseTimer = 0;
  shieldTimer = 0;
  speed = 320;
  elapsed = 0;
  worldDistance = 0;
  spawnDistance = 440;
  pickupDistance = 620;
  obstacles = [];
  pickups = [];
  player.y = GROUND_Y - PLAYER_HEIGHT;
  player.velocityY = 0;
  player.onGround = true;
  jumpsRemaining = MAX_JUMPS;
  lastFrame = 0;
  state = 'running';
  gameOverlay.classList.add('is-hidden');
  gameStatus.textContent = 'RUNNING';
  updateLives();
  updateCoinCount();
  updateShieldStatus();
  updateScore();
  if (animationFrameId === null) animationFrameId = requestAnimationFrame(frame);
}

function jump() {
  if (state === 'ready') {
    beginRun();
  } else if (state === 'over') {
    beginRun();
  }

  if (jumpsRemaining > 0) {
    player.velocityY = -620;
    player.onGround = false;
    jumpsRemaining -= 1;
  }
}

function updateScore() {
  scoreOutput.textContent = formatScore(score);
  if (score > bestScore) {
    bestScore = score;
    bestScoreOutput.textContent = formatScore(bestScore);
    try {
      localStorage.setItem(STORAGE_KEY, String(bestScore));
    } catch (error) {}
  }
}

function updateLives() {
  lifeMeter.setAttribute('aria-label', `生命值：${livesRemaining} 格`);
  lifePips.forEach((pip, index) => {
    pip.classList.toggle('is-lost', index >= livesRemaining);
  });
}

function updateCoinCount() {
  coinCountOutput.textContent = String(coinCount).padStart(2, '0');
}

function updateShieldStatus() {
  const active = shieldTimer > 0;
  shieldStatus.classList.toggle('is-active', active);
  shieldStatus.textContent = active ? `護盾 ${shieldTimer.toFixed(1)} 秒` : '護盾待機';
  shieldStatus.setAttribute('aria-label', active ? `護盾剩餘 ${shieldTimer.toFixed(1)} 秒` : '護盾未啟動');
}

function finishRun() {
  state = 'over';
  gameStatus.textContent = 'RUN OVER';
  overlayKicker.textContent = 'RUN COMPLETE';
  overlayTitle.textContent = '生命用完了！';
  overlayText.textContent = `這次跑了 ${formatScore(score)} 公尺，按空白鍵重新開始並跳躍。`;
  startButton.innerHTML = '重新出發 <span aria-hidden="true">→</span>';
  gameOverlay.classList.remove('is-hidden');
}

function addObstacle() {
  const isBird = score > 450 && Math.random() > 0.72;
  if (isBird) {
    obstacles.push({ type: 'bird', x: WIDTH + 24, y: 190 + Math.floor(Math.random() * 22), width: 44, height: 26, flap: 0 });
    return;
  }

  const size = Math.random() > 0.62 ? 1.25 : 1;
  obstacles.push({ type: 'cactus', x: WIDTH + 24, y: GROUND_Y - 48 * size, width: 28 * size, height: 48 * size });
}

function addPickup() {
  const type = Math.random() < 0.24 ? 'shield' : 'coin';
  const y = type === 'shield'
    ? GROUND_Y - 88
    : GROUND_Y - (52 + Math.floor(Math.random() * 56));
  const count = type === 'coin' ? 3 : 1;

  for (let index = 0; index < count; index += 1) {
    pickups.push({ type, x: WIDTH + 24 + index * 34, y, width: 22, height: 22, phase: index * 0.8 });
  }
}

function update(delta) {
  if (state !== 'running') return;

  invulnerability = Math.max(0, invulnerability - delta);
  hurtPoseTimer = Math.max(0, hurtPoseTimer - delta);
  shieldTimer = Math.max(0, shieldTimer - delta);
  updateShieldStatus();
  elapsed += delta;
  speed = Math.min(610, 320 + elapsed * 9);
  worldDistance += speed * delta;
  score += speed * delta / 10;
  updateScore();

  player.velocityY += 1680 * delta;
  player.y += player.velocityY * delta;
  if (player.y >= GROUND_Y - PLAYER_HEIGHT) {
    player.y = GROUND_Y - PLAYER_HEIGHT;
    player.velocityY = 0;
    player.onGround = true;
    jumpsRemaining = MAX_JUMPS;
  }

  spawnDistance -= speed * delta;
  if (spawnDistance <= 0) {
    addObstacle();
    spawnDistance = 300 + Math.random() * 260 + Math.min(100, elapsed * 2);
  }

  pickupDistance -= speed * delta;
  if (pickupDistance <= 0) {
    addPickup();
    pickupDistance = 650 + Math.random() * 550;
  }

  obstacles.forEach((obstacle) => {
    obstacle.x -= speed * delta;
    obstacle.flap += delta * 12;
  });
  obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -20);
  pickups.forEach((pickup) => {
    pickup.x -= speed * delta;
    pickup.phase += delta * 5;
  });
  pickups = pickups.filter((pickup) => pickup.x + pickup.width > -20);

  const playerBox = { x: PLAYER_X + 8, y: player.y + 7, width: PLAYER_WIDTH - 14, height: PLAYER_HEIGHT - 9 };
  for (let index = pickups.length - 1; index >= 0; index -= 1) {
    const pickup = pickups[index];
    const overlapsPlayer = playerBox.x < pickup.x + pickup.width
      && playerBox.x + playerBox.width > pickup.x
      && playerBox.y < pickup.y + pickup.height
      && playerBox.y + playerBox.height > pickup.y;
    if (!overlapsPlayer) continue;

    pickups.splice(index, 1);
    if (pickup.type === 'coin') {
      coinCount += 1;
      score += 100;
      updateCoinCount();
      updateScore();
    } else {
      shieldTimer = SHIELD_DURATION;
      updateShieldStatus();
    }
  }

  const hitIndex = obstacles.findIndex((obstacle) => {
    const inset = obstacle.type === 'cactus' ? 4 : 7;
    return playerBox.x < obstacle.x + obstacle.width - inset
      && playerBox.x + playerBox.width > obstacle.x + inset
      && playerBox.y < obstacle.y + obstacle.height - inset
      && playerBox.y + playerBox.height > obstacle.y + inset;
  });

  if (hitIndex !== -1) {
    obstacles.splice(hitIndex, 1);
    if (shieldTimer === 0 && invulnerability === 0) {
      livesRemaining -= 1;
      invulnerability = 0.85;
      hurtPoseTimer = 1.2;
      updateLives();
      if (livesRemaining === 0) finishRun();
    }
  }
}

function drawCloud(x, y, scale) {
  context.fillStyle = 'rgba(255, 247, 222, 0.86)';
  context.fillRect(x, y + 8 * scale, 42 * scale, 10 * scale);
  context.fillRect(x + 8 * scale, y, 16 * scale, 18 * scale);
  context.fillRect(x + 24 * scale, y + 4 * scale, 14 * scale, 14 * scale);
}

function drawBackground() {
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#f1b877');
  sky.addColorStop(0.72, '#f8d7a1');
  sky.addColorStop(1, '#f9e6bd');
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = '#f5dd9b';
  context.beginPath();
  context.arc(770, 92, 36, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(255, 242, 198, 0.34)';
  context.beginPath();
  context.arc(770, 92, 52, 0, Math.PI * 2);
  context.fill();

  const drift = (worldDistance * 0.12) % 1120;
  drawCloud(170 - drift, 67, 1);
  drawCloud(620 - drift * 0.7, 128, 0.72);
  drawCloud(1070 - drift, 78, 0.85);

  context.fillStyle = '#d98e66';
  context.beginPath();
  context.moveTo(0, 221);
  context.lineTo(116, 153);
  context.lineTo(226, 213);
  context.lineTo(347, 165);
  context.lineTo(496, 222);
  context.lineTo(638, 171);
  context.lineTo(796, 222);
  context.lineTo(920, 164);
  context.lineTo(WIDTH, 210);
  context.lineTo(WIDTH, GROUND_Y);
  context.lineTo(0, GROUND_Y);
  context.closePath();
  context.fill();

  context.fillStyle = '#bd7658';
  context.beginPath();
  context.moveTo(0, 239);
  context.lineTo(162, 198);
  context.lineTo(298, 239);
  context.lineTo(454, 193);
  context.lineTo(610, 240);
  context.lineTo(774, 202);
  context.lineTo(924, 239);
  context.lineTo(WIDTH, 215);
  context.lineTo(WIDTH, GROUND_Y);
  context.lineTo(0, GROUND_Y);
  context.closePath();
  context.fill();

  context.fillStyle = '#493b35';
  context.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  context.fillStyle = '#d88b56';
  context.fillRect(0, GROUND_Y, WIDTH, 4);
  const offset = worldDistance % 48;
  context.fillStyle = '#79513f';
  groundMarks.forEach((mark) => {
    const x = (mark.x - offset + WIDTH + 48) % (WIDTH + 48) - 24;
    context.fillRect(x, GROUND_Y + 18 + (mark.x % 2) * 9, mark.width, 3);
  });

  context.fillStyle = 'rgba(255, 232, 186, 0.35)';
  context.fillRect(0, GROUND_Y - 3, WIDTH, 1);
}

function drawPlayer() {
  const x = PLAYER_X - 9;
  const y = Math.round(player.y + (player.onGround && state === 'running' ? Math.sin(elapsed * 16) * 2 : 0));
  if (shieldTimer > 0) {
    context.strokeStyle = '#77cbd0';
    context.lineWidth = 4;
    context.fillStyle = 'rgba(119, 203, 208, 0.18)';
    context.beginPath();
    context.ellipse(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT / 2, 57, 58, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  const hasHurtSprite = hurtSprite.complete && hurtSprite.naturalWidth > 0;
  const hasUnconsciousSprite = unconsciousSprite.complete && unconsciousSprite.naturalWidth > 0;
  const sprite = state === 'over' && hasUnconsciousSprite
    ? unconsciousSprite
    : hurtPoseTimer > 0 && hasHurtSprite ? hurtSprite : playerSprite;
  if (sprite.complete && sprite.naturalWidth > 0) {
    context.drawImage(sprite, x, y, PLAYER_WIDTH, PLAYER_HEIGHT);
  }
}

function drawCactus(obstacle) {
  const x = Math.round(obstacle.x);
  const y = Math.round(obstacle.y);
  const scale = obstacle.width / 28;
  context.fillStyle = '#344d3f';
  context.fillRect(x + 9 * scale, y, 10 * scale, 48 * scale);
  context.fillRect(x, y + 18 * scale, 9 * scale, 7 * scale);
  context.fillRect(x, y + 11 * scale, 6 * scale, 14 * scale);
  context.fillRect(x + 19 * scale, y + 26 * scale, 9 * scale, 7 * scale);
  context.fillRect(x + 22 * scale, y + 18 * scale, 6 * scale, 15 * scale);
  context.fillStyle = '#78936a';
  context.fillRect(x + 11 * scale, y + 4 * scale, 2 * scale, 36 * scale);
}

function drawBird(obstacle) {
  const x = Math.round(obstacle.x);
  const y = Math.round(obstacle.y);
  const wingUp = Math.sin(obstacle.flap) > 0;
  context.fillStyle = '#674d42';
  context.fillRect(x + 9, y + 10, 26, 10);
  context.fillRect(x + 29, y + 7, 11, 9);
  context.fillRect(x + 38, y + 10, 7, 4);
  context.fillRect(x + 15, y + (wingUp ? 1 : 17), 14, 9);
  context.fillRect(x + 5, y + 17, 10, 3);
  context.fillStyle = '#f1b877';
  context.fillRect(x + 36, y + 9, 2, 2);
}

function drawPickup(pickup) {
  const x = Math.round(pickup.x);
  const y = Math.round(pickup.y + Math.sin(pickup.phase) * 4);

  if (pickup.type === 'coin') {
    context.fillStyle = '#9b672e';
    context.beginPath();
    context.arc(x + 11, y + 12, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f4c95d';
    context.beginPath();
    context.arc(x + 11, y + 10, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff0a6';
    context.fillRect(x + 9, y + 5, 4, 11);
    return;
  }

  context.fillStyle = '#3f9298';
  context.beginPath();
  context.moveTo(x + 11, y);
  context.lineTo(x + 21, y + 5);
  context.lineTo(x + 19, y + 16);
  context.lineTo(x + 11, y + 22);
  context.lineTo(x + 3, y + 16);
  context.lineTo(x + 1, y + 5);
  context.closePath();
  context.fill();
  context.fillStyle = '#c8f0dc';
  context.fillRect(x + 10, y + 5, 3, 12);
  context.fillRect(x + 6, y + 9, 11, 3);
}

function render() {
  context.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  obstacles.forEach((obstacle) => {
    if (obstacle.type === 'bird') drawBird(obstacle);
    else drawCactus(obstacle);
  });
  pickups.forEach(drawPickup);
  drawPlayer();
}

function frame(timestamp) {
  animationFrameId = null;
  if (lastFrame === 0) lastFrame = timestamp;
  const delta = Math.min((timestamp - lastFrame) / 1000, 0.04);
  lastFrame = timestamp;
  update(delta);
  render();
  if (state !== 'over') animationFrameId = requestAnimationFrame(frame);
}

startButton.addEventListener('click', beginRun);
jumpButton.addEventListener('click', jump);
canvas.addEventListener('pointerdown', () => {
  canvas.focus({ preventScroll: true });
  if (state !== 'running') beginRun();
  else jump();
});
document.addEventListener('keydown', (event) => {
  const isJumpKey = event.code === 'Space' || event.key === ' ' || event.code === 'ArrowUp';
  if (!isJumpKey) return;

  event.preventDefault();
  if (!event.repeat) jump();
}, true);
document.addEventListener('visibilitychange', () => {
  lastFrame = 0;
});

canvas.focus({ preventScroll: true });
animationFrameId = requestAnimationFrame(frame);
