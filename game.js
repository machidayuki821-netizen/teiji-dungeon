// ============================================================
// game.js ― ゲームの仕組み（段階⑥：迷宮を増やす）
// ============================================================
'use strict';
const GAME_VERSION = '6.0'; // プログラムのバージョン（画面右下に表示）

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
  player: null,     // startDungeon で作る
  enemies: [],      // この階にいる敵
  floorItems: [],   // この階に落ちているアイテム {x, y, item}
  bag: [],          // 持ち物 [{uid, id}]
  identified: new Set(), // 識別済みのアイテムID
  looks: {},        // 未識別のときの見た目 {アイテムID: '青い草'}
  bagOpen: false,   // 持ち物画面を開いているか
  bagMode: 'normal',// normal=通常 / identify=識別の巻物 / oracle=神託（帰還の糸）
  sensed: false,    // 危険察知を使った階か（敵の位置が分かる）
  bagSel: null,     // 選んでいるアイテムのuid
  popups: [],       // ダメージ数字などの表示
  logs: [],
  showMini: false,  // 地図の常時表示
  turnMode: false,  // 向き変えモード（スティックで向きだけ変える）
  locked: false,    // オーバーレイ表示中など、操作を受け付けない状態
  inVillage: false, // 村の画面を開いているか
  runTony: 0,       // 今回の探索で拾ったトニー（生還すると持ち帰れる）
  threadsUsed: 0,   // 今回の探索で使った帰還の糸の本数（今日の迷宮の記録用）
  portal: false,    // この階の階段が「帰還の魔法陣」か（ボスの階）
  ovSel: 0,         // メッセージ画面で選んでいるボタン（ジョイスティック操作用）
  test: false,      // テスト用の開始か
};
let nextEnemyId = 1;
let nextItemUid = 1;

// ---- 便利関数 ----
const $ = (id) => document.getElementById(id);
// 乱数。今日の迷宮では、地形などを作る間だけ「日付から決まる乱数」に切り替える
let RNG = Math.random;
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function withSeed(seed, fn) {
  RNG = seededRandom(seed);
  try { fn(); } finally { RNG = Math.random; }
}
// 今日の日付（端末の時刻で）
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateSeed(key) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rand(a, b) { return a + Math.floor(RNG() * (b - a + 1)); }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(RNG() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function idx(x, y) { return y * DATA.map.width + x; }
function inMap(x, y) {
  return x >= 0 && y >= 0 && x < DATA.map.width && y < DATA.map.height;
}
function walkable(x, y) { return inMap(x, y) && state.map[y][x] !== T_WALL; }
function dist(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
function dirTo(ax, ay, bx, by) {
  const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
  return DIRS.findIndex(([x, y]) => x === dx && y === dy);
}
function enemyAt(x, y) { return state.enemies.find((e) => e.x === x && e.y === y) || null; }
function isOccupied(x, y) {
  const p = state.player;
  return (p.x === x && p.y === y) || !!enemyAt(x, y);
}
function floorItemAt(x, y) { return state.floorItems.find((f) => f.x === x && f.y === y) || null; }
// 操作を受け付けない状態か（メッセージ画面や持ち物画面を開いている）
function busy() { return state.locked || state.bagOpen || state.inVillage; }

// ---- アイテム関連の便利関数 ----
function itemDef(item) { return DATA.items[item.id]; }
function newItem(id) {
  const def = DATA.items[id];
  const item = { uid: nextItemUid++, id };
  if (def.stack) item.count = rand(def.stack[0], def.stack[1]); // 束で持てるもの
  return item;
}
// 表示名（束の数つき）
function itemLabel(item) {
  if (item.id === 'tony') return `${item.amount}トニー`;
  return itemName(item) + (item.count ? `（${item.count}）` : '');
}
function isKnown(id) {
  const cat = DATA.items[id].cat;
  if (!DATA.unknownNames[cat]) return true;            // 武器・盾・投げ物は最初から分かる
  if (DATA.dungeons[state.dungeonId].identifyAll) return true;
  return state.identified.has(id);
}
function itemName(item) {
  return isKnown(item.id) ? itemDef(item).name : state.looks[item.id];
}
function identify(id) {
  if (isKnown(id)) return false;
  state.identified.add(id);
  return true;
}
// 時刻の表示（24時を過ぎたら 25:10 のように表示する）
function formatClock(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}
function clockPhase() {
  const c = state.player.clock, C = DATA.clock;
  if (c >= C.lastTrain) return 'late';
  if (c >= C.overtime) return 'overtime';
  return 'work';
}

// 装備込みの攻撃力・防御力
function playerAtk() {
  const p = state.player;
  return p.atk + (p.weapon ? itemDef(p.weapon).atk : 0);
}
function playerDef() {
  const p = state.player;
  return p.def + (p.shield ? itemDef(p.shield).def : 0);
}

// ============================================================
// マップ生成
// 3×3の区画に部屋（または通路の分岐点）を置き、隣同士を通路でつなぐ
// ============================================================
function generateFloor() {
  const dungeon0 = DATA.dungeons[state.dungeonId];
  if (dungeon0.daily) withSeed(dateSeed(state.dailyKey) + state.floor * 7919, buildFloor);
  else buildFloor();
  updateVisibility();
}

function buildFloor() {
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
  state.enemies = [];
  state.floorItems = [];
  state.popups = [];
  state.sensed = false;
  const p = state.player;
  p.x = p.rx = start.x;
  p.y = p.ry = start.y;

  // 敵を配置（主人公のいる部屋には置かない）
  const dungeon = DATA.dungeons[state.dungeonId];
  const count = rand(dungeon.enemyStart[0], dungeon.enemyStart[1]);
  const startRoomIndex = rooms.indexOf(startRoom);
  for (let i = 0; i < count; i++) spawnEnemy(startRoomIndex);

  // アイテムを配置（階段と主人公の足元には置かない）
  const itemCount = rand(dungeon.itemStart[0], dungeon.itemStart[1]);
  const realList = rooms.filter((r) => !r.dummy);
  for (let i = 0; i < itemCount; i++) {
    for (let tries = 0; tries < 30; tries++) {
      const r = realList[rand(0, realList.length - 1)];
      const x = rand(r.x, r.x + r.w - 1), y = rand(r.y, r.y + r.h - 1);
      if (floorItemAt(x, y)) continue;
      if (x === stairs.x && y === stairs.y) continue;
      if (x === p.x && y === p.y) continue;
      state.floorItems.push({ x, y, item: newItem(pickItemType()) });
      break;
    }
  }

  // トニーの山を配置（額は階数に比例）
  const T = DATA.tony;
  const piles = rand(T.piles[0], T.piles[1]);
  for (let i = 0; i < piles; i++) {
    for (let tries = 0; tries < 30; tries++) {
      const r = realList[rand(0, realList.length - 1)];
      const x = rand(r.x, r.x + r.w - 1), y = rand(r.y, r.y + r.h - 1);
      if (floorItemAt(x, y)) continue;
      if (x === stairs.x && y === stairs.y) continue;
      if (x === p.x && y === p.y) continue;
      const item = { uid: nextItemUid++, id: 'tony', amount: rand(T.amount[0], T.amount[1]) * state.floor };
      state.floorItems.push({ x, y, item });
      break;
    }
  }

  // 最下層：階段のかわりに帰還の魔法陣。ボスがその前に立ちはだかる
  state.portal = !!(dungeon.floors && state.floor >= dungeon.floors && dungeon.boss);
  if (state.portal) {
    const spots = DIRS.map(([dx, dy]) => [stairs.x + dx, stairs.y + dy])
      .filter(([x, y]) => walkable(x, y) && !isOccupied(x, y));
    const [bx, by] = spots.length ? spots[rand(0, spots.length - 1)] : [stairs.x, stairs.y];
    addEnemy(dungeon.boss, bx, by);
  }
}

function pickItemType() {
  const table = DATA.dungeons[state.dungeonId].itemTable
    .filter((s) => state.floor >= s.from && state.floor <= s.to);
  const total = table.reduce((sum, s) => sum + s.weight, 0);
  let r = RNG() * total;
  for (const s of table) {
    r -= s.weight;
    if (r < 0) return s.id;
  }
  return table[0].id;
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
// 敵の出現
// ============================================================
function pickEnemyType() {
  const table = DATA.dungeons[state.dungeonId].spawnTable
    .filter((s) => state.floor >= s.from && state.floor <= s.to);
  const total = table.reduce((sum, s) => sum + s.weight, 0);
  let r = RNG() * total;
  for (const s of table) {
    r -= s.weight;
    if (r < 0) return s.id;
  }
  return table[0].id;
}

// 敵を1体出す。avoidRoom の部屋と、主人公から見えている場所には出さない
function spawnEnemy(avoidRoom) {
  const rooms = state.rooms
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => !r.dummy && i !== avoidRoom);
  for (let tries = 0; tries < 30; tries++) {
    const { r } = rooms[rand(0, rooms.length - 1)];
    const x = rand(r.x, r.x + r.w - 1);
    const y = rand(r.y, r.y + r.h - 1);
    if (isOccupied(x, y)) continue;
    if (x === state.stairs.x && y === state.stairs.y) continue;
    if (state.visible && state.visible[idx(x, y)]) continue;
    addEnemy(pickEnemyType(), x, y);
    return;
  }
}

// 敵を置く。深い階では強くなる（迷宮の scale）
function addEnemy(type, x, y) {
  const def = DATA.enemies[type];
  const sc = DATA.dungeons[state.dungeonId].scale;
  const over = sc ? Math.max(0, state.floor - sc.from) : 0;
  const hp = Math.round(def.hp * (1 + (sc ? sc.hp : 0) * over));
  const e = {
    id: nextEnemyId++, type, x, y, rx: x, ry: y,
    hp, maxHp: hp,
    atk: Math.round(def.atk * (1 + (sc ? sc.atk : 0) * over)),
    exp: Math.round(def.exp * (1 + (sc ? sc.hp : 0) * over)),
    alert: 0, tx: null, ty: null, flash: 0, sleep: 0, summonTimer: 0,
  };
  state.enemies.push(e);
  return e;
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

function visibleEnemyIds() {
  return new Set(state.enemies.filter((e) => state.visible[idx(e.x, e.y)]).map((e) => e.id));
}

// ============================================================
// 移動・攻撃（主人公）
// ============================================================
// 地形だけを見て、その方向に1マス進めるか（斜めは角の壁をすり抜けられない）
function canMove(x, y, d) {
  const [dx, dy] = DIRS[d];
  if (!walkable(x + dx, y + dy)) return false;
  if (dx !== 0 && dy !== 0) {
    if (!walkable(x + dx, y) || !walkable(x, y + dy)) return false;
  }
  return true;
}

// その方向に攻撃できる敵がいれば返す
function enemyInDir(d) {
  const p = state.player;
  if (!canMove(p.x, p.y, d)) return null;
  return enemyAt(p.x + DIRS[d][0], p.y + DIRS[d][1]);
}

// 1歩動く（敵がいれば攻撃）。連続移動を続けてよければ true を返す
function stepPlayer(d) {
  if (busy()) return false;
  const p = state.player;
  p.dir = d;

  const target = enemyInDir(d);
  if (target) {
    playerAttack(target);
    endTurn();
    return false; // 攻撃したら連続移動は止める
  }
  if (!canMove(p.x, p.y, d)) return false; // 壁：向きだけ変わる（ターンは進まない）

  const seenBefore = visibleEnemyIds();
  const prevRoom = roomAt(p.x, p.y);
  p.x += DIRS[d][0];
  p.y += DIRS[d][1];
  p.hop = 1;
  p.stepSide = -(p.stepSide || 1); // 1歩ごとに傾く向きを左右入れ替える
  updateVisibility();
  const hpBefore = p.hp;
  // 足元のアイテムを拾う（拾うのはターンを使わない）
  const pickedSomething = !!floorItemAt(p.x, p.y);
  if (pickedSomething) pickUp();
  endTurn();
  if (state.locked) return false;

  // 連続移動を止める場所
  let keepGoing = true;
  if (pickedSomething) keepGoing = false; // アイテムのあるマスに乗った
  const nowRoom = roomAt(p.x, p.y);
  if (onStairs()) {
    keepGoing = false;
    askStairs();
  }
  if (prevRoom === -1 && nowRoom !== -1) keepGoing = false; // 通路から部屋に入った
  if (prevRoom !== -1 && nowRoom === -1) keepGoing = false; // 部屋から通路に出た
  if (nowRoom === -1 && isJunction(p.x, p.y)) keepGoing = false; // 通路の分かれ道
  // 新しい敵が見えた、敵が隣にいる、攻撃を受けた
  const seenNow = visibleEnemyIds();
  for (const id of seenNow) if (!seenBefore.has(id)) keepGoing = false;
  if (state.enemies.some((e) => dist(e.x, e.y, p.x, p.y) <= 1)) keepGoing = false;
  if (p.hp < hpBefore) keepGoing = false;

  return keepGoing;
}

// 通路の分かれ道か（上下左右のうち3方向以上に進める）
function isJunction(x, y) {
  let n = 0;
  for (const d of [0, 2, 4, 6]) {
    if (walkable(x + DIRS[d][0], y + DIRS[d][1])) n++;
  }
  return n >= 3;
}

// その場で向きだけ変える（ターンは進まない）
function turnPlayer(d) {
  if (busy()) return;
  state.player.dir = d;
  updateUI();
}

function onStairs() {
  const p = state.player;
  return p.x === state.stairs.x && p.y === state.stairs.y;
}

// ダメージ計算：攻撃力 − 防御力 に、±12%のゆらぎ（最低1）
function calcDamage(atk, def) {
  const base = Math.max(1, atk - def);
  return Math.max(1, Math.round(base * (0.88 + Math.random() * 0.24)));
}

function playerAttack(e) {
  const p = state.player;
  const def = DATA.enemies[e.type];
  p.lunge = 1;
  if (Math.random() > DATA.player.hitRate) {
    addLog(`${def.name}への攻撃は外れた。`);
    addPopup(e.x, e.y, 'ミス', DATA.colors.dmgToEnemy);
    return;
  }
  const dmg = calcDamage(playerAtk(), def.def);
  e.hp -= dmg;
  e.flash = 1;
  e.sleep = 0; // 攻撃されたら目を覚ます
  e.alert = DATA.ai.alertTurns;
  addPopup(e.x, e.y, String(dmg), DATA.colors.dmgToEnemy);
  if (e.hp <= 0) {
    addLog(`${def.name}をたおした。経験値${e.exp || def.exp}`);
    killEnemy(e);
  } else {
    addLog(`${def.name}に${dmg}のダメージ。`);
  }
}

// 敵を倒したあとの処理（経験値・落とし物・ボスのごほうび）
function killEnemy(e) {
  const def = DATA.enemies[e.type];
  state.enemies = state.enemies.filter((x) => x !== e);
  gainExp(e.exp || def.exp);
  if (!def.boss) { dropLoot(e); return; }
  // ボスのごほうび
  const R = def.reward;
  state.runTony += R.tony;
  addLog(`${def.name}をたおした！　${R.tony}トニーを手に入れた。`);
  addPopup(e.x, e.y, `+${R.tony}ト`, DATA.colors.heal);
  placeDrop(e.x, e.y, R.items[rand(0, R.items.length - 1)], def.name);
  if (!save.bossBeaten[e.type] && !state.test) {
    save.bossBeaten[e.type] = true;
    addRevival(R.revival);
    writeSave();
    addLog('村の復興が少し進んだ！');
  }
}

function gainExp(amount) {
  const p = state.player;
  p.exp += amount;
  const table = DATA.player.expTable;
  while (p.level - 1 < table.length && p.exp >= table[p.level - 1]) {
    p.level++;
    p.maxHp += DATA.player.levelUp.hp;
    p.hp += DATA.player.levelUp.hp;
    p.atk += DATA.player.levelUp.atk;
    addLog(`レベル${p.level}に上がった！`);
    addPopup(p.x, p.y, 'LvUP', DATA.colors.heal);
  }
}

// 決定ボタン：向いている方向に敵がいれば攻撃、階段の上なら降りる、それ以外は足踏み
function doAction() {
  if (overlayOpen()) { pressOvSel(); return; }
  if (busy()) return;
  const p = state.player;
  const target = enemyInDir(p.dir);
  if (target) {
    playerAttack(target);
    endTurn();
  } else if (onStairs()) {
    descend();
  } else if (floorItemAt(p.x, p.y)) {
    if (pickUp()) endTurn();
  } else {
    addLog('足踏みした。');
    endTurn();
  }
}

// ============================================================
// ターンの終わり：自然回復 → 敵の行動 → 敵の出現 → 力尽きたか確認
// ============================================================
function endTurn() {
  const p = state.player;
  state.turn++;

  // 隠れ身の効果時間
  if (p.hidden > 0) {
    p.hidden--;
    if (p.hidden === 0) addLog('隠れ身の効果が切れた。');
  }

  // 時計を進める（24:00で止まる。17:00と24:00でお知らせ）
  const C = DATA.clock;
  const before = p.clock;
  p.clock = Math.min(C.lastTrain, p.clock + C.perTurn);
  if (before < C.overtime && p.clock >= C.overtime) showNotice('overtime');
  if (before < C.lastTrain && p.clock >= C.lastTrain) showNotice('lastTrain');

  // エナジードリンクの効果時間
  if (p.boost > 0) {
    p.boost--;
    if (p.boost === 0) addLog('エナジードリンクの効果が切れた。');
  }

  // 自然回復：勤務時間は通常、残業中は半分、終電後はなし
  // エナジードリンク中は2倍（終電後も回復するが、HPの減少は止まらない）
  const phase = clockPhase();
  let rate = phase === 'work' ? 1 : phase === 'overtime' ? C.overtimeRegen : 0;
  if (p.boost > 0) rate = (rate || C.overtimeRegen) * 2;
  if (rate > 0 && p.hp < p.maxHp) {
    p.regen += p.maxHp * DATA.player.regenRate * rate;
    if (p.regen >= 1) {
      const heal = Math.floor(p.regen);
      p.regen -= heal;
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }
  } else if (p.hp >= p.maxHp) {
    p.regen = 0;
  }
  if (phase === 'late') blinkClock();

  // 終電後は毎ターンHPが減る
  if (phase === 'late') {
    p.hp = Math.max(0, p.hp - C.drain);
    if (p.hp <= 0) state.deathCause = '終電を逃し、力尽きた';
  }

  // 敵の行動
  for (const e of [...state.enemies]) {
    if (p.hp <= 0) break;
    enemyAct(e);
  }

  // 敵の出現
  const dungeon = DATA.dungeons[state.dungeonId];
  if (state.turn % dungeon.spawnEvery === 0 && state.enemies.length < dungeon.enemyMax) {
    spawnEnemy(roomAt(p.x, p.y));
  }

  updateVisibility();
  updateUI();

  if (p.hp <= 0) onDeath();
}

// ============================================================
// 敵の行動
// ============================================================
function enemyCanSeePlayer(e) {
  const p = state.player;
  if (p.hidden > 0) return false;
  const er = roomAt(e.x, e.y);
  if (er !== -1 && er === roomAt(p.x, p.y)) return true;
  return dist(e.x, e.y, p.x, p.y) <= DATA.ai.sightRange;
}

function enemyAct(e) {
  const def = DATA.enemies[e.type];
  const p = state.player;

  // 眠っている敵は動かない
  if (e.sleep > 0) {
    e.sleep--;
    return;
  }

  // 主人公に気づいているか
  if (enemyCanSeePlayer(e)) {
    e.alert = DATA.ai.alertTurns;
    e.tx = p.x; e.ty = p.y;
  } else if (e.alert > 0) {
    e.alert--;
  }

  // 手下を呼ぶ（ボス）
  if (def.summon && e.alert > 0) {
    e.summonTimer++;
    const minions = state.enemies.filter((m) => m.minionOf === e.id).length;
    if (e.summonTimer >= def.summon.every && minions < def.summon.max) {
      const spots = DIRS.map(([dx, dy]) => [e.x + dx, e.y + dy]).filter(([x, y]) => walkable(x, y) && !isOccupied(x, y));
      if (spots.length) {
        e.summonTimer = 0;
        const [mx, my] = spots[rand(0, spots.length - 1)];
        const m = addEnemy(def.summon.ids[rand(0, def.summon.ids.length - 1)], mx, my);
        m.minionOf = e.id;
        m.alert = DATA.ai.alertTurns;
        m.tx = p.x; m.ty = p.y;
        addLog(def.summon.text);
        return; // 呼んだターンは動かない
      }
    }
  }

  // ふらふら動く敵は、半分の確率でランダムに動く
  if (def.move === 'erratic' && Math.random() < 0.5) {
    const dirs = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const d of dirs) {
      const nx = e.x + DIRS[d][0], ny = e.y + DIRS[d][1];
      if (nx === p.x && ny === p.y && canMove(e.x, e.y, d)) { enemyAttack(e); return; }
      if (canMove(e.x, e.y, d) && !isOccupied(nx, ny)) { e.x = nx; e.y = ny; return; }
    }
    return;
  }

  // 隣にいれば攻撃
  if (e.alert > 0 && dist(e.x, e.y, p.x, p.y) === 1) {
    const d = dirTo(e.x, e.y, p.x, p.y);
    if (canMove(e.x, e.y, d)) { enemyAttack(e); return; }
  }

  // 目的地を決める（気づいていれば主人公、そうでなければ適当な部屋）
  if (e.alert <= 0) {
    if (e.tx === null || (e.x === e.tx && e.y === e.ty) || Math.random() < 0.02) {
      const rooms = state.rooms.filter((r) => !r.dummy);
      const r = rooms[rand(0, rooms.length - 1)];
      e.tx = rand(r.x, r.x + r.w - 1);
      e.ty = rand(r.y, r.y + r.h - 1);
    }
  }
  if (e.tx === null) return;

  const d = nextStepToward(e, e.tx, e.ty);
  if (d === null) {
    if (e.alert <= 0) e.tx = null; // 行けないなら目的地を決め直す
    return;
  }
  e.x += DIRS[d][0];
  e.y += DIRS[d][1];
}

// 目的地までの最短ルートの1歩目を探す（他の敵と主人公は通れない）
function nextStepToward(e, tx, ty) {
  const W = DATA.map.width;
  const prev = new Int32Array(W * DATA.map.height).fill(-1);
  const start = idx(e.x, e.y);
  prev[start] = start;
  const queue = [start];
  let found = -1;
  let head = 0;
  while (head < queue.length && head < 900) {
    const cur = queue[head++];
    const cx = cur % W, cy = Math.floor(cur / W);
    if (cx === tx && cy === ty) { found = cur; break; }
    for (let d = 0; d < 8; d++) {
      if (!canMove(cx, cy, d)) continue;
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      const ni = idx(nx, ny);
      if (prev[ni] !== -1) continue;
      const isGoal = nx === tx && ny === ty;
      if (!isGoal && isOccupied(nx, ny)) continue;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  if (found === -1) return null;
  // ゴールからさかのぼって1歩目を求める
  let step = found;
  while (prev[step] !== start) step = prev[step];
  const sx = step % W, sy = Math.floor(step / W);
  if (isOccupied(sx, sy)) return null; // ゴールが主人公などで埋まっている
  return dirTo(e.x, e.y, sx, sy);
}

function enemyAttack(e) {
  const def = DATA.enemies[e.type];
  const p = state.player;
  e.lunge = 1;
  e.lungeDir = dirTo(e.x, e.y, p.x, p.y);
  if (Math.random() > def.hitRate) {
    addLog(`${def.name}の攻撃は外れた。`);
    addPopup(p.x, p.y, 'ミス', DATA.colors.dmgToPlayer);
    return;
  }
  const dmg = calcDamage(e.atk || def.atk, playerDef());
  p.hp = Math.max(0, p.hp - dmg);
  if (p.hp <= 0) state.deathCause = `${def.name}にやられた`;
  p.hurt = 1;
  addPopup(p.x, p.y, String(dmg), DATA.colors.dmgToPlayer);
  addLog(`${def.name}の攻撃。${dmg}のダメージ。`);
}

// ============================================================
// 階の移動・開始・力尽きる
// ============================================================
// 階段に乗ったときの確認
function askStairs() {
  const dungeon = DATA.dungeons[state.dungeonId];
  if (state.portal) {
    showOverlay(
      '帰還の魔法陣',
      'この魔法陣に乗れば、地上へ帰れる。<br>帰りますか？',
      [
        { label: '帰る', primary: true, onClick: () => { hideOverlay(); descend(); } },
        { label: 'そのまま', onClick: () => { hideOverlay(); addLog('魔法陣の上にいる。'); } },
      ]
    );
    return;
  }
  const last = dungeon.floors && state.floor >= dungeon.floors;
  showOverlay(
    '階段がある',
    last ? 'この先は出口だ。<br>地上へ戻りますか？' : `${state.floor + 1}階へ降りますか？`,
    [
      { label: last ? '戻る' : '降りる', primary: true, onClick: () => { hideOverlay(); descend(); } },
      { label: 'そのまま', onClick: () => { hideOverlay(); addLog('階段の上にいる。'); } },
    ]
  );
}

function descend() {
  const dungeon = DATA.dungeons[state.dungeonId];
  if (state.portal || (dungeon.floors && state.floor >= dungeon.floors)) {
    survive('踏破');
    return;
  }
  state.floor++;
  generateFloor();
  addLog(`${state.floor}階に降りた。`);
  updateUI();
}

function createPlayer() {
  const P = DATA.player;
  return {
    x: 0, y: 0, rx: 0, ry: 0, dir: 2,
    level: 1, exp: 0,
    hp: P.hp, maxHp: P.hp, atk: P.atk, def: P.def,
    regen: 0, lunge: 0, hurt: 0,
    weapon: null, shield: null, // 装備中のアイテム
    quiver: null,               // 装備中の投げ物（武器・盾とは別枠）
    hidden: 0,                  // 隠れ身の残りターン
    clock: DATA.clock.start,    // 現在時刻（0時からの分）
    boost: 0,                   // エナジードリンクの残りターン
    threads: DATA.dungeons[state.dungeonId].threads, // 帰還の糸の残り本数
    hop: 0,                     // 歩いたときに跳ねる動き
    stepSide: 1,                // 歩くときに傾く向き（1 / -1 を交互に）
  };
}

// 迷宮に入る。carried = 村から持ち込むアイテム（倉庫の形式 {id, count, unk}）
// opts = { test: true } でテスト開始（ボスの階から、強い状態で始める）
function startDungeon(carried, opts) {
  const o = opts || {};
  hideOverlay();
  state.dailyKey = todayKey();
  state.test = !!o.test;
  state.threadsUsed = 0;
  state.floor = 1;
  state.turn = 0;
  state.logs = [];
  state.player = createPlayer();
  state.bag = [];
  state.runTony = 0;
  state.deathCause = '';
  setupUnknownNames();
  // 持ち込んだアイテム。正体が分かっているものは、この迷宮でも最初から識別済み
  for (const x of carried || []) {
    const item = { uid: nextItemUid++, id: x.id };
    if (x.count) item.count = x.count;
    state.bag.push(item);
    if (!x.unk) state.identified.add(x.id);
  }
  // テスト：ボスの階から、レベルを上げて装備を持った状態で始める
  if (state.test) {
    const D = DATA.debug;
    state.floor = DATA.dungeons[state.dungeonId].floors || 1;
    gainExp(DATA.player.expTable[D.testLevel - 2] || 0);
    state.logs = [];
    for (const id of D.testItems) {
      if (state.bag.length >= DATA.bag.size) break;
      const item = newItem(id);
      state.bag.push(item);
      const cat = DATA.items[id].cat;
      if (cat === 'weapon' && !state.player.weapon) state.player.weapon = item;
      if (cat === 'shield' && !state.player.shield) state.player.shield = item;
    }
  }
  generateFloor();
  addLog(`${DATA.dungeons[state.dungeonId].name}に入った。${state.test ? '（テスト）' : ''}`);
  updateUI();
}

// 力尽きた：糸が残っていれば復活を確認する
function onDeath() {
  releaseStick();
  closeBag();
  const p = state.player;
  if (p.threads > 0) {
    showOverlay(
      '力尽きそうだ……',
      `<div class="aria">アリア「${DATA.aria.revive}」</div>帰還の糸を使って復活しますか？（残り${p.threads}本）`,
      [
        { label: '糸を使って復活', primary: true, onClick: () => watchAd(() => {
          p.threads--;
          state.threadsUsed++;
          p.hp = p.maxHp;
          p.hurt = 0;
          addLog('帰還の糸が光り、立ち上がった！');
          addPopup(p.x, p.y, '復活', DATA.colors.heal);
          updateUI();
        }, finalDeath) },
        { label: 'あきらめる', onClick: finalDeath },
      ]
    );
    return;
  }
  finalDeath();
}

function finalDeath() {
  hideOverlay();
  addLog('力尽きた……');
  if (DATA.dungeons[state.dungeonId].daily) {
    const isNew = recordDaily();
    writeSave();
    const p = state.player;
    showOverlay(
      '力尽きた……',
      `${state.deathCause || '力尽きた'}。<br>${DATA.dungeons[state.dungeonId].name} ${state.floor}階　${formatClock(p.clock)}　糸${state.threadsUsed}本` +
      (isNew ? '<br><b>今日の自己ベスト更新！</b>' : '') +
      (state.runTony ? `<br>拾った${state.runTony}トニーは失った` : ''),
      [
        { label: 'Xに貼る文章をコピー', primary: true, onClick: (ev) => copyShare(ev.currentTarget, false) },
        { label: '村へ戻る', onClick: openVillage },
      ]
    );
    return;
  }
  showDeathResult();
}

// 力尽きた結果。持ち物があれば、広告で1つだけ回収できる（遺品回収）
function showDeathResult(recovered) {
  const dungeon = DATA.dungeons[state.dungeonId];
  const p = state.player;
  const lost = state.runTony > 0 ? `拾った${state.runTony}トニーと持ち物は失った` : '持ち物はすべて失った';
  const buttons = [];
  if (!recovered && state.bag.length > 0) {
    buttons.push({ label: '遺品を1つ回収する（広告）', primary: true, onClick: () => {
      hideOverlay();
      watchAd(chooseRelic, showDeathResult, { title: '遺品回収', line: DATA.aria.relic });
    } });
  }
  buttons.push({ label: '村へ戻る', primary: buttons.length === 0, onClick: openVillage });
  showOverlay(
    '力尽きた……',
    `${state.deathCause || '力尽きた'}。<br>${dungeon.name} ${state.floor}階　${formatClock(p.clock)}<br>Lv${p.level}　${lost}` +
    (recovered ? `<br>${recovered}を回収して倉庫に送った。` : ''),
    buttons
  );
}

// 遺品回収：失った持ち物から1つ選んで倉庫に送る
function chooseRelic() {
  const buttons = state.bag.map((item) => ({
    label: itemLabel(item),
    onClick: () => {
      hideOverlay();
      const label = itemLabel(item);
      storeFromRun(item);
      writeSave();
      showDeathResult(label);
    },
  }));
  showOverlay('遺品回収', 'どれを持ち帰りますか？', buttons, true);
}

// 生還：帰ってきた時刻で評価する
function survive(how) {
  releaseStick();
  closeBag();
  hideOverlay();
  updateUI();
  const dungeon = DATA.dungeons[state.dungeonId];
  const p = state.player;
  const C = DATA.clock;
  let title, line;
  if (p.clock <= C.overtime) { title = '定時退社！'; line = DATA.aria.ontime; }
  else if (p.clock < C.lastTrain) {
    const over = p.clock - C.overtime;
    title = `残業 ${Math.floor(over / 60)}時間${over % 60}分`;
    line = DATA.aria.overtime;
  } else { title = '終電を逃した……'; line = DATA.aria.late; }

  // トニー：帰った時刻で倍率が変わる
  const M = DATA.tony.mult;
  const phase = p.clock <= C.overtime ? 'ontime' : p.clock < C.lastTrain ? 'overtime' : 'late';
  const multName = { ontime: '定時退社', overtime: '残業', late: '終電後' }[phase];
  const earned = Math.floor(state.runTony * M[phase]);
  save.tony += earned;
  // 持ち物は倉庫へ（入りきらない分は売る）。今日の迷宮はトニーだけ
  const daily = !!dungeon.daily;
  const count = daily ? 0 : state.bag.length;
  let soldTony = 0;
  if (!daily) for (const item of state.bag) soldTony += storeFromRun(item);
  save.tony += soldTony;
  if (!dungeon.daily && !state.test) save.cleared[state.dungeonId] = true;
  if (state.test) save.cleared[state.dungeonId] = true; // テストでも今日の迷宮を確認できるように
  const isNew = daily ? recordDaily() : false;
  writeSave();

  showOverlay(
    `生還！　${title}`,
    `<div class="aria">アリア「${line}」</div>` +
    `${dungeon.name} ${state.floor}階から${how === '踏破' ? '踏破して' : ''}帰還<br>` +
    `帰還時刻 ${formatClock(p.clock)}　Lv${p.level}<br>` +
    `トニー ${state.runTony} × ${M[phase].toFixed(1)}（${multName}）＝ <b>${earned}トニー</b><br>` +
    (daily ? `糸${state.threadsUsed}本` + (isNew ? '<br><b>今日の自己ベスト更新！</b>' : '') + '<br>今日の迷宮のアイテムは持ち帰れない'
      : `持ち帰ったアイテム：${count}個（倉庫へ）`) +
    (soldTony ? `<br>倉庫に入りきらない分を${soldTony}トニーで売った` : ''),
    daily ? [
      { label: 'Xに貼る文章をコピー', primary: true, onClick: (ev) => copyShare(ev.currentTarget, true) },
      { label: '村へ戻る', onClick: openVillage },
    ] : [{ label: '村へ戻る', primary: true, onClick: openVillage }]
  );
}

// 17:00・24:00のお知らせ（操作を止めて表示する）
function showNotice(key) {
  const n = DATA.notices[key];
  releaseStick();
  closeBag();
  showOverlay(n.title, n.text, [{ label: n.button, primary: true, onClick: () => { hideOverlay(); updateUI(); } }]);
}

// 24:00以降、1ターンごとに時計の文字を点滅させる
function blinkClock() {
  const el = $('clock');
  el.classList.remove('blink');
  void el.offsetWidth; // アニメーションをやり直すため
  el.classList.add('blink');
}

// 敵を倒したとき、確率でアイテムを落とす（足元が埋まっていれば周りに）
function dropLoot(e) {
  const drop = DATA.enemies[e.type].drop;
  if (!drop || Math.random() >= drop.rate) return;
  placeDrop(e.x, e.y, drop.items[rand(0, drop.items.length - 1)], DATA.enemies[e.type].name);
}
// アイテムを足元に落とす（埋まっていれば周りに）
function placeDrop(ex, ey, id, who) {
  const spots = [[0, 0], ...DIRS];
  for (const [dx, dy] of spots) {
    const x = ex + dx, y = ey + dy;
    if (!walkable(x, y) || floorItemAt(x, y)) continue;
    if (x === state.stairs.x && y === state.stairs.y) continue;
    const item = newItem(id);
    state.floorItems.push({ x, y, item });
    addLog(`${who}は${itemLabel(item)}を落とした。`);
    return;
  }
}

// ============================================================
// 帰還の糸（広告で使う命綱）
// ============================================================
// 広告を見る（試作では、ボタンを押すと見たことになる）
// opts = { title, line } で見出しとアリアのセリフを変えられる
function watchAd(onDone, onCancel, opts) {
  const o = opts || {};
  showOverlay(
    o.title || '帰還の糸',
    `<div class="aria">アリア「${o.line || DATA.aria.thread}」</div><span class="ad-note">（ここで広告が流れます）</span>`,
    [
      { label: '広告を見た（試作）', primary: true, onClick: () => { hideOverlay(); onDone(); } },
      { label: 'やめる', onClick: () => { hideOverlay(); if (onCancel) onCancel(); } },
    ]
  );
}

function openThreadMenu() {
  if (busy()) return;
  const p = state.player;
  if (p.threads <= 0) {
    addLog('帰還の糸はもう残っていない。');
    return;
  }
  releaseStick();
  const hasUnknown = state.bag.some((x) => !isKnown(x.id));
  const use = (fn) => () => { hideOverlay(); watchAd(() => { p.threads--; state.threadsUsed++; fn(); updateUI(); }); };
  showOverlay(
    '帰還の糸',
    `どの力を借りますか？（残り${p.threads}本）`,
    [
      { label: '緊急脱出：持ち物を持って生還', primary: true, onClick: use(() => survive('脱出')) },
      { label: '危険察知：地形・階段・敵が分かる', onClick: use(() => {
        revealMap();
        state.sensed = true;
        addLog('糸が震え、この階の様子が分かった。');
      }) },
      { label: `時を戻す：時計を${DATA.threads.rewind / 60}時間戻す`, onClick: use(() => {
        p.clock = Math.max(DATA.clock.start, p.clock - DATA.threads.rewind);
        addLog(`時が巻き戻った。（${formatClock(p.clock)}）`);
      }) },
      { label: hasUnknown ? '神託：未識別のアイテムを1つ識別' : '神託：（識別するものがない）', dim: !hasUnknown, onClick: hasUnknown ? use(() => {
        state.bagOpen = true;
        state.bagMode = 'oracle';
        state.bagSel = null;
        renderBag();
        $('bag').classList.remove('hidden');
      }) : () => {} },
      { label: 'やめる', onClick: hideOverlay },
    ],
    true
  );
}

// ============================================================
// アイテム：拾う・使う・装備・投げる・置く
// ============================================================
// 迷宮に入るたびに、草と巻物の見た目をシャッフルする
function setupUnknownNames() {
  state.identified = new Set();
  state.looks = {};
  for (const cat of Object.keys(DATA.unknownNames)) {
    const names = shuffle([...DATA.unknownNames[cat]]);
    const ids = Object.keys(DATA.items).filter((id) => DATA.items[id].cat === cat);
    ids.forEach((id, i) => { state.looks[id] = names[i % names.length]; });
  }
}

// 足元のアイテムを拾う。拾えたら true
function pickUp() {
  const p = state.player;
  const f = floorItemAt(p.x, p.y);
  if (!f) return false;
  // トニーは持ち物に入れず、所持金に足す
  if (f.item.id === 'tony') {
    state.runTony += f.item.amount;
    state.floorItems = state.floorItems.filter((x) => x !== f);
    addLog(`${f.item.amount}トニーを拾った。`);
    return true;
  }
  // 帰還の糸は持ち物に入れず、糸の本数を増やす
  if (itemDef(f.item).cat === 'thread') {
    if (p.threads >= DATA.threads.max) {
      addLog('帰還の糸はこれ以上持てない。');
      return false;
    }
    p.threads++;
    state.floorItems = state.floorItems.filter((x) => x !== f);
    addLog('帰還の糸を拾った！　（使うときは広告が必要です）');
    return true;
  }
  // 束で持てるものは、同じものがあれば1枠にまとめる（持ち物がいっぱいでも拾える）
  if (f.item.count) {
    const same = state.bag.find((x) => x.id === f.item.id);
    if (same) {
      same.count += f.item.count;
      state.floorItems = state.floorItems.filter((x) => x !== f);
      addLog(`${itemLabel(f.item)}を拾った。`);
      return true;
    }
  }
  if (state.bag.length >= DATA.bag.size) {
    addLog(`持ち物がいっぱいで、${itemName(f.item)}を拾えない。`);
    return false;
  }
  state.floorItems = state.floorItems.filter((x) => x !== f);
  state.bag.push(f.item);
  addLog(`${itemLabel(f.item)}を拾った。`);
  return true;
}

function removeFromBag(item) {
  const p = state.player;
  state.bag = state.bag.filter((x) => x !== item);
  if (p.weapon === item) p.weapon = null;
  if (p.shield === item) p.shield = null;
  if (p.quiver === item) p.quiver = null;
}

function isEquipped(item) {
  const p = state.player;
  return p.weapon === item || p.shield === item || p.quiver === item;
}

// 装備する／外す
function toggleEquip(item) {
  const p = state.player;
  const def = itemDef(item);
  // 装備枠：武器・盾・投げ物（投げ物は武器・盾とは別枠）
  const slot = def.cat === 'weapon' ? 'weapon' : def.cat === 'shield' ? 'shield' : 'quiver';
  if (p[slot] === item) {
    p[slot] = null;
    addLog(`${def.name}を外した。`);
  } else {
    p[slot] = item;
    addLog(`${def.name}を装備した。`);
  }
}

// 草を飲む・巻物を読む。ターンを使う場合は true
function useItem(item) {
  const p = state.player;
  const def = itemDef(item);
  const before = itemName(item);

  if (def.cat === 'herb') {
    removeFromBag(item);
    const wasUnknown = identify(item.id);
    addLog(wasUnknown ? `${before}を食べた。これは${def.name}だった！` : `${def.name}を食べた。`);
    if (def.heal) {
      if (p.hp >= p.maxHp) {
        p.maxHp += def.maxUp;
        p.hp = p.maxHp;
        addLog(`最大HPが${def.maxUp}上がった。`);
      } else {
        const heal = Math.min(def.heal, p.maxHp - p.hp);
        p.hp += heal;
        addPopup(p.x, p.y, `+${heal}`, DATA.colors.heal);
      }
    }
    if (def.damage) {
      p.hp = Math.max(1, p.hp - def.damage);
      p.hurt = 1;
      addPopup(p.x, p.y, String(def.damage), DATA.colors.dmgToPlayer);
      addLog(`まずい！ ${def.damage}のダメージ。`);
    }
    if (def.atkDown) {
      p.atk = Math.max(1, p.atk - def.atkDown);
      addLog(`力が${def.atkDown}下がった。`);
    }
    if (def.atkUp) {
      p.atk += def.atkUp;
      addLog(`力が${def.atkUp}上がった！`);
    }
    if (def.levelUp) {
      const table = DATA.player.expTable;
      const need = table[p.level - 1];
      if (need !== undefined) gainExp(need - p.exp);
    }
    return true;
  }

  if (def.cat === 'scroll') {
    removeFromBag(item);
    const wasUnknown = identify(item.id);
    addLog(wasUnknown ? `${before}を読んだ。これは${def.name}だった！` : `${def.name}を読んだ。`);
    if (def.effect === 'map') {
      revealMap();
      addLog('この階の地形が分かった。');
    } else if (def.effect === 'sleep') {
      const targets = state.enemies.filter((e) => state.visible[idx(e.x, e.y)]);
      targets.forEach((e) => { e.sleep = DATA.effects.sleepTurns; });
      addLog(targets.length ? '敵は眠ってしまった。' : 'しかし何も起こらなかった。');
    } else if (def.effect === 'hide') {
      p.hidden = DATA.effects.hideTurns;
      state.enemies.forEach((e) => { e.alert = 0; });
      addLog('姿が見えにくくなった。');
    } else if (def.effect === 'return') {
      addLog('体が光に包まれた……');
      survive('巻物');
      return false;
    } else if (def.effect === 'identify') {
      // 識別するアイテムを選ぶ画面に切り替える（ターンは選んだ後に使う）
      const unknown = state.bag.filter((x) => !isKnown(x.id));
      if (unknown.length === 0) {
        addLog('しかし識別するものがなかった。');
        return true;
      }
      state.bagMode = 'identify';
      state.bagSel = null;
      renderBag();
      return false;
    }
    return true;
  }

  if (def.cat === 'time') {
    removeFromBag(item);
    const old = p.clock;
    if (def.resetStart) p.clock = DATA.clock.start;
    else p.clock = Math.max(DATA.clock.start, p.clock - def.rewind);
    addLog(`${def.name}を使った。時が巻き戻る……（${formatClock(old)} → ${formatClock(p.clock)}）`);
    if (def.damage) {
      p.hp = Math.max(1, p.hp - def.damage);
      p.hurt = 1;
      addPopup(p.x, p.y, String(def.damage), DATA.colors.dmgToPlayer);
      addLog(`ひびから砂がこぼれ、${def.damage}のダメージ。`);
    }
    return true;
  }

  if (def.cat === 'drink') {
    removeFromBag(item);
    p.boost = def.boostTurns;
    addLog(`${def.name}を飲んだ。体の奥から力がわいてくる！`);
    return true;
  }
  return false;
}

function revealMap() {
  const W = DATA.map.width, H = DATA.map.height;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (state.map[y][x] === T_WALL) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (inMap(x + dx, y + dy)) state.explored[idx(x + dx, y + dy)] = 1;
        }
      }
    }
  }
}

// 向いている方向に投げる
function throwItem(item) {
  const p = state.player;
  const def = itemDef(item);
  const name = itemName(item);
  // 束になっているものは1つだけ投げる
  if (item.count && item.count > 1) {
    item.count--;
    item = { uid: nextItemUid++, id: item.id, count: 1 };
  } else {
    removeFromBag(item);
  }
  const [dx, dy] = DIRS[p.dir];
  let x = p.x, y = p.y;
  for (let i = 0; i < DATA.bag.throwRange; i++) {
    if (!canMove(x, y, p.dir)) break;
    x += dx; y += dy;
    const e = enemyAt(x, y);
    if (e) {
      const edef = DATA.enemies[e.type];
      const base = def.throwDmg || DATA.bag.throwBaseDmg;
      const dmg = calcDamage(base, 0);
      e.hp -= dmg;
      e.flash = 1;
      e.sleep = 0;
      e.alert = DATA.ai.alertTurns;
      addPopup(e.x, e.y, String(dmg), DATA.colors.dmgToEnemy);
      if (e.hp <= 0) {
        addLog(`${name}が${edef.name}に当たった。${edef.name}をたおした。経験値${e.exp || edef.exp}`);
        killEnemy(e);
      } else {
        addLog(`${name}が${edef.name}に当たった。${dmg}のダメージ。`);
      }
      return;
    }
  }
  // 当たらなかったら、止まった場所に落ちる（すでに何かあれば消える）
  if (!floorItemAt(x, y) && !(x === state.stairs.x && y === state.stairs.y) && !(x === p.x && y === p.y)) {
    state.floorItems.push({ x, y, item });
    addLog(`${name}を投げた。`);
  } else {
    addLog(`${name}を投げた。${name}はどこかへ消えた。`);
  }
}

// 足元に置く
function dropItem(item) {
  const p = state.player;
  if (floorItemAt(p.x, p.y) || onStairs()) {
    addLog('ここには置けない。');
    return false;
  }
  const name = itemName(item);
  removeFromBag(item);
  state.floorItems.push({ x: p.x, y: p.y, item });
  addLog(`${name}を置いた。`);
  return true;
}

// 「投げる」ボタン：装備中の投げ物を、向いている方向に投げる
function quickThrow() {
  if (busy()) return;
  const p = state.player;
  if (!p.quiver) {
    addLog('投げ物を装備していない。（道具から装備できます）');
    return;
  }
  throwItem(p.quiver);
  endTurn();
}

// ============================================================
// 持ち物画面
// ============================================================
function openBag() {
  if (busy()) return;
  releaseStick();
  state.bagOpen = true;
  state.bagMode = 'normal';
  state.bagSel = null;
  renderBag();
  $('bag').classList.remove('hidden');
}

function closeBag() {
  state.bagOpen = false;
  state.bagMode = 'normal';
  state.bagSel = null;
  $('bag').classList.add('hidden');
}

// 持ち物画面での操作のあと、ターンを進めて画面を閉じる
function bagActionDone(usedTurn) {
  closeBag();
  if (usedTurn) endTurn();
  else updateUI();
}

function renderBag() {
  const oracleMode = state.bagMode === 'oracle';
  const identifyMode = state.bagMode === 'identify' || oracleMode;
  $('bag-title').textContent = identifyMode ? 'どれを識別する？' : `持ち物（${state.bag.length}/${DATA.bag.size}）`;
  $('bag-stats').textContent = `攻撃 ${playerAtk()}　防御 ${playerDef()}`;

  const list = $('bag-list');
  list.innerHTML = '';
  const items = identifyMode ? state.bag.filter((x) => !isKnown(x.id)) : state.bag;
  if (items.length === 0) {
    list.innerHTML = '<div class="bag-empty">何も持っていない</div>';
  }
  for (const item of items) {
    const def = itemDef(item);
    const cat = DATA.itemCats[def.cat];
    const row = document.createElement('button');
    row.className = 'item-row' + (state.bagSel === item.uid ? ' selected' : '');
    row.innerHTML =
      `<span class="item-icon" style="background:${cat.color}">${cat.symbol}</span>` +
      `<span class="item-name${isKnown(item.id) ? '' : ' unknown'}">${itemLabel(item)}</span>` +
      (isEquipped(item) ? '<span class="item-equip">装備中</span>' : '');
    row.onclick = () => {
      if (identifyMode) {
        identify(item.id);
        addLog(`${state.looks[item.id]}は${def.name}だった！`);
        bagActionDone(!oracleMode); // 神託はターンを使わない
        return;
      }
      state.bagSel = item.uid;
      renderBag();
    };
    list.appendChild(row);
  }

  // 説明と操作ボタン
  const sel = state.bag.find((x) => x.uid === state.bagSel);
  const desc = $('bag-desc');
  const actions = $('bag-actions');
  actions.innerHTML = '';
  const addBtn = (label, fn, primary) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (primary) b.classList.add('primary');
    b.onclick = fn;
    actions.appendChild(b);
  };

  if (identifyMode) {
    desc.textContent = '識別したいアイテムを選んでください。';
    // 神託は糸をすでに使っているので、やめられない
    if (!oracleMode) addBtn('やめる', () => { addLog('識別をやめた。'); bagActionDone(true); });
    return;
  }
  if (!sel) {
    desc.textContent = items.length ? 'アイテムを選んでください。' : '';
    addBtn('閉じる', closeBag);
    return;
  }

  const def = itemDef(sel);
  desc.textContent = isKnown(sel.id) ? def.desc : 'まだ正体が分からない。';
  if (def.cat === 'weapon' || def.cat === 'shield' || def.cat === 'throw') {
    addBtn(isEquipped(sel) ? '外す' : '装備', () => { toggleEquip(sel); bagActionDone(true); }, true);
  } else if (def.cat === 'herb') {
    addBtn('食べる', () => { const t = useItem(sel); if (state.bagMode !== 'identify') bagActionDone(t); }, true);
  } else if (def.cat === 'scroll') {
    addBtn('読む', () => {
      const t = useItem(sel);
      if (state.bagMode === 'identify') return; // 識別の選択画面に切り替わった
      if (state.locked) { closeBag(); return; }  // 帰還の巻物で生還した
      bagActionDone(t);
    }, true);
  } else if (def.cat === 'time' || def.cat === 'drink') {
    addBtn(def.cat === 'drink' ? '飲む' : '使う', () => { const t = useItem(sel); bagActionDone(t); }, true);
  }
  addBtn('投げる', () => { throwItem(sel); bagActionDone(true); });
  addBtn('置く', () => { const t = dropItem(sel); bagActionDone(t); });
  addBtn('閉じる', closeBag);
}

// ============================================================
// セーブ（トニー・倉庫・持ち込み・村の復興）
// アイテムは {uid, id, count?, unk?} の形で持つ。unk = 正体不明
// ============================================================
const SAVE_KEY = 'teijiDungeonSave';
const save = {
  tony: 0, revival: 0, revivalProgress: 0, storage: [], carry: [],
  cleared: {},      // 生還したことのある迷宮
  bossBeaten: {},   // 倒したことのあるボス
  daily: null,      // 今日の迷宮 { date, tries, adUsed, best: { floor, threads, clock } }
};

function toStored(x) {
  const o = { id: x.id };
  if (x.count) o.count = x.count;
  if (x.unk) o.unk = true;
  return o;
}
function fromStored(x) {
  return Object.assign({ uid: nextItemUid++ }, toStored(x));
}
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s) {
      save.tony = s.tony || 0;
      save.revival = s.revival || 0;
      save.revivalProgress = s.revivalProgress || 0;
      save.cleared = s.cleared || {};
      save.bossBeaten = s.bossBeaten || {};
      save.daily = s.daily || null;
      save.storage = (s.storage || []).filter((x) => DATA.items[x.id]).map(fromStored);
      save.carry = (s.carry || []).filter((x) => DATA.items[x.id]).map(fromStored);
    }
  } catch (err) { /* 読めなければ最初から */ }
}
function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      tony: save.tony,
      revival: save.revival,
      revivalProgress: save.revivalProgress,
      cleared: save.cleared,
      bossBeaten: save.bossBeaten,
      daily: save.daily,
      storage: save.storage.map(toStored),
      carry: save.carry.map(toStored),
    }));
  } catch (err) { /* 保存できない環境でも遊べる */ }
}

// 村の復興を進める（寄付やボス討伐）。目標額に届いたら次の段階へ
function addRevival(amount) {
  save.revivalProgress += amount;
  let next = DATA.village.revival[save.revival];
  while (next && save.revivalProgress >= next.cost) {
    save.revivalProgress -= next.cost;
    save.revival++;
    next = DATA.village.revival[save.revival];
  }
  if (!next) save.revivalProgress = 0;
}

// 今日の迷宮：日付が変わっていたら記録をリセット
function dailyState() {
  const key = todayKey();
  if (!save.daily || save.daily.date !== key) save.daily = { date: key, tries: 0, adUsed: false, best: null };
  return save.daily;
}
// 記録の比較：深い階 → 糸が少ない → 時刻が早い
function betterRecord(a, b) {
  if (!b) return true;
  if (a.floor !== b.floor) return a.floor > b.floor;
  if (a.threads !== b.threads) return a.threads < b.threads;
  return a.clock < b.clock;
}
// 今回の記録を保存。自己ベストなら true
function recordDaily() {
  const d = dailyState();
  const rec = { floor: state.floor, threads: state.threadsUsed, clock: state.player.clock };
  if (betterRecord(rec, d.best)) { d.best = rec; return true; }
  return false;
}
function recordText(r) {
  return `${r.floor}階・糸${r.threads}本・${formatClock(r.clock)}`;
}
// Xに貼る文章をコピー
function copyShare(btn, survived) {
  const [, m, d] = state.dailyKey.split('-').map(Number);
  const text = `${DATA.dungeons.daily.name}（${m}/${d}）\n` +
    `地下${state.floor}階${survived ? 'から生還' : 'で力尽きた'}・糸${state.threadsUsed}本・${formatClock(state.player.clock)}\n` +
    DATA.share.hashtag;
  const done = () => { btn.textContent = 'コピーしました！'; };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (err) { btn.textContent = 'コピーできませんでした'; }
    ta.remove();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

// 束で持てるものは同じものにまとめて入れる
function addToList(list, x) {
  if (x.count) {
    const same = list.find((y) => y.id === x.id && !y.unk);
    if (same) { same.count += x.count; return; }
  }
  list.push(x);
}
// 売値
function sellPrice(x) {
  if (x.unk) return DATA.village.unknownSell;
  const def = DATA.items[x.id];
  return Math.floor((def.price || 0) * (x.count || 1) * DATA.village.sellRate);
}
// 迷宮から持ち帰ったアイテムを倉庫へ。入りきらなければ売って、その額を返す
function storeFromRun(item) {
  const x = { uid: nextItemUid++, id: item.id };
  if (item.count) x.count = item.count;
  if (!isKnown(item.id)) x.unk = true;
  const fits = save.storage.length < DATA.village.storageSize ||
    (x.count && save.storage.some((y) => y.id === x.id && !y.unk));
  if (fits) { addToList(save.storage, x); return 0; }
  return sellPrice(x);
}
// 村での表示名
function storedName(x) {
  const def = DATA.items[x.id];
  const name = x.unk ? `正体不明の${DATA.itemCats[def.cat].label}` : def.name;
  return name + (x.count ? `（${x.count}）` : '');
}

// ============================================================
// 村
// ============================================================
const village = { tab: 'shrine', shopMode: 'buy', msg: '' };

function openVillage() {
  hideOverlay();
  releaseStick();
  closeBag();
  state.inVillage = true;
  village.tab = 'shrine';
  village.msg = '';
  writeSave();
  renderVillage();
  $('village').classList.remove('hidden');
}

// 出発。opts = { test: true } でテスト開始
function depart(id, opts) {
  const dungeon = DATA.dungeons[id || 'cave'];
  state.dungeonId = id || 'cave';
  let carried = [];
  if (!dungeon.noCarry) {
    carried = save.carry.map(toStored);
    save.carry = []; // 持ち込んだ物は、迷宮の中で失うこともある
  }
  if (dungeon.daily) dailyState().tries++;
  writeSave();
  state.inVillage = false;
  $('village').classList.add('hidden');
  startDungeon(carried, opts);
}

function facilityOpen(f) { return save.revival >= f.need; }

function vMsg(text) { village.msg = text; renderVillage(); }

function renderVillage() {
  const V = DATA.village;
  $('v-name').textContent = V.name;
  $('v-tony').textContent = `💰 ${save.tony} トニー`;

  // 村の復興
  const next = V.revival[save.revival];
  const stars = '★'.repeat(save.revival) + '☆'.repeat(V.revival.length - save.revival);
  const rv = $('v-revival');
  rv.innerHTML = `<div>村の復興 <span class="stars">${stars}</span></div>`;
  if (next) {
    const remain = next.cost - save.revivalProgress;
    const b = document.createElement('button');
    b.textContent = `${remain}トニーを寄付（${next.text}）`;
    if (save.tony < remain) b.classList.add('dim');
    b.onclick = () => {
      if (save.tony < remain) { vMsg('トニーが足りない。'); return; }
      save.tony -= remain;
      addRevival(remain);
      writeSave();
      vMsg(`村が少し元気になった！　${next.text}。`);
    };
    rv.appendChild(b);
  } else {
    rv.insertAdjacentHTML('beforeend', '<div class="v-note">村はすっかり元気になった。</div>');
  }

  // 施設ボタン
  const fac = $('v-facilities');
  fac.innerHTML = '';
  for (const f of V.facilities) {
    const b = document.createElement('button');
    const open = facilityOpen(f);
    b.innerHTML = `<span class="v-icon">${open ? f.icon : '🔒'}</span>${f.name}`;
    if (village.tab === f.key) b.classList.add('on');
    if (!open) b.classList.add('dim');
    b.onclick = () => {
      if (!open) { vMsg(`${f.name}は、村がもう少し復興すると開く。`); return; }
      village.tab = f.key;
      village.msg = '';
      renderVillage();
    };
    fac.appendChild(b);
  }

  $('v-msg').textContent = village.msg;
  const panel = $('v-panel');
  panel.innerHTML = '';
  ({ shrine: vShrine, storage: vStorage, shop: vShop, appraiser: vAppraiser, smith: vSmith })[village.tab](panel);
}

// 一覧の1行（名前 + 右側のボタン）
function vRow(list, x, btnLabel, onClick, dim, extra) {
  const def = DATA.items[x.id];
  const cat = DATA.itemCats[def.cat];
  const row = document.createElement('div');
  row.className = 'v-row';
  row.innerHTML =
    `<span class="item-icon" style="background:${cat.color}">${cat.symbol}</span>` +
    `<span class="item-name${x.unk ? ' unknown' : ''}">${storedName(x)}</span>` +
    (extra ? `<span class="v-price">${extra}</span>` : '');
  if (btnLabel) {
    const b = document.createElement('button');
    b.textContent = btnLabel;
    if (dim) b.classList.add('dim');
    b.onclick = onClick;
    row.appendChild(b);
  }
  list.appendChild(row);
}
function vHead(panel, text) {
  const h = document.createElement('div');
  h.className = 'v-head2';
  h.textContent = text;
  panel.appendChild(h);
}
function vList(panel, emptyText) {
  const list = document.createElement('div');
  list.className = 'v-list';
  panel.appendChild(list);
  list.dataset.empty = emptyText || 'なし';
  return list;
}
function vFinishList(list) {
  if (!list.children.length) list.innerHTML = `<div class="bag-empty">${list.dataset.empty}</div>`;
}

// アリアの祠：行き先を選んで出発
function vShrine(panel) {
  panel.insertAdjacentHTML('beforeend', `<div class="aria">アリア「${DATA.aria.shrine}」</div>`);
  for (const id of DATA.dungeonOrder) {
    const dg = DATA.dungeons[id];
    const card = document.createElement('div');
    card.className = 'v-card';
    const btns = document.createElement('div');
    btns.className = 'v-card-btns';
    const addBtn = (label, fn, cls) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = fn;
      btns.appendChild(b);
    };
    let info = '';
    if (dg.locked) {
      info = '🔒 準備中';
    } else if (dg.needClear && !save.cleared[dg.needClear]) {
      info = `🔒 ${DATA.dungeons[dg.needClear].name}から一度生還すると挑戦できます`;
    } else if (dg.daily) {
      const d = dailyState();
      const left = dg.tries - d.tries;
      info = `持ち込みなし・持ち帰りはトニーだけ<br>今日の記録：${d.best ? recordText(d.best) : 'まだありません'}`;
      if (left > 0) {
        info += `<br>残り挑戦：${left}回`;
        addBtn('挑戦する', () => depart(id), 'primary');
      } else if (!d.adUsed && dg.adTries > 0) {
        info += '<br>今日の挑戦は終わりました';
        addBtn('広告を見てもう1回挑戦', () => watchAd(() => {
          d.adUsed = true;
          d.tries -= dg.adTries;
          writeSave();
          renderVillage();
        }, null, { title: 'もう1回挑戦', line: 'しょうがないですね、もう1回だけですよ？' }));
      } else {
        info += '<br>今日の挑戦は終わりました。また明日！';
      }
    } else {
      info = `全${dg.floors}階${dg.boss ? '・最下層にボス' : ''}<br>持ち込み：${save.carry.length}/${DATA.bag.size}個（倉庫で準備）`;
      if (save.carry.length) info += `<br><span class="small">${save.carry.map(storedName).join('、')}</span>`;
      addBtn('出発する', () => depart(id), 'primary');
      if (DATA.debug && DATA.debug.bossTest && dg.boss) addBtn('🧪 10階から（テスト）', () => depart(id, { test: true }));
    }
    card.innerHTML = `<div class="v-card-name">${dg.name}</div><div class="v-note">${info}</div>`;
    if (btns.children.length) card.appendChild(btns);
    panel.appendChild(card);
  }
}

// 倉庫：倉庫 ⇄ 持ち込み
function vStorage(panel) {
  vHead(panel, `持ち込み（${save.carry.length}/${DATA.bag.size}）　タップで倉庫へ戻す`);
  const carry = vList(panel, '何も持っていかない');
  for (const x of save.carry) {
    vRow(carry, x, '戻す', () => {
      save.carry = save.carry.filter((y) => y !== x);
      addToList(save.storage, x);
      writeSave();
      vMsg(`${storedName(x)}を倉庫に戻した。`);
    });
  }
  vFinishList(carry);
  vHead(panel, `倉庫（${save.storage.length}/${DATA.village.storageSize}）　タップで持ち込みへ`);
  const store = vList(panel, '倉庫は空っぽ');
  for (const x of save.storage) {
    const full = save.carry.length >= DATA.bag.size;
    vRow(store, x, '持っていく', () => {
      if (full) { vMsg(`一度に持ち込めるのは${DATA.bag.size}個まで。`); return; }
      save.storage = save.storage.filter((y) => y !== x);
      save.carry.push(x);
      writeSave();
      vMsg(`${storedName(x)}を持ち込みに入れた。`);
    }, full);
  }
  vFinishList(store);
}

// 道具屋：買う・売る
function vShop(panel) {
  const tabs = document.createElement('div');
  tabs.className = 'v-tabs';
  for (const [mode, label] of [['buy', '買う'], ['sell', '売る']]) {
    const b = document.createElement('button');
    b.textContent = label;
    if (village.shopMode === mode) b.classList.add('on');
    b.onclick = () => { village.shopMode = mode; village.msg = ''; renderVillage(); };
    tabs.appendChild(b);
  }
  panel.appendChild(tabs);

  if (village.shopMode === 'buy') {
    vHead(panel, '買ったものは持ち込みへ（いっぱいなら倉庫へ）');
    const list = vList(panel);
    for (const s of DATA.village.shop) {
      const x = { id: s.id };
      if (s.count) x.count = s.count;
      vRow(list, x, '買う', () => {
        if (save.tony < s.price) { vMsg('トニーが足りない。'); return; }
        const item = { uid: nextItemUid++, id: s.id };
        if (s.count) item.count = s.count;
        const toCarry = save.carry.length < DATA.bag.size || (item.count && save.carry.some((y) => y.id === item.id && !y.unk));
        if (!toCarry && save.storage.length >= DATA.village.storageSize) { vMsg('持ち込みも倉庫もいっぱいだ。'); return; }
        save.tony -= s.price;
        addToList(toCarry ? save.carry : save.storage, item);
        writeSave();
        vMsg(`${storedName(item)}を買った。（${toCarry ? '持ち込み' : '倉庫'}へ）`);
      }, save.tony < s.price, `${s.price}ト`);
    }
    vFinishList(list);
    return;
  }

  // 売る：持ち込み → 倉庫の順に並べる
  vHead(panel, `売値は半額（正体不明のものは${DATA.village.unknownSell}トニー）`);
  const list = vList(panel, '売るものがない');
  for (const [src, where] of [['carry', '持'], ['storage', '倉']]) {
    for (const x of save[src]) {
      const price = sellPrice(x);
      vRow(list, x, '売る', () => {
        save[src] = save[src].filter((y) => y !== x);
        save.tony += price;
        writeSave();
        vMsg(`${storedName(x)}を${price}トニーで売った。`);
      }, false, `${where}・${price}ト`);
    }
  }
  vFinishList(list);
}

// 鑑定屋：正体不明のアイテムを鑑定
function vAppraiser(panel) {
  const cost = DATA.village.appraiseCost;
  vHead(panel, `鑑定料は1個${cost}トニー`);
  const list = vList(panel, '鑑定するものがない');
  for (const src of ['carry', 'storage']) {
    for (const x of save[src]) {
      if (!x.unk) continue;
      vRow(list, x, '鑑定', () => {
        if (save.tony < cost) { vMsg('トニーが足りない。'); return; }
        const before = storedName(x);
        save.tony -= cost;
        x.unk = false;
        // 同じもの（束）がすでにあればまとめる
        save[src] = save[src].filter((y) => y !== x);
        addToList(save[src], x);
        writeSave();
        vMsg(`${before}は「${DATA.items[x.id].name}」だった！`);
      }, save.tony < cost, src === 'carry' ? '持' : '倉');
    }
  }
  vFinishList(list);
}

// 鍛冶屋：準備中
function vSmith(panel) {
  panel.insertAdjacentHTML('beforeend',
    '<div class="v-note">🔨 ただいま準備中です。<br>そのうち武器や盾を鍛えられるようになります。</div>');
}

// ============================================================
// 画面表示（UI部分）
// ============================================================
function addLog(msg) {
  state.logs.push(msg);
  if (state.logs.length > 3) state.logs.shift();
  $('log').innerHTML = state.logs.map((m) => `<div>${m}</div>`).join('');
}

function addPopup(x, y, text, color) {
  state.popups.push({ x, y, text, color, t: 0 });
}

function updateUI() {
  const p = state.player;
  $('dungeon-name').textContent = DATA.dungeons[state.dungeonId].name;
  $('floor').textContent = `${state.floor}F`;
  $('tony').textContent = `💰${state.runTony}`;
  // 時計と帰還の糸
  const clock = $('clock');
  clock.textContent = `🕘 ${formatClock(p.clock)}`;
  const phase = clockPhase();
  clock.classList.toggle('overtime', phase === 'overtime');
  clock.classList.toggle('late', phase === 'late');
  $('threads').textContent = p.threads > 0
    ? '🧵'.repeat(p.threads) + '・'.repeat(DATA.threads.max - p.threads)
    : '糸なし';
  $('cond').textContent = (p.boost > 0 ? '⚡' : '') + (p.hidden > 0 ? '👻' : '');
  $('lv').textContent = `Lv${p.level}`;
  $('hp').textContent = `HP ${p.hp}/${p.maxHp}`;
  const ratio = p.hp / p.maxHp;
  const fill = $('hpfill');
  fill.style.width = `${Math.max(0, ratio * 100)}%`;
  fill.classList.toggle('mid', ratio <= 0.5 && ratio > 0.25);
  fill.classList.toggle('low', ratio <= 0.25);

  let label = '足踏み';
  if (enemyInDir(p.dir)) label = '攻撃';
  else if (onStairs()) label = state.portal ? '帰る' : '降りる';
  else if (floorItemAt(p.x, p.y)) label = '拾う';
  $('btn-action').textContent = overlayOpen() ? '決定' : label;

  // 投げるボタン：装備中の投げ物の残り数を表示
  const tb = $('btn-throw');
  tb.textContent = p.quiver ? `投げる×${p.quiver.count || 1}` : '投げる';
  tb.classList.toggle('dim', !p.quiver);
}

// メッセージ画面を出す。buttons は [{ label, onClick, primary }] の配列
function showOverlay(title, text, buttons, vertical) {
  state.locked = true;
  $('ov-buttons').classList.toggle('vertical', !!vertical);
  $('ov-title').textContent = title;
  $('ov-text').innerHTML = text;
  const box = $('ov-buttons');
  box.innerHTML = '';
  buttons.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    if (b.primary) btn.classList.add('primary');
    if (b.dim) btn.classList.add('dim');
    btn.dataset.index = i;
    btn.onclick = b.onClick;
    box.appendChild(btn);
  });
  // 最初は「primary」のボタン（なければ1つ目）を選んだ状態にする
  const first = buttons.findIndex((b) => b.primary);
  setOvSel(first >= 0 ? first : 0);
  // 迷宮の中では、操作エリア（ジョイスティックと決定ボタン）を隠さない
  const ov = $('overlay');
  if (state.inVillage) {
    ov.style.bottom = '0px';
  } else {
    const top = $('controls').getBoundingClientRect().top;
    ov.style.bottom = `${Math.max(0, window.innerHeight - top)}px`;
  }
  ov.classList.remove('hidden');
  $('btn-action').textContent = '決定';
}
function hideOverlay() {
  state.locked = false;
  $('overlay').classList.add('hidden');
  if (state.player && state.map) updateUI();
}
function overlayOpen() { return state.locked && !$('overlay').classList.contains('hidden'); }
// メッセージ画面で選ぶボタンを変える
function setOvSel(i) {
  const btns = $('ov-buttons').querySelectorAll('button');
  if (!btns.length) return;
  state.ovSel = (i + btns.length) % btns.length;
  btns.forEach((b, j) => b.classList.toggle('sel', j === state.ovSel));
  btns[state.ovSel].scrollIntoView({ block: 'nearest' });
}
// ジョイスティックの向きで選択を動かす（縦並びは上下、横並びは左右）
function moveOvSel(d) {
  const [dx, dy] = DIRS[d];
  const vertical = $('ov-buttons').classList.contains('vertical');
  const delta = vertical ? (dy || dx) : (dx || dy);
  setOvSel(state.ovSel + delta);
}
// 選んでいるボタンを押す
function pressOvSel() {
  const btns = $('ov-buttons').querySelectorAll('button');
  if (btns[state.ovSel]) btns[state.ovSel].click();
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
      if (x === state.stairs.x && y === state.stairs.y) drawStairs(sx, sy, ts);
      if (!state.visible[i]) {
        ctx.fillStyle = C.fog;
        ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
      }
    }
  }

  // スティックで狙っているマスを枠で表示
  // 白：進める / 赤い枠：壁 / 濃い赤：敵（攻撃） / 黄色：向き変え
  if (stick.active && stick.dir !== null) {
    const [dx, dy] = DIRS[stick.dir];
    if (state.turnMode) ctx.strokeStyle = C.targetTurn;
    else if (enemyInDir(stick.dir)) ctx.strokeStyle = C.targetAttack;
    else ctx.strokeStyle = canMove(p.x, p.y, stick.dir) ? C.target : 'rgba(255,80,80,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect((p.x + dx) * ts - camX + 2, (p.y + dy) * ts - camY + 2, ts - 4, ts - 4);
  }

  // 落ちているアイテム（一度見えた場所のもの）
  for (const f of state.floorItems) {
    if (!state.explored[idx(f.x, f.y)]) continue;
    drawFloorItem(f, f.x * ts - camX, f.y * ts - camY, ts, !state.visible[idx(f.x, f.y)]);
  }

  // 敵（見えている敵だけ。危険察知を使った階では全部、見えない敵は薄く表示）
  for (const e of state.enemies) {
    const seen = state.visible[idx(e.x, e.y)];
    if (!seen && !state.sensed) continue;
    ctx.globalAlpha = seen ? 1 : 0.5;
    let ox = 0, oy = 0;
    if (e.lunge > 0 && e.lungeDir >= 0) {
      ox = DIRS[e.lungeDir][0] * e.lunge * ts * 0.25;
      oy = DIRS[e.lungeDir][1] * e.lunge * ts * 0.25;
    }
    drawEnemy(e, e.rx * ts - camX + ox, e.ry * ts - camY + oy, ts);
    ctx.globalAlpha = 1;
  }

  // 主人公
  let pox = 0, poy = 0;
  if (p.lunge > 0) {
    pox = DIRS[p.dir][0] * p.lunge * ts * 0.25;
    poy = DIRS[p.dir][1] * p.lunge * ts * 0.25;
  }
  if (p.hidden > 0) ctx.globalAlpha = 0.45; // 隠れ身中は半透明
  drawPlayer(p.rx * ts - camX + pox, p.ry * ts - camY + poy, ts, p.dir, p.hurt);
  ctx.globalAlpha = 1;

  // ダメージ数字
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const pop of state.popups) {
    const a = 1 - pop.t;
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `bold ${Math.round(ts * 0.38)}px sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    const px = pop.x * ts - camX + ts / 2;
    const py = pop.y * ts - camY + ts * 0.2 - pop.t * ts * 0.5;
    ctx.strokeText(pop.text, px, py);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, px, py);
  }
  ctx.globalAlpha = 1;

  if (state.showMini) drawMiniMap(w, h);
}

function drawStairs(sx, sy, ts) {
  // 帰還の魔法陣（ボスの階）
  if (state.portal) {
    const cx = sx + ts / 2, cy = sy + ts / 2;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.globalAlpha = 0.75 + Math.sin(t * 3) * 0.2;
    ctx.strokeStyle = '#b78cff';
    ctx.lineWidth = Math.max(2, ts * 0.06);
    ctx.beginPath(); ctx.arc(cx, cy, ts * 0.4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, ts * 0.26, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = t * 0.8 + (i * Math.PI) / 3;
      const x = cx + Math.cos(a) * ts * 0.4, y = cy + Math.sin(a) * ts * 0.4;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      const b = a + (2 * Math.PI) / 3;
      ctx.lineTo(cx + Math.cos(b) * ts * 0.4, cy + Math.sin(b) * ts * 0.4);
      ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(183,140,255,0.25)';
    ctx.beginPath(); ctx.arc(cx, cy, ts * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = DATA.colors.stairs;
  const pad = ts * 0.18;
  const step = (ts - pad * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const bw = (ts - pad * 2) * (1 - i * 0.25);
    ctx.fillRect(sx + (ts - bw) / 2, sy + pad + i * step, bw, step * 0.6);
  }
}

// 仮の敵：色つきの丸＋文字（残りHPはあえて表示しない）
function drawEnemy(e, sx, sy, ts) {
  const def = DATA.enemies[e.type];
  const cx = sx + ts / 2, cy = sy + ts / 2;
  const r = def.boss ? 0.5 : 0.36; // ボスは大きく描く
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.color;
  ctx.beginPath(); ctx.arc(cx, cy, ts * r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = def.boss ? '#ffd84a' : 'rgba(0,0,0,0.5)';
  ctx.lineWidth = def.boss ? 3 : 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(ts * r)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.symbol, cx, cy + 1);
  // 眠っている敵
  if (e.sleep > 0) {
    ctx.font = `bold ${Math.round(ts * 0.26)}px sans-serif`;
    ctx.fillStyle = '#9fd3ff';
    ctx.fillText('Zz', cx + ts * 0.3, cy - ts * 0.3);
  }
}

// 仮のアイテム：種類ごとの色の四角＋文字
function drawFloorItem(f, sx, sy, ts, dim) {
  const cat = DATA.itemCats[itemDef(f.item).cat];
  const s = ts * 0.5;
  const x = sx + (ts - s) / 2, y = sy + (ts - s) / 2;
  ctx.globalAlpha = dim ? 0.5 : 1;
  ctx.fillStyle = cat.color;
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, s, s);
  ctx.fillStyle = '#222';
  ctx.font = `bold ${Math.round(s * 0.62)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cat.symbol, sx + ts / 2, sy + ts / 2 + 1);
  ctx.globalAlpha = 1;
}

// ---- 主人公の絵 ----
// 向き（DIRSの番号）ごとに使う絵と、左右反転するか
const HERO_FRAMES = [
  ['side', true],   // 0 右
  ['diag', true],   // 1 右下
  ['down', false],  // 2 下
  ['diag', false],  // 3 左下
  ['side', false],  // 4 左
  ['updiag', false], // 5 左上
  ['up', false],    // 6 上
  ['updiag', true], // 7 右上
];
const heroImg = {};
for (const key of ['down', 'up', 'side', 'diag', 'updiag']) {
  const img = new Image();
  img.src = DATA.view.hero[key];
  heroImg[key] = img;
}
const tintCanvas = document.createElement('canvas');
const tintCtx = tintCanvas.getContext('2d');

function heroReady() {
  return Object.values(heroImg).every((img) => img.complete && img.naturalWidth > 0);
}

// 絵で主人公を描く。ダメージ直後は赤く光らせる
function drawHeroSprite(sx, sy, ts, dir, hurt) {
  const [key, flip] = HERO_FRAMES[dir];
  const img = heroImg[key];
  const size = ts * DATA.view.hero.size;
  const hop = Math.sin(state.player.hop * Math.PI) * ts * DATA.view.hero.hop;
  const x = sx + (ts - size) / 2;
  const y = sy + ts - size + ts * 0.05 - hop;

  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(sx + ts / 2, sy + ts * 0.9, ts * 0.28, ts * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  // 赤い光は別のキャンバスで絵の形に合わせて塗る
  const dpr = window.devicePixelRatio || 1;
  const px = Math.ceil(size * dpr);
  if (tintCanvas.width !== px) { tintCanvas.width = px; tintCanvas.height = px; }
  tintCtx.setTransform(1, 0, 0, 1, 0, 0);
  tintCtx.clearRect(0, 0, px, px);
  tintCtx.globalCompositeOperation = 'source-over';
  if (flip) { tintCtx.translate(px, 0); tintCtx.scale(-1, 1); }
  tintCtx.drawImage(img, 0, 0, px, px);
  tintCtx.setTransform(1, 0, 0, 1, 0, 0);
  if (hurt > 0) {
    tintCtx.globalCompositeOperation = 'source-atop';
    tintCtx.fillStyle = `rgba(255,40,40,${hurt * 0.6})`;
    tintCtx.fillRect(0, 0, px, px);
  }
  // 歩く動き：足元を軸に、左右に傾けて縦に少し伸ばす
  const swing = Math.sin(state.player.hop * Math.PI); // 0 → 1 → 0
  const H = DATA.view.hero;
  const footX = x + size / 2;
  const footY = y + size * 0.97;
  ctx.save();
  ctx.translate(footX, footY);
  ctx.rotate(swing * H.tilt * (state.player.stepSide || 1));
  ctx.scale(1 - swing * H.stretch * 0.5, 1 + swing * H.stretch);
  ctx.drawImage(tintCanvas, -size / 2, -size * 0.97, size, size);
  ctx.restore();

  // 向きの目印（足元の小さな矢印）
  const [dx, dy] = DIRS[dir];
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const cx = sx + ts / 2, cy = sy + ts * 0.9;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(cx + ux * ts * 0.42, cy + uy * ts * 0.2);
  ctx.lineTo(cx + ux * ts * 0.3 - uy * ts * 0.07, cy + uy * ts * 0.13 + ux * ts * 0.04);
  ctx.lineTo(cx + ux * ts * 0.3 + uy * ts * 0.07, cy + uy * ts * 0.13 - ux * ts * 0.04);
  ctx.closePath();
  ctx.fill();
}

// 主人公を描く（絵が読み込めていなければ、仮の丸で描く）
function drawPlayer(sx, sy, ts, dir, hurt) {
  if (heroReady()) {
    drawHeroSprite(sx, sy, ts, dir, hurt);
    return;
  }
  const C = DATA.colors;
  const cx = sx + ts / 2, cy = sy + ts / 2;
  ctx.fillStyle = C.cape;
  ctx.beginPath(); ctx.arc(cx, cy + ts * 0.06, ts * 0.38, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.suit;
  ctx.beginPath(); ctx.arc(cx, cy + ts * 0.08, ts * 0.24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.face;
  ctx.beginPath(); ctx.arc(cx, cy - ts * 0.12, ts * 0.16, 0, Math.PI * 2); ctx.fill();
  // ダメージを受けた直後は赤く光る
  if (hurt > 0) {
    ctx.fillStyle = `rgba(255,60,60,${hurt * 0.6})`;
    ctx.beginPath(); ctx.arc(cx, cy, ts * 0.42, 0, Math.PI * 2); ctx.fill();
  }
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

// 地図の常時表示：歩いたことのある場所を、画面全体にうっすら重ねる
function drawMiniMap(w, h) {
  const C = DATA.colors;
  const W = DATA.map.width, H = DATA.map.height;
  const s = Math.min((w - 16) / W, (h - 16) / H);
  const ox = (w - W * s) / 2, oy = (h - H * s) / 2;
  ctx.save();
  ctx.globalAlpha = DATA.view.mapAlpha;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!state.explored[idx(x, y)]) continue;
      const t = state.map[y][x];
      if (t === T_WALL) continue;
      ctx.fillStyle = t === T_ROOM ? C.miniRoom : C.miniCorridor;
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
  }
  // 階段・敵・主人公は見失わないよう、濃いめに表示する
  ctx.globalAlpha = Math.min(1, DATA.view.mapAlpha + 0.5);
  if (state.explored[idx(state.stairs.x, state.stairs.y)]) {
    ctx.fillStyle = C.stairs;
    ctx.fillRect(ox + state.stairs.x * s, oy + state.stairs.y * s, s, s);
  }
  ctx.fillStyle = C.miniItem;
  for (const f of state.floorItems) {
    if (!state.explored[idx(f.x, f.y)]) continue;
    ctx.fillRect(ox + (f.x + 0.2) * s, oy + (f.y + 0.2) * s, s * 0.6, s * 0.6);
  }
  ctx.fillStyle = C.miniEnemy;
  for (const e of state.enemies) {
    if (!state.visible[idx(e.x, e.y)] && !state.sensed) continue;
    ctx.beginPath();
    ctx.arc(ox + (e.x + 0.5) * s, oy + (e.y + 0.5) * s, Math.max(2, s * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff4d6d';
  ctx.beginPath();
  ctx.arc(ox + (state.player.x + 0.5) * s, oy + (state.player.y + 0.5) * s, Math.max(2.5, s * 0.7), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 毎フレームの処理（動きをなめらかにする）
let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const k = Math.min(1, dt * 22);
  const follow = (o) => {
    o.rx += (o.x - o.rx) * k;
    o.ry += (o.y - o.ry) * k;
    if (Math.abs(o.x - o.rx) < 0.01) o.rx = o.x;
    if (Math.abs(o.y - o.ry) < 0.01) o.ry = o.y;
  };
  const p = state.player;
  follow(p);
  p.lunge = Math.max(0, p.lunge - dt * 7);
  p.hurt = Math.max(0, p.hurt - dt * 4);
  p.hop = Math.max(0, p.hop - dt * 5);
  for (const e of state.enemies) {
    follow(e);
    e.lunge = Math.max(0, (e.lunge || 0) - dt * 7);
    e.flash = Math.max(0, e.flash - dt * 6);
  }
  for (const pop of state.popups) pop.t += dt * 1.4;
  state.popups = state.popups.filter((pop) => pop.t < 1);
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

// 角度と方向の中心とのずれ（度）
function angleDiff(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// 角度を8方向に吸着させる（上下左右は35度、斜めは55度の幅）
// すでに倒している方向があれば、その方向を少し広めに保つ（指のブレ対策）
function snapDir(angleDeg, current) {
  if (current !== null) {
    const half = (current % 2 === 0 ? 17.5 : 27.5) + DATA.control.hysteresis;
    if (angleDiff(angleDeg, current * 45) <= half) return current;
  }
  for (let i = 0; i < 8; i++) {
    const half = i % 2 === 0 ? 17.5 : 27.5;
    if (angleDiff(angleDeg, i * 45) <= half) return i;
  }
  return 0;
}

function setStickDir(d) {
  if (d === stick.dir) return;
  const prev = stick.dir;
  clearTimeout(stick.timer);
  stick.dir = d;
  stick.halted = false;
  if (d === null) return;

  // 向き変えモード：向きだけ変えて、移動はしない
  if (state.turnMode && !overlayOpen()) {
    turnPlayer(d);
    return;
  }

  if (prev === null) {
    // 中央から倒した瞬間は、すぐに1歩
    firstStep();
  } else {
    // 倒したまま方向を変えたときは、少し待ってから1歩（通り道の方向に誤って進まないように）
    stick.timer = setTimeout(firstStep, DATA.control.changeDelay);
  }
}

function firstStep() {
  if (!stick.active || stick.dir === null) return;
  // メッセージ画面が出ているときは、選ぶボタンを動かす（1回倒すごとに1つ）
  if (overlayOpen()) { moveOvSel(stick.dir); stick.halted = true; return; }
  if (!stepPlayer(stick.dir)) stick.halted = true;
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
  const d2 = Math.hypot(dx, dy);
  const R = DATA.control.stickRadius;
  if (d2 < DATA.control.deadZone) {
    knob.style.transform = 'translate(0px, 0px)';
    setStickDir(null);
    return;
  }
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  const d = snapDir(angle, stick.dir);
  const [sx, sy] = DIRS[d];
  const len = Math.hypot(sx, sy);
  const r = Math.min(d2, R);
  knob.style.transform = `translate(${(sx / len) * r}px, ${(sy / len) * r}px)`;
  setStickDir(d);
}

function releaseStick() {
  stick.active = false;
  stick.id = null;
  clearTimeout(stick.timer);
  stick.dir = null;
  stick.halted = false;
  // 向き変えモードは、指を離したら終わる
  if (state.turnMode) setTurnMode(false);
  base.classList.remove('active');
  base.style.left = '';
  base.style.top = '';
  knob.style.transform = 'translate(0px, 0px)';
}

zone.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (stick.active || (busy() && !overlayOpen())) return;
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
// 設定の保存・読み込み（保存できない環境でも動作には支障なし）
function saveSetting(key, value) {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch (err) { /* 何もしない */ }
}
function loadSetting(key) {
  try { return localStorage.getItem(key) === '1'; } catch (err) { return false; }
}

// 向き変えモードの切り替え
function setTurnMode(on) {
  state.turnMode = on;
  $('btn-turn').classList.toggle('on', on);
}

// 地図の常時表示の切り替え
function setShowMap(on) {
  state.showMini = on;
  $('btn-mini').classList.toggle('on', on);
  saveSetting('showMap', on);
}

onPress('btn-action', doAction);
onPress('btn-turn', () => setTurnMode(!state.turnMode));
onPress('btn-item', openBag);
onPress('btn-throw', quickThrow);
onPress('threads', openThreadMenu);
// 持ち物画面の外側（暗い部分）を触ったら閉じる
$('bag').addEventListener('pointerdown', (e) => {
  if (e.target.id !== 'bag') return;
  if (state.bagMode !== 'normal') return; // 識別・神託の選択中は閉じない
  closeBag();
});
onPress('btn-mini', () => setShowMap(!state.showMini));
onPress('btn-swap', () => {
  const swapped = $('app').classList.toggle('swapped');
  saveSetting('swapControls', swapped);
});

// ============================================================
// 操作：キーボード（PCでの確認用）
// 矢印キー / テンキー / Q W E A D Z X C で8方向、スペースで決定、Mで地図、Iで持ち物、Tで投げる、Rで帰還の糸
// Shiftを押しながら方向キーで、向きだけ変える
// ============================================================
const KEY_DIRS = {
  ArrowRight: 0, ArrowDown: 2, ArrowLeft: 4, ArrowUp: 6,
  6: 0, 3: 1, 2: 2, 1: 3, 4: 4, 7: 5, 8: 6, 9: 7,
  d: 0, c: 1, x: 2, z: 3, a: 4, q: 5, w: 6, e: 7,
};
window.addEventListener('keydown', (e) => {
  // メッセージ画面：Enter/スペースで1つ目のボタン、Escで最後のボタン（やめる・そのまま）
  if (state.locked) {
    const btns = $('ov-buttons').querySelectorAll('button');
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pressOvSel(); }
    if (e.key === 'Escape' && btns.length > 1) btns[btns.length - 1].click();
    const kk = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (kk in KEY_DIRS) { e.preventDefault(); moveOvSel(KEY_DIRS[kk]); }
    return;
  }
  if (state.inVillage) return; // 村ではマウス・タッチで操作
  // 持ち物画面：Escで閉じる
  if (state.bagOpen) {
    if (e.key === 'Escape' && state.bagMode === 'normal') closeBag();
    return;
  }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'i') { openBag(); return; }
  if (k === 't') { quickThrow(); return; }
  if (k === 'r') { openThreadMenu(); return; }
  if (k in KEY_DIRS) {
    e.preventDefault();
    if (e.shiftKey) turnPlayer(KEY_DIRS[k]);
    else stepPlayer(KEY_DIRS[k]);
  } else if (k === ' ' || k === 's' || k === '5') {
    e.preventDefault();
    doAction();
  } else if (k === 'm') {
    setShowMap(!state.showMini);
  }
});

// ============================================================
// 起動
// ============================================================
if (loadSetting('swapControls')) $('app').classList.add('swapped');
setShowMap(loadSetting('showMap'));
$('version').textContent = `game ${GAME_VERSION} / data ${DATA.version || '-'}`;
loadSave();
startDungeon();   // 村の後ろに表示しておく迷宮（描画のため）
openVillage();
requestAnimationFrame(frame);
