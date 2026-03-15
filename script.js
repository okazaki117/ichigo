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
    rankMessage: document.getElementById('rank-message')
};

// ゲーム設定
const GAME_DURATION = 30; // 30秒
const SPAWN_INTERVAL_BASE = 800; // いちごが湧く基本間隔(ms)

let score = 0;
let timeLeft = 0;
let gameTimer = null;
let spawnTimer = null;
let isPlaying = false;

// いちごの種類定義
// 確率を加重して決定するための配列
const STRAWBERRY_TYPES = [
    { type: 'normal', emoji: '🍓', points: 100, class: 'normal', weight: 60, duration: 2000 },
    { type: 'big', emoji: '🍓', points: 300, class: 'big', weight: 15, duration: 2500 },
    { type: 'white', emoji: '🍓', points: 500, class: 'white', weight: 5, duration: 1500 },
    { type: 'blue', emoji: '🍓', points: -100, class: 'blue', weight: 15, duration: 2000 },
    { type: 'bug', emoji: '🍓', points: -300, class: 'bug', weight: 5, duration: 2500 },
];

function initGame() {
    ELEMENTS.btnStart.addEventListener('click', startGame);
    ELEMENTS.btnRetry.addEventListener('click', () => showScreen(SCREENS.TITLE));
}

function showScreen(screenToShow) {
    Object.values(SCREENS).forEach(screen => {
        screen.classList.remove('active');
    });
    screenToShow.classList.add('active');
}

function startGame() {
    score = 0;
    timeLeft = GAME_DURATION;
    isPlaying = true;
    ELEMENTS.scoreValue.textContent = score;
    ELEMENTS.timerValue.textContent = timeLeft;
    ELEMENTS.playArea.innerHTML = '';
    
    showScreen(SCREENS.GAME);

    gameTimer = setInterval(updateTimer, 1000);
    spawnStrawberryLoop();
}

function updateTimer() {
    timeLeft--;
    ELEMENTS.timerValue.textContent = timeLeft;
    
    // 時間切れ
    if (timeLeft <= 0) {
        endGame();
    }
}

function endGame() {
    isPlaying = false;
    clearInterval(gameTimer);
    clearTimeout(spawnTimer);
    
    // 残っているいちごをクリック不可能に
    const strawberries = document.querySelectorAll('.strawberry-entity');
    strawberries.forEach(s => s.style.pointerEvents = 'none');
    
    setTimeout(() => {
        showResult();
    }, 1000); // 1秒遅延して結果画面へ
}

function showResult() {
    ELEMENTS.finalScore.textContent = score;
    
    // ランク判定
    let rank = '';
    if (score < 0) rank = '赤字農家...😢';
    else if (score < 1000) rank = '新米いちごハンター🔰';
    else if (score < 3000) rank = '一人前のいちご農家🍓';
    else if (score < 5000) rank = '熟練のいちごマスター✨';
    else rank = '伝説のいちごゴッド👑';
    
    ELEMENTS.rankMessage.textContent = `ランク：${rank}`;
    showScreen(SCREENS.RESULT);
}

function getRandomStrawberryType() {
    const totalWeight = STRAWBERRY_TYPES.reduce((sum, type) => sum + type.weight, 0);
    let randomNum = Math.random() * totalWeight;
    
    for (const type of STRAWBERRY_TYPES) {
        if (randomNum < type.weight) {
            return type;
        }
        randomNum -= type.weight;
    }
    return STRAWBERRY_TYPES[0];
}

function spawnStrawberryLoop() {
    if (!isPlaying) return;
    
    spawnStrawberry();
    
    // ランダムな間隔で次をスポーン
    const nextSpawnTime = SPAWN_INTERVAL_BASE * (0.5 + Math.random());
    spawnTimer = setTimeout(spawnStrawberryLoop, nextSpawnTime);
}

function spawnStrawberry() {
    // プレイエリアのサイズを取得
    const areaRect = ELEMENTS.playArea.getBoundingClientRect();
    const padding = 50; // 端っこすぎないように
    
    const x = padding + Math.random() * (areaRect.width - padding * 2);
    const y = padding + Math.random() * (areaRect.height - padding * 2);
    
    const type = getRandomStrawberryType();
    
    const el = document.createElement('div');
    el.className = `strawberry-entity ${type.class}`;
    el.textContent = type.emoji;
    
    // 配置
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    
    // 大きさによる位置微調整（中心を合わせる）
    const scale = type.class === 'big' ? 'scale(1.3)' : 'scale(1)';
    // el.style.transform は、CSSのanimationによる popIn と競合する可能性があるため、
    // padding等の相対的な調整で処理するか、ラッパー要素を使う方が安全だが、ここでは簡略化。
    // 代わりにCSSクラスに大きさを委ねる。
    
    // クリックイベント
    el.addEventListener('mousedown', (e) => {
        if (!isPlaying || el.classList.contains('clicked')) return;
        
        el.classList.add('clicked');
        
        // スコア加算/減算
        updateScore(type.points, x, y);
        
        // 少し経ってから削除
        setTimeout(() => el.remove(), 200);
    });
    
    // タッチデバイス対応
    el.addEventListener('touchstart', (e) => {
        e.preventDefault(); // mousedownとの重複防止
        if (!isPlaying || el.classList.contains('clicked')) return;
        el.classList.add('clicked');
        updateScore(type.points, x, y);
        setTimeout(() => el.remove(), 200);
    }, {passive: false});

    ELEMENTS.playArea.appendChild(el);
    
    // 一定時間経過で自然消滅
    setTimeout(() => {
        if (el.parentNode && !el.classList.contains('clicked')) {
            el.style.animation = 'popOut 0.2s forwards';
            setTimeout(() => {
                if(el.parentNode) el.remove();
            }, 200);
        }
    }, type.duration);
}

function updateScore(points, x, y) {
    score += points;
    ELEMENTS.scoreValue.textContent = score;
    
    // キラキラエフェクト
    createSparkles(x, y);
    
    // ポップアップエフェクト作成
    const popup = document.createElement('div');
    popup.className = `score-popup ${points < 0 ? 'negative' : ''}`;
    popup.textContent = points > 0 ? `+${points}` : points;
    
    popup.style.left = `${x}px`;
    popup.style.top = `${y - 30}px`;
    
    ELEMENTS.playArea.appendChild(popup);
    
    setTimeout(() => popup.remove(), 800);
}

/* 背景デコレーション */
function createDecoration() {
    const el = document.createElement('div');
    el.className = 'decoration';
    const symbols = ['🌸', '✨', '🍃', '🍓', '🤍'];
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.left = `${Math.random() * 100}vw`;
    
    const duration = 5 + Math.random() * 10;
    el.style.animationDuration = `${duration}s`;
    el.style.fontSize = `${1 + Math.random()}rem`;
    
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, duration * 1000);
}
setInterval(createDecoration, 1000);

/* クリック時のキラキラ */
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
        setTimeout(() => span.remove(), 500);
    }
}

// 初期化実行
initGame();
