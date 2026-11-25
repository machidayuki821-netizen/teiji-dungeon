// ============================================================
// item_icons.js v7.3 『異世界ダンジョンから定時で帰りたい』
// アイテムアイコンの対応表と、先読み・描画ヘルパー
//
//
// index.html で data.js の後、game.js の前に読み込む:
// <script src="item_icons.js?v=7.3"></script>
// 画像は img/icons/ フォルダに入れる。
//
//
// preloadItemIcons() … 起動時に1回（先読み）
// itemIconImage(id, known, lookName) … Canvas用。Imageか null
// itemIconHTML(id, known, lookName) … DOM用。<img>文字列か ''
// id: アイテムID（data.js の DATA.items のキー）
// known: 識別済みなら true
// lookName: 未識別のときの見た目の名前（state.looks[id]）
//
//
// 草と巻物は未識別の間、本当のアイコンを見せると正体がバレる。
// そのため未識別では「見た目アイコン」を返す。見た目の名前
// （青い草・焦げた巻物など）ごとに決まったアイコンを使うので、
// 名前と絵が食い違うことはない。
// ============================================================

const ITEM_ICONS_BY_ID = {
// 武器
bokuto: "img/icons/item_bokuto.png",
sword_copper: "img/icons/item_sword_copper.png",
sword_iron: "img/icons/item_sword_iron.png",
sword_steel: "img/icons/item_sword_steel.png",
sword_president: "img/icons/item_sword_president.png",
sword_norust: "img/icons/item_sword_stainless.png",
sword_teiji: "img/icons/item_sword_teiji.png",
sword_zangyo: "img/icons/item_katana_zangyo.png",
hammer_hanko: "img/icons/item_hanko_hammer.png",
sword_keihi: "img/icons/item_sword_keihi.png",
// 盾
shield_wood: "img/icons/item_shield_wood.png",
shield_iron: "img/icons/item_shield_iron.png",
shield_steel: "img/icons/item_shield_steel.png",
shield_president: "img/icons/item_shield_president.png",
shield_silent: "img/icons/item_shield_silent.png",
shield_alarm: "img/icons/item_shield_alarm.png",
shield_case: "img/icons/item_shield_attache.png",
shield_claim: "img/icons/item_shield_claim.png",
shield_file: "img/icons/item_shield_file.png",
shield_paid: "img/icons/item_shield_yukyu.png",
// 投げ物
stone: "img/icons/item_stone.png",
// 草
herb_heal: "img/icons/item_grass_heal.png",
herb_heal2: "img/icons/item_grass_heal_big.png",
herb_poison: "img/icons/item_grass_poison.png",
herb_power: "img/icons/item_grass_power.png",
herb_happy: "img/icons/item_grass_happy.png",
herb_cure: "img/icons/item_grass_cureall.png",
// 巻物
scroll_identify: "img/icons/item_scroll_identify.png",
scroll_map: "img/icons/item_scroll_map.png",
scroll_sleep: "img/icons/item_scroll_sleep.png",
scroll_hide: "img/icons/item_scroll_hide.png",
scroll_return: "img/icons/item_scroll_return.png",
scroll_whet: "img/icons/item_scroll_whetstone.png",
scroll_broadcast: "img/icons/item_scroll_send.png",
scroll_teiji: "img/icons/item_scroll_teiji.png",
// 時計を戻すアイテム
sand_small: "img/icons/item_sand_time.png",
sand_big: "img/icons/item_hourglass_big.png",
sand_cracked: "img/icons/item_hourglass_cracked.png",
// 飲み物
energy: "img/icons/item_drink_energy.png",
coffee: "img/icons/item_drink_coffee.png",
// 帰還の糸・トニー
thread: "img/icons/item_thread_return.png",
tony: "img/icons/item_tony.png",
};

// 未識別の見た目アイコン: 草（data.js の unknownNames.herb と対応）
const HERB_LOOK_ICONS = {
"青い草": "img/icons/item_grass_look2.png",
"赤い草": "img/icons/item_grass_look1.png",
"黄色い草": "img/icons/item_grass_look4.png",
"白い草": "img/icons/item_grass_look3.png",
"紫の草": "img/icons/item_grass_look5.png",
"黒い草": "img/icons/item_grass_look7.png",
"まだらの草": "img/icons/item_grass_look8.png",
};
// 未識別の見た目アイコン: 巻物（data.js の unknownNames.scroll と対応）
const SCROLL_LOOK_ICONS = {
"ゆらめく巻物": "img/icons/item_scroll_look1.png",
"かすれた巻物": "img/icons/item_scroll_look2.png",
"焦げた巻物": "img/icons/item_scroll_look3.png",
"光る巻物": "img/icons/item_scroll_look4.png",
"湿った巻物": "img/icons/item_scroll_look5.png",
"古びた巻物": "img/icons/item_scroll_look6.png",
"しわくちゃの巻物": "img/icons/item_scroll_look7.png",
"金縁の巻物": "img/icons/item_scroll_look8.png",
"破れた巻物": "img/icons/item_scroll_look9.png",
};

const HERB_IDS = ["herb_heal", "herb_heal2", "herb_poison", "herb_power", "herb_happy", "herb_cure"];
const SCROLL_IDS = ["scroll_identify", "scroll_map", "scroll_sleep", "scroll_hide",
"scroll_return", "scroll_whet", "scroll_broadcast", "scroll_teiji"];

// アイテムIDからアイコンのパスを返す（無い場合は null）
function itemIconPath(id, known, lookName) {
if (!id) return null;
if (!known) {
if (HERB_IDS.includes(id)) {
return HERB_LOOK_ICONS[lookName] || "img/icons/item_grass_look6.png";
}
if (SCROLL_IDS.includes(id)) {
return SCROLL_LOOK_ICONS[lookName] || "img/icons/item_scroll_look1.png";
}
}
return ITEM_ICONS_BY_ID[id] || null;
}

// 先読み
const _itemIconImages = {};
function _itemIconImg(path) {
if (!path) return null;
if (!_itemIconImages[path]) {
const im = new Image();
im.src = path;
_itemIconImages[path] = im;
}
return _itemIconImages[path];
}
function preloadItemIcons() {
const paths = Object.values(ITEM_ICONS_BY_ID)
.concat(Object.values(HERB_LOOK_ICONS), Object.values(SCROLL_LOOK_ICONS),
["img/icons/item_grass_look6.png"]);
for (const p of paths) _itemIconImg(p);
}

// Canvas用: 読み込み済みの Image を返す（まだ読めていない場合も Image を返し、
// 呼び出し側で complete を見て仮表示に切り替えること）
function itemIconImage(id, known, lookName) {
return _itemIconImg(itemIconPath(id, known, lookName));
}

// DOM用: 持ち物・村の一覧に差し込む <img> 文字列。アイコンが無い場合は ''
function itemIconHTML(id, known, lookName) {
const p = itemIconPath(id, known, lookName);
if (!p) return "";
return '<img class="item-icon-img" src="' + p + '" alt="">';
}
