const SCREENS = {
    TITLE: document.getElementById('screen-title'),
    GAME: document.getElementById('screen-game'),
    RESULT: document.getElementById('screen-result')
};

const ELEMENTS = {
    btnStart: document.getElementById('btn-start'),
    btnRetry: document.getElementById('btn-retry'),
    timerValue: document.getElementById('timer'),
    scoreValue: document.getElementById('score'),
    playArea: document.getElementById('play-area'),
    finalScore: document.getElementById('final-score'),
    rankMessage: document.getElementById('rank-message'),
    basket: document.getElementById('basket')
};

/* --- ゲームステータス --- */
const GAME_DURATION = 30; // 30秒
let score = 0;
let timeLeft = 0;
let isPlaying = false;
let gameTimerInterval = null;
let animationFrameId = null;
let lastSpawnTime = 0;

// マウス/タッチの座標 (カゴの位置)
let cursorX = 300;
let cursorY = 500;

// 落下中のエンティティ（いちご・ハチ）のデータ配列
let fallingEntities = [];

/* --- アイテム種類定義 --- */
// 確率を加重して決定するための配列
const SPAWN_TYPES = [
    { type: 'normal', emoji: '🍓', points: 100, class: 'normal', weight: 60, speedBase: 3 },
    { type: 'big', emoji: '🍓', points: 300, class: 'big', weight: 15, speedBase: 2.5 },
    { type: 'white', emoji: '🍓', points: 500, class: 'white', weight: 5, speedBase: 4 },
    { type: 'blue', emoji: '🍓', points: -100, class: 'blue', weight: 12, speedBase: 3.5 },
    { type: 'bug', emoji: '🍓', points: -300, class: 'bug', weight: 5, speedBase: 3.5 },
    { type: 'bee', emoji: '🐝', points: 'GAMEOVER', class: 'bee', weight: 3, speedBase: 5 },
];


function initGame() {
    ELEMENTS.btnStart.addEventListener('click', startGame);
    ELEMENTS.btnRetry.addEventListener('click', () => showScreen(SCREENS.TITLE));
    
    // マウス移動
    ELEMENTS.playArea.addEventListener('mousemove', (e) => {
        if (!isPlaying) return;
        const rect = ELEMENTS.playArea.getBoundingClientRect();
        cursorX = e.clientX - rect.left;
        cursorY = e.clientY - rect.top;
        updateBasketPosition();
    });
    
    // タッチ移動
    ELEMENTS.playArea.addEventListener('touchmove', (e) => {
        if (!isPlaying) return;
        e.preventDefault(); 
        const rect = ELEMENTS.playArea.getBoundingClientRect();
        cursorX = e.touches[0].clientX - rect.left;
        cursorY = e.touches[0].clientY - rect.top;
        updateBasketPosition();
    }, {passive: false});
}

function showScreen(screenToShow) {
    Object.values(SCREENS).forEach(screen => {
        screen.classList.remove('active');
    });
    screenToShow.classList.add('active');
}

function updateBasketPosition() {
    ELEMENTS.basket.style.left = `${cursorX}px`;
    ELEMENTS.basket.style.top = `${cursorY}px`;
}

function startGame() {
    score = 0;
    timeLeft = GAME_DURATION;
    isPlaying = true;
    fallingEntities.forEach(f => f.element.remove());
    fallingEntities = [];
    
    ELEMENTS.scoreValue.textContent = score;
    ELEMENTS.timerValue.textContent = timeLeft;
    
    showScreen(SCREENS.GAME);
    
    // カーソル初期位置を中央下部に
    const rect = ELEMENTS.playArea.getBoundingClientRect();
    cursorX = rect.width / 2;
    cursorY = rect.height - 100;
    updateBasketPosition();

    gameTimerInterval = setInterval(updateTimer, 1000);
    lastSpawnTime = performance.now();
    
    // ゲームループ開始
    animationFrameId = requestAnimationFrame(gameLoop);
}

function updateTimer() {
    timeLeft--;
    ELEMENTS.timerValue.textContent = timeLeft;
    
    // 時間切れ
    if (timeLeft <= 0) {
        endGame('TIMEUP');
    }
}

function endGame(reason) {
    isPlaying = false;
    clearInterval(gameTimerInterval);
    cancelAnimationFrame(animationFrameId);
    
    const isGameOver = reason === 'GAMEOVER';
    
    setTimeout(() => {
        showResult(isGameOver);
    }, 500);
}

function showResult(isGameOver) {
    ELEMENTS.finalScore.textContent = score;
    
    // ランク判定
    let rank = '';
    if (isGameOver) rank = 'ハチに刺されて即終了🐝💦';
    else if (score < 0) rank = '赤字農家...😢';
    else if (score < 1000) rank = '新米いちごハンター🔰';
    else if (score < 3000) rank = '一人前のいちご農家🍓';
    else if (score < 5000) rank = '熟練のいちごマスター✨';
    else rank = '伝説のいちごゴッド👑';
    
    ELEMENTS.rankMessage.textContent = `ランク：${rank}`;
    showScreen(SCREENS.RESULT);
}

function getRandomType() {
    const totalWeight = SPAWN_TYPES.reduce((sum, type) => sum + type.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (const type of SPAWN_TYPES) {
        if (randomNum < type.weight) return type;
        randomNum -= type.weight;
    }
    return SPAWN_TYPES[0];
}

function spawnEntity() {
    const rect = ELEMENTS.playArea.getBoundingClientRect();
    const type = getRandomType();
    
    // 画面の幅の中でランダムなX座標に配置
    const padding = 40; 
    const x = padding + Math.random() * (rect.width - padding * 2);
    const y = -50; // 画面上部外から
    
    const el = document.createElement('div');
    el.className = `falling-entity ${type.class}`;
    el.textContent = type.emoji;
    ELEMENTS.playArea.appendChild(el);
    
    // スピード算出（時間経過でだんだん早くなる：難易度カーブ）
    // timeLeft=30 のときはそのまま、timeLeft=0 に近づくにつれ最大1.5倍の速さ
    const speedMultiplier = 1 + ((GAME_DURATION - Math.max(0, timeLeft)) / GAME_DURATION) * 0.5;
    
    // ハチ（🐝）の場合は斜めに動くように設定
    let vx = 0;
    if (type.type === 'bee') {
        vx = (Math.random() - 0.5) * 4; // 左右にブレる
    }
    
    fallingEntities.push({
        element: el,
        type: type,
        x: x,
        y: y,
        vx: vx,
        vy: type.speedBase * speedMultiplier * (0.8 + Math.random() * 0.4), // 速さのばらつき
        isCaught: false
    });
}

function gameLoop(timestamp) {
    if (!isPlaying) return;
    
    // 難易度カーブに基づいたスポーン間隔の計算
    // 残り時間30秒：約800ms ～ 残り時間0秒：約300ms
    const baseInterval = 300 + (timeLeft / GAME_DURATION) * 500;
    
    if (timestamp - lastSpawnTime > baseInterval * (0.8 + Math.random() * 0.4)) {
        spawnEntity();
        lastSpawnTime = timestamp;
    }
    
    updateEntities();
    checkCollisions();
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

function updateEntities() {
    const rect = ELEMENTS.playArea.getBoundingClientRect();
    
    for (let i = fallingEntities.length - 1; i >= 0; i--) {
        const entity = fallingEntities[i];
        
        entity.x += entity.vx;
        entity.y += entity.vy;
        
        // 画面外（下）に落ちたかチェック
        if (entity.y > rect.height + 100 || entity.x < -100 || entity.x > rect.width + 100) {
            entity.element.remove();
            fallingEntities.splice(i, 1);
            continue;
        }
        
        // DOM要素の座標更新
        entity.element.style.left = `${entity.x}px`;
        entity.element.style.top = `${entity.y}px`;
    }
}

function checkCollisions() {
    // カゴの判定領域 (マウスカーソル位置基準)
    // カゴの中心(cursorX)から左右30px、上20px下20pxくらいを当たり判定とする
    const catchRadius = 35;
    const basketCenterY = cursorY + 10;
    
    for (let i = fallingEntities.length - 1; i >= 0; i--) {
        const entity = fallingEntities[i];
        if (entity.isCaught) continue;
        
        // 距離を計算（簡易的な円形判定）
        const dx = entity.x - cursorX;
        const dy = entity.y - basketCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < catchRadius) {
            // キャッチ成功（またはハチと衝突）
            handleCatch(entity, i);
        }
    }
}

function handleCatch(entity, index) {
    entity.isCaught = true;
    const type = entity.type;
    
    if (type.type === 'bee') {
        // 即ゲームオーバー
        entity.element.textContent = '💥';
        entity.element.style.transform = 'scale(2)';
        endGame('GAMEOVER');
        return;
    }
    
    // スコア処理
    const points = type.points;
    score += points;
    ELEMENTS.scoreValue.textContent = score;
    
    createSparkles(entity.x, entity.y);
    createScorePopup(points, entity.x, entity.y);
    
    // 捕まえた要素は消す
    entity.element.remove();
    fallingEntities.splice(index, 1);
}

function createScorePopup(points, x, y) {
    const popup = document.createElement('div');
    popup.className = `score-popup ${points < 0 ? 'negative' : ''}`;
    popup.textContent = points > 0 ? `+${points}` : points;
    
    popup.style.left = `${x}px`;
    popup.style.top = `${y - 30}px`;
    
    ELEMENTS.playArea.appendChild(popup);
    setTimeout(() => { if (popup.parentNode) popup.remove(); }, 800);
}

/* 背景デコレーション */
function createDecoration() {
    if (!isPlaying && Math.random() > 0.3) return; // ゲーム中以外は少し減らす
    const el = document.createElement('div');
    el.className = 'decoration';
    const symbols = ['🌸', '✨', '🍃', '🤍'];
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.left = `${Math.random() * 100}vw`;
    
    const duration = 5 + Math.random() * 10;
    el.style.animationDuration = `${duration}s`;
    el.style.fontSize = `${1 + Math.random()}rem`;
    
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, duration * 1000);
}
setInterval(createDecoration, 1000);

/* クリック時（今回はキャッチ時）のキラキラ */
function createSparkles(x, y) {
    for (let i = 0; i < 6; i++) {
        const span = document.createElement('span');
        span.className = 'sparkle';
        span.textContent = '✨';
        
        const angle = Math.random() * Math.PI * 2;
        const radius = 30 + Math.random() * 40; 
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius;
        
        span.style.setProperty('--dx', `${dx}px`);
        span.style.setProperty('--dy', `${dy}px`);
        span.style.left = `${x}px`;
        span.style.top = `${y}px`;
        
        ELEMENTS.playArea.appendChild(span);
        setTimeout(() => { if (span.parentNode) span.remove(); }, 500);
    }
}

// 初期化実行
initGame();
