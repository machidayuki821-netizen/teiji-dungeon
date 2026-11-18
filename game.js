// ============================================================
// game.js ― ゲームの仕組み（段階③：拾う）
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
  player: null,     // startDungeon で作る
  enemies: [],      // この階にいる敵
  floorItems: [],   // この階に落ちているアイテム {x, y, item}
  bag: [],          // 持ち物 [{uid, id}]
  identified: new Set(), // 識別済みのアイテムID
  looks: {},        // 未識別のときの見た目 {アイテムID: '青い草'}
  bagOpen: false,   // 持ち物画面を開いているか
  bagMode: 'normal',// normal=通常 / identify=識別するアイテムを選ぶ
  bagSel: null,     // 選んでいるアイテムのuid
  popups: [],       // ダメージ数字などの表示
  logs: [],
  showMini: false,  // 地図の常時表示
  turnMode: false,  // 向き変えモード（スティックで向きだけ変える）
  locked: false,    // オーバーレイ表示中など、操作を受け付けない状態
};
let nextEnemyId = 1;
let nextItemUid = 1;

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
function busy() { return state.locked || state.bagOpen; }

// ---- アイテム関連の便利関数 ----
function itemDef(item) { return DATA.items[item.id]; }
function newItem(id) { return { uid: nextItemUid++, id }; }
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

  updateVisibility();
}

function pickItemType() {
  const table = DATA.dungeons[state.dungeonId].itemTable
    .filter((s) => state.floor >= s.from && state.floor <= s.to);
  const total = table.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
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
  let r = Math.random() * total;
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
    const type = pickEnemyType();
    const def = DATA.enemies[type];
    state.enemies.push({
      id: nextEnemyId++, type, x, y, rx: x, ry: y,
      hp: def.hp, maxHp: def.hp,
      alert: 0, tx: null, ty: null, flash: 0, sleep: 0,
    });
    return;
  }
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
    state.enemies = state.enemies.filter((x) => x !== e);
    addLog(`${def.name}をたおした。経験値${def.exp}`);
    gainExp(def.exp);
  } else {
    addLog(`${def.name}に${dmg}のダメージ。`);
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

  // 自然回復
  if (p.hp < p.maxHp) {
    p.regen += p.maxHp * DATA.player.regenRate;
    if (p.regen >= 1) {
      const heal = Math.floor(p.regen);
      p.regen -= heal;
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }
  } else {
    p.regen = 0;
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
  const dmg = calcDamage(def.atk, playerDef());
  p.hp = Math.max(0, p.hp - dmg);
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
  const last = state.floor >= dungeon.floors;
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
  if (state.floor >= dungeon.floors) {
    showOverlay(
      '生還！',
      `${dungeon.name}を踏破した。<br>Lv${state.player.level}　${state.turn}ターン`,
      [{ label: 'もう一度潜る', primary: true, onClick: startDungeon }]
    );
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
    hidden: 0,                  // 隠れ身の残りターン
  };
}

function startDungeon() {
  hideOverlay();
  state.floor = 1;
  state.turn = 0;
  state.logs = [];
  state.player = createPlayer();
  state.bag = [];
  setupUnknownNames();
  generateFloor();
  addLog(`${DATA.dungeons[state.dungeonId].name}に入った。`);
  updateUI();
}

function onDeath() {
  releaseStick();
  closeBag();
  const dungeon = DATA.dungeons[state.dungeonId];
  addLog('力尽きた……');
  showOverlay(
    '力尽きた……',
    `${dungeon.name} ${state.floor}階<br>Lv${state.player.level}　${state.turn}ターン`,
    [{ label: 'もう一度潜る', primary: true, onClick: startDungeon }]
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
  if (state.bag.length >= DATA.bag.size) {
    addLog(`持ち物がいっぱいで、${itemName(f.item)}を拾えない。`);
    return false;
  }
  state.floorItems = state.floorItems.filter((x) => x !== f);
  state.bag.push(f.item);
  addLog(`${itemName(f.item)}を拾った。`);
  return true;
}

function removeFromBag(item) {
  const p = state.player;
  state.bag = state.bag.filter((x) => x !== item);
  if (p.weapon === item) p.weapon = null;
  if (p.shield === item) p.shield = null;
}

function isEquipped(item) {
  const p = state.player;
  return p.weapon === item || p.shield === item;
}

// 装備する／外す
function toggleEquip(item) {
  const p = state.player;
  const def = itemDef(item);
  const slot = def.cat === 'weapon' ? 'weapon' : 'shield';
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
  removeFromBag(item);
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
        state.enemies = state.enemies.filter((z) => z !== e);
        addLog(`${name}が${edef.name}に当たった。${edef.name}をたおした。経験値${edef.exp}`);
        gainExp(edef.exp);
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
  const identifyMode = state.bagMode === 'identify';
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
      `<span class="item-name">${itemName(item)}</span>` +
      (isEquipped(item) ? '<span class="item-equip">装備中</span>' : '');
    row.onclick = () => {
      if (identifyMode) {
        identify(item.id);
        addLog(`${state.looks[item.id]}は${def.name}だった！`);
        bagActionDone(true);
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
    addBtn('やめる', () => { addLog('識別をやめた。'); bagActionDone(true); });
    return;
  }
  if (!sel) {
    desc.textContent = items.length ? 'アイテムを選んでください。' : '';
    addBtn('閉じる', closeBag);
    return;
  }

  const def = itemDef(sel);
  desc.textContent = isKnown(sel.id) ? def.desc : 'まだ正体が分からない。';
  if (def.cat === 'weapon' || def.cat === 'shield') {
    addBtn(isEquipped(sel) ? '外す' : '装備', () => { toggleEquip(sel); bagActionDone(true); }, true);
  } else if (def.cat === 'herb') {
    addBtn('食べる', () => { const t = useItem(sel); if (state.bagMode !== 'identify') bagActionDone(t); }, true);
  } else if (def.cat === 'scroll') {
    addBtn('読む', () => { const t = useItem(sel); if (state.bagMode !== 'identify') bagActionDone(t); }, true);
  }
  addBtn('投げる', () => { throwItem(sel); bagActionDone(true); });
  addBtn('置く', () => { const t = dropItem(sel); bagActionDone(t); });
  addBtn('閉じる', closeBag);
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
  $('turn').textContent = `${state.turn}ターン`;
  $('lv').textContent = `Lv${p.level}`;
  $('hp').textContent = `HP ${p.hp}/${p.maxHp}`;
  const ratio = p.hp / p.maxHp;
  const fill = $('hpfill');
  fill.style.width = `${Math.max(0, ratio * 100)}%`;
  fill.classList.toggle('mid', ratio <= 0.5 && ratio > 0.25);
  fill.classList.toggle('low', ratio <= 0.25);

  let label = '足踏み';
  if (enemyInDir(p.dir)) label = '攻撃';
  else if (onStairs()) label = '降りる';
  else if (floorItemAt(p.x, p.y)) label = '拾う';
  $('btn-action').textContent = label;
}

// メッセージ画面を出す。buttons は [{ label, onClick, primary }] の配列
function showOverlay(title, text, buttons) {
  state.locked = true;
  $('ov-title').textContent = title;
  $('ov-text').innerHTML = text;
  const box = $('ov-buttons');
  box.innerHTML = '';
  buttons.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    if (b.primary) btn.classList.add('primary');
    btn.dataset.index = i;
    btn.onclick = b.onClick;
    box.appendChild(btn);
  });
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

  // 敵（見えている敵だけ）
  for (const e of state.enemies) {
    if (!state.visible[idx(e.x, e.y)]) continue;
    let ox = 0, oy = 0;
    if (e.lunge > 0 && e.lungeDir >= 0) {
      ox = DIRS[e.lungeDir][0] * e.lunge * ts * 0.25;
      oy = DIRS[e.lungeDir][1] * e.lunge * ts * 0.25;
    }
    drawEnemy(e, e.rx * ts - camX + ox, e.ry * ts - camY + oy, ts);
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
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.color;
  ctx.beginPath(); ctx.arc(cx, cy, ts * 0.36, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(ts * 0.36)}px sans-serif`;
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

// 仮の主人公：赤いマント＋紺のスーツ＋顔、向きの矢印
function drawPlayer(sx, sy, ts, dir, hurt) {
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
    if (!state.visible[idx(e.x, e.y)]) continue;
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
  if (state.turnMode) {
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
  if (stick.active || busy()) return;
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
// 持ち物画面の外側（暗い部分）を触ったら閉じる
$('bag').addEventListener('pointerdown', (e) => {
  if (e.target.id !== 'bag') return;
  if (state.bagMode === 'identify') return; // 識別の選択中は閉じない
  closeBag();
});
onPress('btn-mini', () => setShowMap(!state.showMini));
onPress('btn-swap', () => {
  const swapped = $('app').classList.toggle('swapped');
  saveSetting('swapControls', swapped);
});

// ============================================================
// 操作：キーボード（PCでの確認用）
// 矢印キー / テンキー / Q W E A D Z X C で8方向、スペースで決定、Mで地図、Iで持ち物
// Shiftを押しながら方向キーで、向きだけ変える
// ============================================================
const KEY_DIRS = {
  ArrowRight: 0, ArrowDown: 2, ArrowLeft: 4, ArrowUp: 6,
  6: 0, 3: 1, 2: 2, 1: 3, 4: 4, 7: 5, 8: 6, 9: 7,
  d: 0, c: 1, x: 2, z: 3, a: 4, q: 5, w: 6, e: 7,
};
window.addEventListener('keydown', (e) => {
  // メッセージ画面：Enter/スペースで1つ目のボタン、Escで2つ目のボタン
  if (state.locked) {
    const btns = $('ov-buttons').querySelectorAll('button');
    if ((e.key === 'Enter' || e.key === ' ') && btns[0]) { e.preventDefault(); btns[0].click(); }
    if (e.key === 'Escape' && btns[1]) btns[1].click();
    return;
  }
  // 持ち物画面：Escで閉じる
  if (state.bagOpen) {
    if (e.key === 'Escape' && state.bagMode !== 'identify') closeBag();
    return;
  }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'i') { openBag(); return; }
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
startDungeon();
requestAnimationFrame(frame);
