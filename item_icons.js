// ============================================================
// item_icons.js v7.3 『異世界ダンジョンから定時で帰りたい』
// アイテムアイコンの対応表と、先読み・描画ヘルパー（新規ファイル）
//
//
// 1) img/icons/ フォルダに、このファイルと一緒に渡したPNGを全部入れる
// 2) index.html の game.js より前に1行追加する:
// <script src="item_icons.js?v=7.3"></script>
// 3) game.js 側では下の3関数を使う:
// preloadItemIcons() … 起動時に1回呼ぶ（先読み）
// drawItemIcon(ctx, item, x, y, size) … Canvas用（床のアイテム・持ち物）
// itemIconHTML(item, size) … DOM用（持ち物リスト等）<img>文字列を返す
//
//
// 草と巻物は未識別の間、本当のアイコンを見せると正体がバレる。
// そのため未識別のときは「見た目アイコン」(item_grass_lookN /
// item_scroll_lookN) を返す。item.look に見た目番号（草1〜6、巻物1〜8）
// が入っていればそれを使い、無ければ名前から決定的に1つ選ぶ。
// 識別済み・持ち込み済みのものは今までどおり本当のアイコンを返す。
// ============================================================

const ITEM_ICONS = {
// 武器
"木刀": "img/icons/item_bokuto.png",
"銅の剣": "img/icons/item_sword_copper.png",
"鉄の剣": "img/icons/item_sword_iron.png",
"鋼の剣": "img/icons/item_sword_steel.png",
"社長の剣": "img/icons/item_sword_president.png",
"錆びない剣": "img/icons/item_sword_stainless.png",
"定時の剣": "img/icons/item_sword_teiji.png",
"残業刀": "img/icons/item_katana_zangyo.png",
"ハンコハンマー": "img/icons/item_hanko_hammer.png",
"経費の剣": "img/icons/item_sword_keihi.png",
// 盾
"木の盾": "img/icons/item_shield_wood.png",
"鉄の盾": "img/icons/item_shield_iron.png",
"鋼の盾": "img/icons/item_shield_steel.png",
"社長の盾": "img/icons/item_shield_president.png",
"静音の盾": "img/icons/item_shield_silent.png",
"目覚まし時計の盾": "img/icons/item_shield_alarm.png",
"アタッシュケースの盾": "img/icons/item_shield_attache.png",
"クレーム返しの盾": "img/icons/item_shield_claim.png",
"分厚いファイルの盾": "img/icons/item_shield_file.png",
"有給の盾": "img/icons/item_shield_yukyu.png",
// 投げ物
"投げ石": "img/icons/item_stone.png",
// 草
"回復草": "img/icons/item_grass_heal.png",
"特製回復草": "img/icons/item_grass_heal_big.png",
"毒草": "img/icons/item_grass_poison.png",
"力の草": "img/icons/item_grass_power.png",
"幸せの草": "img/icons/item_grass_happy.png",
"万能薬草": "img/icons/item_grass_cureall.png",
// 巻物
"識別の巻物": "img/icons/item_scroll_identify.png",
"地図の巻物": "img/icons/item_scroll_map.png",
"眠りの巻物": "img/icons/item_scroll_sleep.png",
"隠れ身の巻物": "img/icons/item_scroll_hide.png",
"帰還の巻物": "img/icons/item_scroll_return.png",
"砥石の巻物": "img/icons/item_scroll_whetstone.png",
"一斉送信の巻物": "img/icons/item_scroll_send.png",
"定時の巻物": "img/icons/item_scroll_teiji.png",
// 飲み物
"エナジードリンク": "img/icons/item_drink_energy.png",
"缶コーヒー": "img/icons/item_drink_coffee.png",
// 時・帰還・通貨
"時の砂": "img/icons/item_sand_time.png",
"大きな砂時計": "img/icons/item_hourglass_big.png",
"ひび割れた砂時計": "img/icons/item_hourglass_cracked.png",
"帰還の糸": "img/icons/item_thread_return.png",
"トニー": "img/icons/item_tony.png",
};

// 未識別の見た目アイコン（草6種・巻物8種）
const ITEM_ICON_LOOKS = {
grass: [1, 2, 3, 4, 5, 6].map(n => "img/icons/item_grass_look" + n + ".png"),
scroll: [1, 2, 3, 4, 5, 6, 7, 8].map(n => "img/icons/item_scroll_look" + n + ".png"),
};

const GRASS_NAMES = ["回復草", "特製回復草", "毒草", "力の草", "幸せの草", "万能薬草"];
const SCROLL_NAMES = ["識別の巻物", "地図の巻物", "眠りの巻物", "隠れ身の巻物",
"帰還の巻物", "砥石の巻物", "一斉送信の巻物", "定時の巻物"];

// アイテム（文字列 or オブジェクト）からアイコンのパスを返す
function itemIconPath(item) {
if (!item) return null;
const name = (typeof item === "string")? item: (item.name || item.trueName || "");
const identified = (typeof item === "object")
? (item.identified!== false): true; // identified:false のときだけ未識別
if (!identified) {
if (GRASS_NAMES.includes(name)) {
const looks = ITEM_ICON_LOOKS.grass;
const i = (item.look >= 1 && item.look <= looks.length)
? item.look - 1: GRASS_NAMES.indexOf(name) % looks.length;
return looks[i];
}
if (SCROLL_NAMES.includes(name)) {
const looks = ITEM_ICON_LOOKS.scroll;
const i = (item.look >= 1 && item.look <= looks.length)
? item.look - 1: SCROLL_NAMES.indexOf(name) % looks.length;
return looks[i];
}
}
return ITEM_ICONS[name] || null;
}

// 先読み（敵の絵の先読みと同じ場所で呼ぶ想定）
const _itemIconImages = {};
function preloadItemIcons() {
const paths = Object.values(ITEM_ICONS)
.concat(ITEM_ICON_LOOKS.grass, ITEM_ICON_LOOKS.scroll);
for (const p of paths) {
if (!_itemIconImages[p]) {
const im = new Image();
im.src = p;
_itemIconImages[p] = im;
}
}
}
function itemIconImage(item) {
const p = itemIconPath(item);
if (!p) return null;
if (!_itemIconImages[p]) { const im = new Image(); im.src = p; _itemIconImages[p] = im;}
return _itemIconImages[p];
}

// Canvas用: (x, y) を左上として size px で描く。アイコンが無い場合は false
function drawItemIcon(ctx, item, x, y, size) {
const im = itemIconImage(item);
if (!im ||!im.complete || im.naturalWidth === 0) return false;
ctx.drawImage(im, x, y, size, size);
return true;
}

// DOM用: 持ち物リストなどに差し込む <img> 文字列。無い場合は空文字
function itemIconHTML(item, size) {
const p = itemIconPath(item);
if (!p) return "";
const s = size || 28;
const name = (typeof item === "string")? item: (item.name || "");
return '<img src="' + p + '" width="' + s + '" height="' + s +
'" alt="' + name + '" style="vertical-align:middle">';
}
