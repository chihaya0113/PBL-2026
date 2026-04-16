// ===== 定数・設定 =====
const CHORDS = ['G', 'C', 'D', 'Em'];

const CHORD_COLORS = {
  G:  { fill: '#4FC3F7', glow: 'rgba(79,195,247,0.8)',  dark: '#0288D1' },
  C:  { fill: '#EF5350', glow: 'rgba(239,83,80,0.8)',   dark: '#C62828' },
  D:  { fill: '#66BB6A', glow: 'rgba(102,187,106,0.8)', dark: '#2E7D32' },
  Em: { fill: '#FFA726', glow: 'rgba(255,167,38,0.8)',  dark: '#E65100' },
};

// 実際のギターコード・フィンガリング（ダイアグラム用）
const CHORD_DIAGRAMS = {
  G: {
    muted:       [],
    openStrings: [4, 3, 2],           // D,G,B弦 開放
    dots: [
      { string: 6, fret: 3, finger: 2 }, // 6弦3フレット 中指
      { string: 5, fret: 2, finger: 1 }, // 5弦2フレット 人差し指
      { string: 1, fret: 3, finger: 3 }, // 1弦3フレット 薬指
    ],
    startFret: 1,
  },
  C: {
    muted:       [6],                 // 6弦ミュート
    openStrings: [3, 1],              // G,E弦 開放
    dots: [
      { string: 5, fret: 3, finger: 3 }, // 5弦3フレット 薬指
      { string: 4, fret: 2, finger: 2 }, // 4弦2フレット 中指
      { string: 2, fret: 1, finger: 1 }, // 2弦1フレット 人差し指
    ],
    startFret: 1,
  },
  D: {
    muted:       [6, 5],              // 6,5弦ミュート
    openStrings: [4],                 // D弦 開放
    dots: [
      { string: 3, fret: 2, finger: 1 }, // 3弦2フレット 人差し指
      { string: 1, fret: 2, finger: 2 }, // 1弦2フレット 中指
      { string: 2, fret: 3, finger: 3 }, // 2弦3フレット 薬指
    ],
    startFret: 1,
  },
  Em: {
    muted:       [],
    openStrings: [6, 3, 2, 1],       // E,G,B,E 開放
    dots: [
      { string: 5, fret: 2, finger: 2 }, // 5弦2フレット 中指
      { string: 4, fret: 2, finger: 3 }, // 4弦2フレット 薬指
    ],
    startFret: 1,
  },
};

// 指番号の日本語
const FINGER_NAMES = { 1: '人差し指', 2: '中指', 3: '薬指', 4: '小指' };

// 子ども向けフィンガーヒント（構造化データ）
const CHORD_HINTS = {
  G: {
    vibe: '🏠 おうちみたいに、一番落ち着くコード',
    fingers: [
      { num: '1', label: '人差し指', pos: '5弦の2フレット' },
      { num: '2', label: '中指',     pos: '6弦の3フレット' },
      { num: '3', label: '薬指',     pos: '1弦の3フレット' },
    ],
    note: null,
  },
  C: {
    vibe: '🌅 景色が広がる感じのコード',
    fingers: [
      { num: '1', label: '人差し指', pos: '2弦の1フレット' },
      { num: '2', label: '中指',     pos: '4弦の2フレット' },
      { num: '3', label: '薬指',     pos: '5弦の3フレット' },
    ],
    note: '⚠️ 6弦はひかない！',
  },
  D: {
    vibe: '🚀 次に進みたくなるコード',
    fingers: [
      { num: '1', label: '人差し指', pos: '3弦の2フレット' },
      { num: '2', label: '中指',     pos: '1弦の2フレット' },
      { num: '3', label: '薬指',     pos: '2弦の3フレット' },
    ],
    note: '⚠️ 5・6弦はひかない！',
  },
  Em: {
    vibe: '🌙 ちょっとさみしい雰囲気のコード',
    fingers: [
      { num: '2', label: '中指', pos: '5弦の2フレット' },
      { num: '3', label: '薬指', pos: '4弦の2フレット' },
    ],
    note: null,
  },
};

// タイミングラインX位置（canvas幅の22%）
const TIMING_LINE_RATIO = 0.22;
// ノーツの幅・高さ（タイミングボックスと同じ）
const NOTE_WIDTH  = 120;
const NOTE_HEIGHT = 90;
const NOTE_RADIUS = 18;
// ノーツ間の間隔（canvas幅比）
const NOTE_SPACING_RATIO = 0.38;

// ===== 状態 =====
let state = {
  running:       false,
  paused:        false,
  bpm:           30,
  beatsPerChord: 1,   // 1 = 1拍モード / 4 = 4拍モード
  notes:         [],
  startTime:     null,
  pausedAt:      0,
  loopCount:     0,
  animFrameId:   null,
  hitEffects:    [],
  canvasW:       0,
  canvasH:       0,
  timingLineX:   0,
  timingFlash:   0,
};

// ===== DOM =====
const canvas              = document.getElementById('game-canvas');
const ctx                 = canvas.getContext('2d');
const startBtn            = document.getElementById('start-btn');
const countdownOverlay    = document.getElementById('countdown-overlay');
const countdownNumber     = document.getElementById('countdown-number');
const currentChordName    = document.getElementById('current-chord-name');
const allChordsContainer = document.getElementById('all-chords-diagrams');
const chordHintText       = document.getElementById('chord-hint-text');
const pauseBtn  = document.getElementById('pause-btn');
const tempoBtns = document.querySelectorAll('.tempo-btn');
const modeBtns  = document.querySelectorAll('.mode-btn');

// ===== Web Audio API =====
const audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
const compressor = audioCtx.createDynamicsCompressor();
compressor.threshold.value = -10;
compressor.ratio.value     = 4;
compressor.connect(audioCtx.destination);

// ギター弦1本をプラック合成
function pluckString(freq, vol = 0.15, delaySec = 0) {
  try {
    const now = audioCtx.currentTime + delaySec;

    // ①ピックアタック（バンドパスノイズ）
    const noiseLen = Math.max(0.03, 60 / freq / 1000);
    const noiseBuf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * noiseLen), audioCtx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);

    const noiseSrc    = audioCtx.createBufferSource();
    noiseSrc.buffer   = noiseBuf;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type  = 'bandpass';
    noiseFilter.frequency.value = freq * 1.8;
    noiseFilter.Q.value = 0.8;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseLen);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(compressor);
    noiseSrc.start(now);
    noiseSrc.stop(now + noiseLen + 0.01);

    // ②倍音列（triangle波 = ギターに近い暖かみ）
    const harmonics = [
      { ratio: 1,   gain: 1.0,  decay: 2.2 },
      { ratio: 2,   gain: 0.38, decay: 1.6 },
      { ratio: 3,   gain: 0.18, decay: 1.1 },
      { ratio: 4,   gain: 0.09, decay: 0.75 },
      { ratio: 5,   gain: 0.04, decay: 0.5 },
      { ratio: 6,   gain: 0.02, decay: 0.35 },
    ];
    harmonics.forEach(h => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type   = 'triangle';
      osc.frequency.value = freq * h.ratio;
      // 少しデチューンしてコーラス感を出す
      osc.detune.value    = (Math.random() - 0.5) * 5;
      const pk = vol * h.gain;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(pk, now + 0.003); // 超速アタック
      gain.gain.exponentialRampToValueAtTime(0.0001, now + h.decay);
      osc.connect(gain);
      gain.connect(compressor);
      osc.start(now);
      osc.stop(now + h.decay + 0.05);
    });
  } catch(e) {}
}

// 実際のギターコード周波数（開放弦 + フレット計算）
// f(n) = f0 * 2^(n/12)  ※n = フレット数
const CHORD_FREQ = {
  G:  [98.0, 123.5, 146.8, 196.0, 246.9, 392.0],  // 3-2-0-0-0-3
  C:  [130.8, 164.8, 196.0, 261.6, 329.6],          // x-3-2-0-1-0
  D:  [146.8, 220.0, 293.7, 370.0],                 // x-x-0-2-3-2
  Em: [82.4, 123.5, 164.8, 196.0, 246.9, 329.6],   // 0-2-2-0-0-0
};

function strumChord(chord) {
  const freqs = CHORD_FREQ[chord];
  if (!freqs) return;
  const strumDelay = 0.016; // 弦ごとに16msずらしてストローク感を出す
  freqs.forEach((freq, i) => pluckString(freq, 0.14, i * strumDelay));
}

const CHORD_SOUNDS = {
  G:  () => strumChord('G'),
  C:  () => strumChord('C'),
  D:  () => strumChord('D'),
  Em: () => strumChord('Em'),
};

// カウントダウン用クリック音（シンプルなビープ）
function playBeep(freq, dur) {
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type   = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(compressor);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + dur);
  } catch(e) {}
}

// ===== Canvas リサイズ =====
function resizeCanvas() {
  const container = document.getElementById('lane-container');
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;
  state.canvasW = canvas.width;
  state.canvasH = canvas.height;
  state.timingLineX = Math.floor(canvas.width * TIMING_LINE_RATIO);
}

window.addEventListener('resize', resizeCanvas);

// ===== コード列を返す（モードに応じて繰り返す） =====
function getChordSequence() {
  if (state.beatsPerChord === 1) return CHORDS;
  const seq = [];
  for (const chord of CHORDS) {
    for (let i = 0; i < state.beatsPerChord; i++) seq.push(chord);
  }
  return seq; // ['G','G','G','G','C','C','C','C', ...]
}

// ===== ノーツ生成 =====
function generateNotes() {
  const seq     = getChordSequence();
  const seqLen  = seq.length;
  const spacing = state.canvasW * NOTE_SPACING_RATIO;
  const total   = seqLen * 3; // 3ループ分先読み
  return Array.from({ length: total }, (_, i) => ({
    chord:    seq[i % seqLen],
    x:        state.timingLineX + spacing * (i + 1),
    beat:     i,
    passed:   false,
    flash:    0,
    currentX: 0,
  }));
}

// ===== px/秒 =====
function getPixelsPerSec() {
  const spacing     = state.canvasW * NOTE_SPACING_RATIO;
  const beatDuration = 60 / state.bpm;
  return spacing / beatDuration;
}

// ===== メインループ =====
let lastBeatPlayed = -1;

function gameLoop(timestamp) {
  if (!state.running) return;

  const elapsed    = (timestamp - state.startTime) / 1000;
  const totalShift = getPixelsPerSec() * elapsed;

  ctx.clearRect(0, 0, state.canvasW, state.canvasH);
  drawGrid();

  // ── タイミングボックスをノーツより先に描画（後ろレイヤー） ──
  drawTimingBox(timestamp);

  let allPassed    = true;
  let closestChord = null, closestDist = Infinity;

  for (const note of state.notes) {
    const nx    = note.x - totalShift;
    note.currentX = nx;

    // 通過判定
    if (!note.passed && nx < state.timingLineX - NOTE_WIDTH * 0.5) {
      note.passed = true;
    }

    // 現在コード（タイミングライン最近接）
    if (!note.passed) {
      const dist = nx - state.timingLineX;
      if (dist >= -NOTE_WIDTH * 0.3) {
        allPassed = false;
        if (dist < closestDist) { closestDist = dist; closestChord = note.chord; }
      }
    }

    // 画面内のみ描画
    if (nx > -NOTE_WIDTH && nx < state.canvasW + NOTE_WIDTH) {
      drawNote(note, nx);
    }
  }

  drawHitEffects();

  // ループ終了 → リセット
  if (allPassed && state.notes.every(n => n.passed)) {
    loopReset(timestamp);
    return;
  }

  updateChordDisplay(closestChord);
  autoPlayBeat(timestamp);

  state.animFrameId = requestAnimationFrame(gameLoop);
}

// ===== 自動ビート音 =====
// ノーツは timingLineX + spacing*1 から出発するため、
// 最初のノーツが到達するのは beat 1（elapsed = 1拍分）のタイミング。
// beat 0（スタート直後）は音を鳴らさずスキップし、
// beat 1 から chord[0]=G を鳴らすことでノーツ到達と同期させる。
function autoPlayBeat(timestamp) {
  const elapsed      = (timestamp - state.startTime) / 1000;
  const beatDuration = 60 / state.bpm;
  const currentBeat  = Math.floor(elapsed / beatDuration);

  if (currentBeat === lastBeatPlayed) return;

  // beat 0 はノーツ未到達なのでスキップ
  if (currentBeat === 0) { lastBeatPlayed = 0; return; }

  lastBeatPlayed = currentBeat;

  // beat N が来たとき鳴らすのは seq[N-1]（ノーツの beat と一致）
  const seq        = getChordSequence();
  const seqLen     = seq.length;
  const chordIndex = (currentBeat - 1) % seqLen;
  const chord      = seq[chordIndex];
  CHORD_SOUNDS[chord]();
  state.timingFlash = 1;

  // ヒットエフェクト（スコア表示なし）
  for (const note of state.notes) {
    if (!note.passed && note.beat % seqLen === chordIndex) {
      const dist = Math.abs((note.currentX || 0) - state.timingLineX);
      if (dist < NOTE_WIDTH * 0.8) {
        note.flash = 1;
        addHitEffect(state.timingLineX, state.canvasH / 2, chord);
        break;
      }
    }
  }
}

// ===== グリッド描画 =====
function drawGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth   = 1;
  for (let y = 0; y < state.canvasH; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.canvasW, y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, state.canvasH / 2);
  ctx.lineTo(state.canvasW, state.canvasH / 2);
  ctx.stroke();
}

// ===== タイミングボックス（ノーツと同サイズ）をCanvas上に描画 =====
function drawTimingBox(timestamp) {
  const x     = state.timingLineX;
  const y     = state.canvasH / 2 - NOTE_HEIGHT / 2;
  const flash = state.timingFlash;

  ctx.save();

  // 縦の細グロー線（全高）
  const vGrad = ctx.createLinearGradient(x, 0, x, state.canvasH);
  vGrad.addColorStop(0,   'transparent');
  vGrad.addColorStop(0.25, `rgba(255,215,0,${0.15 + flash * 0.25})`);
  vGrad.addColorStop(0.5,  `rgba(255,215,0,${0.35 + flash * 0.45})`);
  vGrad.addColorStop(0.75, `rgba(255,215,0,${0.15 + flash * 0.25})`);
  vGrad.addColorStop(1,   'transparent');
  ctx.strokeStyle = vGrad;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0); ctx.lineTo(x, state.canvasH);
  ctx.stroke();

  // ノーツと同サイズの角丸ボックス
  ctx.shadowColor = `rgba(255,215,0,${0.5 + flash * 0.5})`;
  ctx.shadowBlur  = 12 + flash * 28;

  // 半透明塗り
  ctx.fillStyle = `rgba(255,215,0,${0.04 + flash * 0.12})`;
  roundRect(ctx, x - NOTE_WIDTH / 2, y, NOTE_WIDTH, NOTE_HEIGHT, NOTE_RADIUS);
  ctx.fill();

  // 破線ボーダー（回転アニメーション）
  ctx.shadowBlur  = 8 + flash * 20;
  ctx.strokeStyle = `rgba(255,215,0,${0.55 + flash * 0.45})`;
  ctx.lineWidth   = 2 + flash * 2;
  ctx.setLineDash([9, 5]);
  ctx.lineDashOffset = -(timestamp * 0.04) % 14;
  roundRect(ctx, x - NOTE_WIDTH / 2, y, NOTE_WIDTH, NOTE_HEIGHT, NOTE_RADIUS);
  ctx.stroke();
  ctx.setLineDash([]);

  // 上下の矢印
  ctx.shadowBlur  = 6;
  ctx.fillStyle   = `rgba(255,215,0,${0.6 + flash * 0.4})`;
  ctx.font        = '13px Arial';
  ctx.textAlign   = 'center';
  ctx.fillText('▼', x, y - 5);
  ctx.fillText('▲', x, y + NOTE_HEIGHT + 15);

  // フラッシュ減衰
  if (state.timingFlash > 0) {
    state.timingFlash = Math.max(0, state.timingFlash - 0.055);
  }

  ctx.restore();
}

// ===== ノーツ描画 =====
function drawNote(note, x) {
  const y      = state.canvasH / 2 - NOTE_HEIGHT / 2;
  const colors = CHORD_COLORS[note.chord];
  const flash  = note.flash || 0;

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur  = 10 + flash * 24;

  const grad = ctx.createLinearGradient(x - NOTE_WIDTH / 2, y, x - NOTE_WIDTH / 2, y + NOTE_HEIGHT);
  grad.addColorStop(0, colors.fill);
  grad.addColorStop(1, colors.dark);
  ctx.fillStyle = grad;
  roundRect(ctx, x - NOTE_WIDTH / 2, y, NOTE_WIDTH, NOTE_HEIGHT, NOTE_RADIUS);
  ctx.fill();

  ctx.strokeStyle = flash > 0 ? '#fff' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth   = flash > 0 ? 3 : 2;
  ctx.stroke();

  ctx.shadowBlur    = 0;
  ctx.fillStyle     = '#fff';
  ctx.font          = `900 ${note.chord.length > 2 ? '28' : '34'}px Helvetica Neue, Arial`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText(note.chord, x, y + NOTE_HEIGHT / 2);

  if (note.flash > 0) note.flash = Math.max(0, note.flash - 0.07);
  ctx.restore();
}

// ===== ヒットエフェクト =====
function addHitEffect(x, y, chord) {
  state.hitEffects.push({ x, y, chord, age: 0, maxAge: 32 });
}

function drawHitEffects() {
  for (let i = state.hitEffects.length - 1; i >= 0; i--) {
    const e        = state.hitEffects[i];
    const progress = e.age / e.maxAge;
    const colors   = CHORD_COLORS[e.chord];
    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.75;
    ctx.strokeStyle = colors.fill;
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur  = 18;
    ctx.lineWidth   = 3 * (1 - progress);
    const r = 28 + progress * 85;
    ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = (1 - progress) * 0.45;
    ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    e.age++;
    if (e.age >= e.maxAge) state.hitEffects.splice(i, 1);
  }
}

// ===== コード表示 + ダイアグラムハイライト + ヒント更新 =====
function updateChordDisplay(chord) {
  if (!chord) return;
  const prev = currentChordName.dataset.chord;
  if (prev === chord) return;

  currentChordName.dataset.chord = chord;
  currentChordName.textContent   = chord;
  currentChordName.className     = `chord-${chord}`;

  // バウンスアニメーション
  currentChordName.classList.remove('popping');
  void currentChordName.offsetWidth; // reflow で animation をリセット
  currentChordName.classList.add('popping');

  // フラッシュエフェクト
  const chordFlash = document.getElementById('chord-flash');
  const flashColor = CHORD_COLORS[chord]?.fill || '#fff';
  chordFlash.style.background = flashColor;
  chordFlash.classList.remove('flashing');
  void chordFlash.offsetWidth;
  chordFlash.classList.add('flashing');

  // アクティブカードをハイライト
  CHORDS.forEach(c => {
    const card = document.getElementById(`chord-card-${c}`);
    if (card) card.classList.toggle('active', c === chord);
  });

  chordHintText.innerHTML = buildHintHTML(chord);

  // メモエリアを切り替え
  const color = CHORD_COLORS[chord]?.fill || '#fff';
  memoChordName.textContent  = chord;
  memoChordName.style.color  = color;
  memoTextarea.value         = loadMemo(chord);
  memoTextarea.placeholder   = `${chord} の練習メモを書こう...`;
}

// ===== 子ども向けフィンガーヒントHTML生成 =====
function buildHintHTML(chord) {
  const h      = CHORD_HINTS[chord];
  const color  = CHORD_COLORS[chord]?.fill || '#fff';
  if (!h) return '';

  let html = '';
  if (h.vibe) {
    html += `<div class="hint-vibe">${h.vibe}</div>`;
  }
  h.fingers.forEach(f => {
    html += `<div class="hint-row">
      <span class="finger-badge" style="background:${color}">${f.num}</span>
      <span class="hint-finger">${f.label}</span>
      <span class="hint-sep">→</span>
      <span class="hint-pos">${f.pos}</span>
    </div>`;
  });
  if (h.note) {
    html += `<div class="hint-note">${h.note}</div>`;
  }
  return html;
}

// ===== コードダイアグラムSVG生成 =====
function buildChordDiagramSVG(chordName) {
  const def = CHORD_DIAGRAMS[chordName];
  if (!def) return '';

  const W = 148, H = 152;
  const strings    = 6;
  const fretCount  = 4;
  const mL = 24, mR = 12, mT = 30, mB = 10;
  const nutH = 5;

  const gridW  = W - mL - mR;
  const gridH  = H - mT - mB - nutH;
  const strSp  = gridW / (strings - 1);
  const fretSp = gridH / fretCount;
  const dotR   = strSp * 0.37;

  const color = CHORD_COLORS[chordName]?.fill || '#fff';

  // 弦番号→X座標（6弦=左, 1弦=右）
  const sx = s => mL + (6 - s) * strSp;
  // フレット→Y座標（中心）
  const fy = f => mT + nutH + (f - def.startFret + 0.5) * fretSp;

  // 左90°回転: width/heightはCSSに委ねてviewBoxのみ指定
  let s = `<svg viewBox="0 0 ${H} ${W}" xmlns="http://www.w3.org/2000/svg">`;
  s += `<g transform="translate(0, ${W}) rotate(-90)">`;

  // 背景
  s += `<rect width="${W}" height="${H}" rx="10" fill="rgba(0,0,0,0.55)"/>`;

  // ナット（太い横線）
  s += `<rect x="${mL}" y="${mT}" width="${gridW}" height="${nutH}" fill="#ccc" rx="2"/>`;

  // フレット横線
  for (let f = 1; f <= fretCount; f++) {
    const y = mT + nutH + f * fretSp;
    s += `<line x1="${mL}" y1="${y}" x2="${mL + gridW}" y2="${y}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`;
  }

  // 弦縦線（6弦ほど太く）
  for (let i = 0; i < strings; i++) {
    const x  = mL + i * strSp;
    const sw = 1 + (strings - 1 - i) * 0.28;
    s += `<line x1="${x}" y1="${mT + nutH}" x2="${x}" y2="${mT + nutH + fretCount * fretSp}" stroke="rgba(255,255,255,0.5)" stroke-width="${sw.toFixed(2)}"/>`;
  }

  // ミュート / 開放の印（ナット上）
  for (let sNum = 1; sNum <= strings; sNum++) {
    const x  = sx(sNum);
    const iy = mT - 9;
    if (def.muted?.includes(sNum)) {
      s += `<text x="${x}" y="${iy}" text-anchor="middle" fill="#FF6B6B" font-size="12" font-weight="bold" transform="rotate(90, ${x}, ${iy})">✕</text>`;
    } else if (def.openStrings?.includes(sNum)) {
      s += `<circle cx="${x}" cy="${iy - 2}" r="4.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>`;
    }
  }

  // 指ドット（数字入り）
  def.dots.forEach(dot => {
    const x = sx(dot.string);
    const y = fy(dot.fret);
    s += `<circle cx="${x}" cy="${y}" r="${dotR.toFixed(1)}" fill="${color}" opacity="0.95"/>`;
    s += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="#1a1a2e" font-size="11" font-weight="bold" transform="rotate(90, ${x}, ${y})">${dot.finger}</text>`;
  });

  // フレット番号（左側）
  for (let f = 1; f <= fretCount; f++) {
    const y = mT + nutH + (f - 0.5) * fretSp;
    s += `<text x="${mL - 9}" y="${(y + 4).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,0.28)" font-size="9" transform="rotate(90, ${mL - 9}, ${(y + 4).toFixed(1)})">${f}</text>`;
  }

  // 弦番号（下側、1〜6）
  for (let i = 0; i < strings; i++) {
    const x    = mL + i * strSp;
    const sNum = 6 - i;
    s += `<text x="${x}" y="${H - mB + 2}" text-anchor="middle" fill="rgba(255,255,255,0.22)" font-size="8" transform="rotate(90, ${x}, ${H - mB + 2})">${sNum}弦</text>`;
  }

  s += `</g></svg>`;
  return s;
}

// ===== ループリセット =====
function loopReset(timestamp) {
  state.loopCount++;
  state.startTime   = timestamp;
  state.notes       = generateNotes();
  lastBeatPlayed    = 0;   // ループ先頭も beat 0 スキップ
  state.animFrameId = requestAnimationFrame(gameLoop);
}

// ===== スタート / ストップ =====
startBtn.addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  state.running ? stopGame() : startCountdown();
});

// ===== 一時停止 / 再開 =====
pauseBtn.addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  state.paused ? resumeGame() : pauseGame();
});

function pauseGame() {
  if (!state.running || state.paused) return;
  state.paused   = true;
  state.pausedAt = performance.now() - state.startTime; // 経過msを保存
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);

  pauseBtn.textContent = '▶ 再開';
  pauseBtn.classList.add('paused');
}

function resumeGame() {
  if (!state.running || !state.paused) return;
  state.paused    = false;
  // 再開時に startTime をずらして経過時間を引き継ぐ
  state.startTime = performance.now() - state.pausedAt;
  state.animFrameId = requestAnimationFrame(gameLoop);

  pauseBtn.textContent = '⏸ 一時停止';
  pauseBtn.classList.remove('paused');
}

function startCountdown() {
  startBtn.disabled = true;
  resizeCanvas();

  const steps = ['3', '2', '1', 'スタート！'];
  let i = 0;
  countdownOverlay.classList.remove('hidden');

  function showStep() {
    countdownNumber.textContent  = steps[i];
    countdownNumber.style.animation = 'none';
    void countdownNumber.offsetWidth;
    countdownNumber.style.animation = 'pulse-count 0.8s ease-out';
    if (i < 3) playBeep(800 - i * 100, 0.1);
    else        playBeep(1100, 0.15);
    i++;
    if (i < steps.length) setTimeout(showStep, 800);
    else setTimeout(() => { countdownOverlay.classList.add('hidden'); startGame(); }, 600);
  }
  showStep();
}

function startGame() {
  resizeCanvas();
  state.running     = true;
  state.notes       = generateNotes();
  state.hitEffects  = [];
  state.loopCount   = 0;
  state.timingFlash = 0;
  lastBeatPlayed    = 0;   // beat 0 はスキップ済み扱いにしてスタート直後の誤発音を防ぐ
  startBtn.textContent = '■ ストップ';
  startBtn.classList.add('stop');
  startBtn.disabled    = false;

  pauseBtn.textContent = '⏸ 一時停止';
  pauseBtn.classList.remove('paused');
  pauseBtn.classList.add('visible');

  state.startTime   = performance.now();
  state.animFrameId = requestAnimationFrame(gameLoop);
}

function stopGame() {
  state.running = false;
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  ctx.clearRect(0, 0, state.canvasW, state.canvasH);
  drawGrid();

  state.paused = false;
  startBtn.textContent = '▶ スタート';
  startBtn.classList.remove('stop');

  pauseBtn.classList.remove('visible', 'paused');
  pauseBtn.textContent = '⏸ 一時停止';

  // スタンバイ状態に戻す
  showStandby();
}

// ===== テンポ切替 =====
tempoBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.bpm = parseInt(btn.dataset.tempo);
    tempoBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (state.running && !state.paused) {
      state.startTime = performance.now();
      state.notes     = generateNotes();
      lastBeatPlayed  = 0;
    }
  });
});

// ===== モード切替（1拍 / 4拍） =====
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.beatsPerChord = parseInt(btn.dataset.beats);
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (state.running && !state.paused) {
      state.startTime = performance.now();
      state.notes     = generateNotes();
      lastBeatPlayed  = 0;
    }
  });
});

// ===== ユーティリティ: 角丸矩形パス =====
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ===== メモ: localStorage への読み書き =====
function loadMemo(chord) {
  return localStorage.getItem(`chord-memo-${chord}`) || '';
}

function saveMemo(chord, text) {
  localStorage.setItem(`chord-memo-${chord}`, text);
}

// ===== 初期化 =====
function initChordDiagrams() {
  CHORDS.forEach(chord => {
    const card = document.createElement('div');
    card.className = `chord-card chord-${chord}`;
    card.id = `chord-card-${chord}`;
    card.innerHTML = `<div class="chord-card-name chord-${chord}">${chord}</div>${buildChordDiagramSVG(chord)}`;

    // ゲーム停止中はクリックでコード情報を切り替え
    card.addEventListener('click', () => {
      if (!state.running) {
        currentChordName.dataset.chord = ''; // 同じコードでも再表示できるようリセット
        updateChordDisplay(chord);
      }
    });

    allChordsContainer.appendChild(card);
  });
}

// ===== 大きなメモエリアの初期化 =====
const memoTextarea  = document.getElementById('memo-textarea');
const memoChordName = document.getElementById('memo-chord-name');

memoTextarea.addEventListener('input', () => {
  const chord = currentChordName.dataset.chord;
  if (chord) saveMemo(chord, memoTextarea.value);
});
memoTextarea.addEventListener('keydown', e => e.stopPropagation());

resizeCanvas();
drawGrid();
initChordDiagrams();

// ===== スタンバイ表示（スタート前にG コードを見せておく）=====
function showStandby() {
  // dataset.chord をリセットして updateChordDisplay が通るようにする
  currentChordName.dataset.chord = '';
  updateChordDisplay(CHORDS[0]);
}
showStandby();
