// ============================================================
// game.js ― ゲームの仕組み（段階①：歩く）
// ============================================================
'use strict';

// ---- 定数 ----
const T_WALL = 0;   // 壁
const T_ROOM = 1;   // 部屋の床
const T_CORR = 2;   // 通路
// 8方向（右から時計回り）。画面は下向きがY+
const DIRS = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];

// ---- ゲームの状態 ----
const state = {
  dungeonId: 'cave',
  floor: 1,
  turn: 0,
  map: null,        // map[y][x] = タイル種別
  rooms: [],        // 部屋の一覧 {x, y, w, h, dummy}
  explored: null,   // 一度でも見たマス
  visible: null,    // 今見えているマス
  stairs: { x: 0, y: 0 },
  player: { x: 0, y: 0, rx: 0, ry: 0, dir: 2 },
  logs: [],
  showMini: false,
  locked: false,    // オーバーレイ表示中など、操作を受け付けない状態
};

// ---- 便利関数 ----
const $ = (id) => document.getElementById(id);
function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function idx(x, y) { return y * DATA.map.width + x; }
function inMap(x, y) {
  return x >= 0 && y >= 0 && x < DATA.map.width && y < DATA.map.height;
}
function walkable(x, y) { return inMap(x, y) && state.map[y][x] !== T_WALL; }

// ============================================================
// マップ生成
// 3×3の区画に部屋（または通路の分岐点）を置き、隣同士を通路でつなぐ
// ============================================================
function generateFloor() {
  const cfg = DATA.map;
  const W = cfg.width, H = cfg.height;
  const cw = Math.floor(W / cfg.gridX);
  const ch = Math.floor(H / cfg.gridY);
  const map = Array.from({ length: H }, () => new Uint8Array(W));

  // どの区画を分岐点（ダミー）にするか
  const total = cfg.gridX * cfg.gridY;
  const dummyCount = rand(0, cfg.dummyMax);
  const dummySet = new Set(shuffle([...Array(total).keys()]).slice(0, dummyCount));

  // 区画ごとに部屋を作る
  const rooms = [];
  for (let gy = 0; gy < cfg.gridY; gy++) {
    for (let gx = 0; gx < cfg.gridX; gx++) {
      const i = gy * cfg.gridX + gx;
      const cx = gx * cw, cy = gy * ch;
      let room;
      if (dummySet.has(i)) {
        room = { x: rand(cx + 2, cx + cw - 3), y: rand(cy + 2, cy + ch - 3), w: 1, h: 1, dummy: true };
      } else {
        const w = rand(4, cw - 4);
        const h = rand(3, ch - 4);
        room = { x: rand(cx + 1, cx + cw - 1 - w), y: rand(cy + 1, cy + ch - 1 - h), w, h, dummy: false };
      }
      rooms.push(room);
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          map[y][x] = room.dummy ? T_CORR : T_ROOM;
        }
      }
    }
  }

  // 区画のつながりを決める（全体が必ずつながるように木構造を作り、少し追加）
  const links = [];
  const linked = new Set();
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const neighbors = (i) => {
    const gx = i % cfg.gridX, gy = Math.floor(i / cfg.gridX);
    const list = [];
    if (gx > 0) list.push(i - 1);
    if (gx < cfg.gridX - 1) list.push(i + 1);
    if (gy > 0) list.push(i - cfg.gridX);
    if (gy < cfg.gridY - 1) list.push(i + cfg.gridX);
    return list;
  };
  const visited = new Set([rand(0, total - 1)]);
  const stack = [...visited];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const next = shuffle(neighbors(cur)).find((n) => !visited.has(n));
    if (next === undefined) { stack.pop(); continue; }
    visited.add(next);
    stack.push(next);
    links.push([cur, next]);
    linked.add(key(cur, next));
  }
  const candidates = [];
  for (let i = 0; i < total; i++) {
    for (const n of neighbors(i)) {
      if (i < n && !linked.has(key(i, n))) candidates.push([i, n]);
    }
  }
  shuffle(candidates).slice(0, cfg.extraLinks).forEach((l) => links.push(l));

  // 通路を掘る
  const carve = (x, y) => { if (map[y][x] === T_WALL) map[y][x] = T_CORR; };
  for (let [a, b] of links) {
    if (a > b) [a, b] = [b, a];
    const A = rooms[a], B = rooms[b];
    if (b - a === 1) {
      // 横につながる（AがBの左）
      const ay = rand(A.y, A.y + A.h - 1);
      const by = rand(B.y, B.y + B.h - 1);
      const bx = rand(A.x + A.w, B.x - 1);
      for (let x = A.x + A.w - 1; x <= bx; x++) carve(x, ay);
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) carve(bx, y);
      for (let x = bx; x <= B.x; x++) carve(x, by);
    } else {
      // 縦につながる（AがBの上）
      const ax = rand(A.x, A.x + A.w - 1);
      const bx = rand(B.x, B.x + B.w - 1);
      const by = rand(A.y + A.h, B.y - 1);
      for (let y = A.y + A.h - 1; y <= by; y++) carve(ax, y);
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) carve(x, by);
      for (let y = by; y <= B.y; y++) carve(bx, y);
    }
  }

  // 階段と主人公の配置（別々の部屋に置く）
  const realRooms = shuffle(rooms.filter((r) => !r.dummy));
  const stairsRoom = realRooms[0];
  const startRoom = realRooms.length > 1 ? realRooms[1] : realRooms[0];
  const pickIn = (r) => ({ x: rand(r.x, r.x + r.w - 1), y: rand(r.y, r.y + r.h - 1) });
  const stairs = pickIn(stairsRoom);
  let start = pickIn(startRoom);
  while (start.x === stairs.x && start.y === stairs.y) start = pickIn(startRoom);

  state.map = map;
  state.rooms = rooms;
  state.stairs = stairs;
  state.explored = new Uint8Array(W * H);
  state.visible = new Uint8Array(W * H);
  const p = state.player;
  p.x = p.rx = start.x;
  p.y = p.ry = start.y;
  updateVisibility();
}

// その位置がどの部屋の中か（通路なら -1）
function roomAt(x, y) {
  for (let i = 0; i < state.rooms.length; i++) {
    const r = state.rooms[i];
    if (r.dummy) continue;
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}

// ============================================================
// 視界：部屋の中なら部屋全体、通路なら周囲1マスだけ見える
// ============================================================
function updateVisibility() {
  const p = state.player;
  state.visible.fill(0);
  const mark = (x, y) => {
    if (!inMap(x, y)) return;
    state.visible[idx(x, y)] = 1;
    state.explored[idx(x, y)] = 1;
  };
  const r = roomAt(p.x, p.y);
  if (r >= 0) {
    const room = state.rooms[r];
    for (let y = room.y - 1; y <= room.y + room.h; y++) {
      for (let x = room.x - 1; x <= room.x + room.w; x++) mark(x, y);
    }
  }
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) mark(p.x + dx, p.y + dy);
  }
}

// ============================================================
// 移動
// ============================================================
function canMove(x, y, d) {
  const [dx, dy] = DIRS[d];
  if (!walkable(x + dx, y + dy)) return false;
  // 斜め移動は、角の壁をすり抜けられない
  if (dx !== 0 && dy !== 0) {
    if (!walkable(x + dx, y) || !walkable(x, y + dy)) return false;
  }
  return true;
}

// 1歩動く。連続移動を続けてよければ true を返す
function stepPlayer(d) {
  if (state.locked) return false;
  const p = state.player;
  p.dir = d;
  if (!canMove(p.x, p.y, d)) return false; // 壁：向きだけ変わる（ターンは進まない）

  const prevRoom = roomAt(p.x, p.y);
  p.x += DIRS[d][0];
  p.y += DIRS[d][1];
  state.turn++;
  updateVisibility();

  let keepGoing = true;
  if (onStairs()) {
    addLog('階段がある。');
    keepGoing = false;
  }
  // 通路から部屋に入ったら、連続移動を止める
  if (prevRoom === -1 && roomAt(p.x, p.y) !== -1) keepGoing = false;

  updateUI();
  return keepGoing;
}

function onStairs() {
  const p = state.player;
  return p.x === state.stairs.x && p.y === state.stairs.y;
}

// 決定ボタン：階段の上なら降りる、それ以外は足踏み
function doAction() {
  if (state.locked) return;
  if (onStairs()) {
    descend();
  } else {
    state.turn++;
    addLog('足踏みした。');
    updateUI();
  }
}

function descend() {
  const dungeon = DATA.dungeons[state.dungeonId];
  if (state.floor >= dungeon.floors) {
    showOverlay(
      '生還！',
      `${dungeon.name}を踏破した。<br>${state.turn}ターン`,
      'もう一度潜る',
      startDungeon
    );
    return;
  }
  state.floor++;
  generateFloor();
  addLog(`${state.floor}階に降りた。`);
  updateUI();
}

function startDungeon() {
  hideOverlay();
  state.floor = 1;
  state.turn = 0;
  state.logs = [];
  generateFloor();
  addLog(`${DATA.dungeons[state.dungeonId].name}に入った。`);
  updateUI();
}

// ============================================================
// 画面表示（UI部分）
// ============================================================
function addLog(msg) {
  state.logs.push(msg);
  if (state.logs.length > 3) state.logs.shift();
  $('log').innerHTML = state.logs.map((m) => `<div>${m}</div>`).join('');
}

function updateUI() {
  $('dungeon-name').textContent = DATA.dungeons[state.dungeonId].name;
  $('floor').textContent = `${state.floor}F`;
  $('turn').textContent = `${state.turn}ターン`;
  $('btn-action').textContent = onStairs() ? '降りる' : '足踏み';
}

function showOverlay(title, text, btnLabel, onClick) {
  state.locked = true;
  $('ov-title').textContent = title;
  $('ov-text').innerHTML = text;
  $('ov-btn').textContent = btnLabel;
  $('ov-btn').onclick = onClick;
  $('overlay').classList.remove('hidden');
}
function hideOverlay() {
  state.locked = false;
  $('overlay').classList.add('hidden');
}

// ============================================================
// 描画（キャンバス）
// ============================================================
const canvas = $('map');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

function render() {
  const C = DATA.colors;
  const { w, h } = resizeCanvas();
  const ts = w / DATA.view.cols; // 1マスの大きさ
  const p = state.player;

  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, w, h);

  // カメラ（主人公が画面中央に来るように）
  const camX = p.rx * ts + ts / 2 - w / 2;
  const camY = p.ry * ts + ts / 2 - h / 2;
  const x0 = Math.max(0, Math.floor(camX / ts) - 1);
  const y0 = Math.max(0, Math.floor(camY / ts) - 1);
  const x1 = Math.min(DATA.map.width - 1, Math.ceil((camX + w) / ts) + 1);
  const y1 = Math.min(DATA.map.height - 1, Math.ceil((camY + h) / ts) + 1);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = idx(x, y);
      if (!state.explored[i]) continue;
      const sx = x * ts - camX, sy = y * ts - camY;
      const t = state.map[y][x];
      ctx.fillStyle = t === T_WALL ? C.wall : t === T_ROOM ? C.room : C.corridor;
      ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
      if (t !== T_WALL) {
        ctx.strokeStyle = C.gridLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);
      }
      // 階段
      if (x === state.stairs.x && y === state.stairs.y) drawStairs(sx, sy, ts);
      // 今見えていないマスは暗くする
      if (!state.visible[i]) {
        ctx.fillStyle = C.fog;
        ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
      }
    }
  }

  // スティックで狙っているマスを枠で表示
  if (stick.active && stick.dir !== null) {
    const [dx, dy] = DIRS[stick.dir];
    const ok = canMove(p.x, p.y, stick.dir);
    ctx.strokeStyle = ok ? C.target : 'rgba(255,80,80,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect((p.x + dx) * ts - camX + 2, (p.y + dy) * ts - camY + 2, ts - 4, ts - 4);
  }

  drawPlayer(p.rx * ts - camX, p.ry * ts - camY, ts, p.dir);

  if (state.showMini) drawMiniMap(w, h);
}

function drawStairs(sx, sy, ts) {
  ctx.fillStyle = DATA.colors.stairs;
  const pad = ts * 0.18;
  const step = (ts - pad * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const bw = (ts - pad * 2) * (1 - i * 0.25);
    ctx.fillRect(sx + (ts - bw) / 2, sy + pad + i * step, bw, step * 0.6);
  }
}

// 仮の主人公：赤いマント＋紺のスーツ＋顔、向きの矢印
function drawPlayer(sx, sy, ts, dir) {
  const C = DATA.colors;
  const cx = sx + ts / 2, cy = sy + ts / 2;
  ctx.fillStyle = C.cape;
  ctx.beginPath(); ctx.arc(cx, cy + ts * 0.06, ts * 0.38, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.suit;
  ctx.beginPath(); ctx.arc(cx, cy + ts * 0.08, ts * 0.24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.face;
  ctx.beginPath(); ctx.arc(cx, cy - ts * 0.12, ts * 0.16, 0, Math.PI * 2); ctx.fill();
  // 向き
  const [dx, dy] = DIRS[dir];
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const tipX = cx + ux * ts * 0.5, tipY = cy + uy * ts * 0.5;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(cx + ux * ts * 0.34 - uy * ts * 0.1, cy + uy * ts * 0.34 + ux * ts * 0.1);
  ctx.lineTo(cx + ux * ts * 0.34 + uy * ts * 0.1, cy + uy * ts * 0.34 - ux * ts * 0.1);
  ctx.closePath();
  ctx.fill();
}

function drawMiniMap(w, h) {
  const C = DATA.colors;
  const W = DATA.map.width, H = DATA.map.height;
  const s = Math.min((w - 24) / W, (h - 24) / H);
  const ox = (w - W * s) / 2, oy = (h - H * s) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!state.explored[idx(x, y)]) continue;
      const t = state.map[y][x];
      if (t === T_WALL) continue;
      ctx.fillStyle = t === T_ROOM ? C.miniRoom : C.miniCorridor;
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
  }
  if (state.explored[idx(state.stairs.x, state.stairs.y)]) {
    ctx.fillStyle = C.stairs;
    ctx.fillRect(ox + state.stairs.x * s, oy + state.stairs.y * s, s, s);
  }
  ctx.fillStyle = '#ff4d6d';
  ctx.beginPath();
  ctx.arc(ox + (state.player.x + 0.5) * s, oy + (state.player.y + 0.5) * s, Math.max(2.5, s * 0.7), 0, Math.PI * 2);
  ctx.fill();
}

// 毎フレームの処理（主人公の表示位置をなめらかに追従させる）
let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const p = state.player;
  const k = Math.min(1, dt * 22);
  p.rx += (p.x - p.rx) * k;
  p.ry += (p.y - p.ry) * k;
  if (Math.abs(p.x - p.rx) < 0.01) p.rx = p.x;
  if (Math.abs(p.y - p.ry) < 0.01) p.ry = p.y;
  render();
  requestAnimationFrame(frame);
}

// ============================================================
// 操作：8方向スティック
// 短く倒すと1歩、倒し続けると連続移動。斜めは判定を広めにしている
// ============================================================
const stick = { active: false, id: null, ox: 0, oy: 0, dir: null, halted: false, timer: null };
const zone = $('stick-zone');
const base = $('stick-base');
const knob = $('stick-knob');

// 角度を8方向に吸着させる（上下左右は35度、斜めは55度の幅）
function snapDir(angleDeg) {
  for (let i = 0; i < 8; i++) {
    const center = i * 45;
    const half = i % 2 === 0 ? 17.5 : 27.5;
    let diff = Math.abs(angleDeg - center) % 360;
    if (diff > 180) diff = 360 - diff;
    if (diff <= half) return i;
  }
  return 0;
}

function setStickDir(d) {
  if (d === stick.dir) return;
  clearTimeout(stick.timer);
  stick.dir = d;
  stick.halted = false;
  if (d === null) return;
  if (!stepPlayer(d)) stick.halted = true;
  stick.timer = setTimeout(repeatStep, DATA.control.repeatDelay);
}

function repeatStep() {
  if (!stick.active || stick.dir === null || stick.halted) return;
  if (!stepPlayer(stick.dir)) stick.halted = true;
  stick.timer = setTimeout(repeatStep, DATA.control.repeatInterval);
}

function updateStick(e) {
  const rect = zone.getBoundingClientRect();
  const dx = e.clientX - rect.left - stick.ox;
  const dy = e.clientY - rect.top - stick.oy;
  const dist = Math.hypot(dx, dy);
  const R = DATA.control.stickRadius;
  if (dist < DATA.control.deadZone) {
    knob.style.transform = 'translate(0px, 0px)';
    setStickDir(null);
    return;
  }
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  const d = snapDir(angle);
  const [sx, sy] = DIRS[d];
  const len = Math.hypot(sx, sy);
  const r = Math.min(dist, R);
  knob.style.transform = `translate(${(sx / len) * r}px, ${(sy / len) * r}px)`;
  setStickDir(d);
}

function releaseStick() {
  stick.active = false;
  stick.id = null;
  clearTimeout(stick.timer);
  stick.dir = null;
  stick.halted = false;
  base.classList.remove('active');
  base.style.left = '';
  base.style.top = '';
  knob.style.transform = 'translate(0px, 0px)';
}

zone.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (stick.active) return;
  zone.setPointerCapture(e.pointerId);
  const rect = zone.getBoundingClientRect();
  stick.active = true;
  stick.id = e.pointerId;
  stick.ox = e.clientX - rect.left;
  stick.oy = e.clientY - rect.top;
  // 触れた場所にスティックの土台を移動する
  base.style.left = `${stick.ox}px`;
  base.style.top = `${stick.oy}px`;
  base.classList.add('active');
  $('stick-hint').style.display = 'none';
});
zone.addEventListener('pointermove', (e) => {
  if (stick.active && e.pointerId === stick.id) updateStick(e);
});
zone.addEventListener('pointerup', (e) => { if (e.pointerId === stick.id) releaseStick(); });
zone.addEventListener('pointercancel', (e) => { if (e.pointerId === stick.id) releaseStick(); });

// ============================================================
// 操作：ボタン
// ============================================================
function onPress(id, fn) {
  $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
}
onPress('btn-action', doAction);
onPress('btn-mini', () => { state.showMini = !state.showMini; });
onPress('btn-swap', () => {
  const swapped = $('app').classList.toggle('swapped');
  try { localStorage.setItem('swapControls', swapped ? '1' : '0'); } catch (err) { /* 保存できなくても動作に支障なし */ }
});

// ============================================================
// 操作：キーボード（PCでの確認用）
// 矢印キー / テンキー / Q W E A D Z X C で8方向、スペースで決定、Mで地図
// ============================================================
const KEY_DIRS = {
  ArrowRight: 0, ArrowDown: 2, ArrowLeft: 4, ArrowUp: 6,
  6: 0, 3: 1, 2: 2, 1: 3, 4: 4, 7: 5, 8: 6, 9: 7,
  d: 0, c: 1, x: 2, z: 3, a: 4, q: 5, w: 6, e: 7,
};
window.addEventListener('keydown', (e) => {
  if (state.locked) {
    if (e.key === 'Enter' || e.key === ' ') $('ov-btn').click();
    return;
  }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k in KEY_DIRS) {
    e.preventDefault();
    stepPlayer(KEY_DIRS[k]);
  } else if (k === ' ' || k === 's' || k === '5') {
    e.preventDefault();
    doAction();
  } else if (k === 'm') {
    state.showMini = !state.showMini;
  }
});

// ============================================================
// 起動
// ============================================================
try {
  if (localStorage.getItem('swapControls') === '1') $('app').classList.add('swapped');
} catch (err) { /* 保存領域が使えない環境でも起動できるようにする */ }
startDungeon();
requestAnimationFrame(frame);
