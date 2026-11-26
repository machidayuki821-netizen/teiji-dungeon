// ============================================================
// data.js  ― ゲームのデータ・設定値
// 数値の調整は基本的にこのファイルだけで行う
// ============================================================
const DATA = {
  version: '7.11',  // データのバージョン（画面右下に表示。更新したら数字を上げる）

  // テスト用（本番では false にする）
  debug: {
    bossTest: true,     // 祠に「10階から（テスト）」ボタンを出す
    testLevel: 8,       // テストで始めるときのレベル
    testItems: ['sword_iron', 'shield_iron', 'herb_heal', 'herb_heal', 'herb_heal'], // テストで持たせるアイテム（武器・盾は装備した状態）
  },

  // マップ生成の設定
  map: {
    width: 48,       // マップ全体の横マス数（gridXで割り切れる数にする）
    height: 36,      // マップ全体の縦マス数（gridYで割り切れる数にする）
    gridX: 3,        // 部屋を置く区画の横の数
    gridY: 3,        // 部屋を置く区画の縦の数
    dummyMax: 2,     // 部屋の代わりに通路の分岐点にする区画の最大数
    extraLinks: 2,   // 一本道を避けるために追加する通路の数
  },

  // 画面表示の設定
  view: {
    cols: 9,         // 画面の横に表示するマス数（奇数にすると主人公が中央に来る）
    mapAlpha: 0.3,   // 常時表示する地図の濃さ（0〜1。0.25で透明度75%）
    // 主人公の絵（向きごと）。横・斜めは左向きの絵で、右向きは左右反転して使う
    hero: {
      down: 'img/hero_down.png',
      up:   'img/hero_up.png',
      side: 'img/hero_side.png',
      diag: 'img/hero_diag.png',
      updiag: 'img/hero_updiag.png', // 斜め上（左上向き。右上は左右反転）
      // コマ送り版スプライト（各8コマを横に並べた画像。読み込めなければ上の1枚絵を使う）
      // コマの並び: [待機, 歩き1, 歩き2, 歩き3, 攻撃, やられ, 倒れる, 待機2]
      sheets: {
        down: 'img/hero_anim_down.png',
        up: 'img/hero_anim_up.png',
        side: 'img/hero_anim_side.png',
        diag: 'img/hero_anim_diag.png',
        updiag: 'img/hero_anim_updiag.png',
        idleSec: 1.6, // 待機コマ（待機⇔待機2）の切り替え間隔（秒）
      },
      size: 1.2,     // 1マスに対する絵の大きさ
      hop: 0.12,     // 歩いたときに跳ねる高さ（1マスに対する割合）。0で跳ねない
      tilt: 0.12,    // 歩いたときに左右に傾く角度（0.12で約7度）。1歩ごとに左右が入れ替わる
      stretch: 0.08, // 歩いたときに縦に伸びる量（0.08で8%）
      idle: 'breathe', // 待機中の動き（下の idle を参照）
    },
    // 待機中の動き（ターンが止まっていても動いている）。敵ごとに enemies の idle で選ぶ
    // breathe=呼吸（伸び縮み） / slow=ゆっくり呼吸 / sway=左右に揺れる / float=ふわふわ浮く / jitter=小刻みに震える
    idle: {
      breathe: 0.03, // 伸び縮みの量（0.03で3%）
      sway: 0.06,    // 揺れる角度（ラジアン。0.06で約3.5度）
      float: 0.08,   // 浮く高さ（1マスに対する割合）
    },
    // 攻撃の演出
    anim: {
      attack: 0.26,  // 攻撃の動きの長さ（秒）。溜め → 踏み込み → 戻る
      windup: 0.12,  // 溜めで後ろに引く量（1マスに対する割合）
      reach: 0.32,   // 踏み込む量（1マスに対する割合）
      lean: 0.25,    // 踏み込むときの体の傾き（ラジアン）
      recoil: 0.12,  // 攻撃を受けた側がのけぞる量
      lock: 260,     // 攻撃の演出中、操作を受け付けない時間（ミリ秒）。歩くときは待たない
      death: 0.5,    // 倒れた敵が消えるまでの時間（秒）
      deathBlinks: 14, // 消えるまでの点滅の回数
    },
    // 敵の絵：img/enemy_○○.png（256×256の絵を「正面・背面・左向き・左下向き・左上向き」の順に横に5つ並べた1枚）
    // 右向きの3方向は左右反転して使う。絵がない敵は丸＋文字で表示する
    enemy: {
      path: 'img/enemy_{sprite}.png',
      size: 1.15,    // 1マスに対する絵の大きさ
      hop: 0.08,     // 歩いたときに跳ねる高さ
    },
  },

  // 操作の設定
  control: {
    deadZone: 22,        // スティックが反応し始める距離（px）
    stickRadius: 60,     // スティックの土台の半径（px）
    hysteresis: 10,      // 方向が切り替わりにくくする角度（度）。指のブレで方向が変わるのを防ぐ
    changeDelay: 120,    // 倒したまま方向を変えたとき、1歩目を出すまでの待ち時間（ミリ秒）
    repeatDelay: 500,    // 倒し続けたとき、連続移動が始まるまでの時間（ミリ秒）
    repeatInterval: 170, // 連続移動の間隔（ミリ秒）
  },

  // 主人公の能力（迷宮に入るたびにこの値から始まる）
  player: {
    hp: 30,             // 最大HP
    atk: 4,             // 攻撃力
    def: 0,             // 防御力
    hitRate: 0.92,      // 攻撃が当たる確率
    regenRate: 0.006,   // 1ターンごとに回復する量（最大HPに対する割合）。0.006で最大HP30なら約5ターンに1回復
    // レベルアップに必要な累計経験値（左から Lv2, Lv3, Lv4 ...）
    expTable: [10, 25, 45, 70, 100, 140, 190, 250, 320, 400, 500, 620],
    // レベルが1上がるごとの上昇量
    levelUp: { hp: 5, atk: 1 },
  },

  // 時計（満腹度の代わり）。時刻は「0時からの分」で持つ（540 = 9:00）
  clock: {
    start: 540,         // 迷宮に入る時刻（9:00）
    overtime: 1020,     // 定時（17:00）。ここから自然回復が半分になる
    lastTrain: 1440,    // 終電（24:00）。時計はここで止まり、毎ターンHPが減る
    overtimeRegen: 0.5, // 残業中の自然回復の倍率（0.5 = 半分）
    perTurn: 1,         // 1ターンで進む分数
    drain: 1,           // 終電後に毎ターン減るHP
  },

  // 帰還の糸（広告で使う命綱）
  // 最初の本数は迷宮ごとに設定する（dungeons の threads）
  threads: {
    max: 3,             // 持てる最大本数
    rewind: 180,        // 「時を戻す」で戻る分数（3時間）
  },

  // 17:00と24:00のお知らせ
  notices: {
    overtime: {
      title: '定時です。',
      text: '🔔 キーンコーンカーンコーン♪<br>これより残業モードに入ります。<br>自然回復は半分になります。',
      button: '残業する',
    },
    lastTrain: {
      title: '終電が出発しました。',
      text: '🚃 プシュー……<br>本日の自然回復は終了しました。<br>これより体力の自動引き落としを開始します。',
      button: '歩いて帰る',
    },
  },

  // 敵の定義
  // sprite: 絵の名前（img/enemy_○○.png。5方向を横に並べた1枚）。tint: 上位版の色の変え方
  // move: chase=追ってくる / territory=自分の部屋から出ない / still=動かない / flank=背中側に回り込む / keepAway=近づくと離れる
  // onHit: 攻撃が当たったときの追加効果（status=状態異常, rust=武器が錆びる, steal=トニーを盗む）
  // aura: 近くにいるだけでかかる状態異常（range=距離, chance=毎ターンの確率）
  // ranged: 離れた所からの攻撃（range=距離, chance=使う確率, times=回数）
  // drop: 倒したときに落とすアイテム。rate = 確率、items = 候補（この中から1つ）
  enemies: {
    // ---- 下位版 ----
    sabizan:   { name: 'サビザン', sprite: 'sabizan', symbol: 'サ', color: '#8a4b2a', hp: 8, atk: 3, def: 0, exp: 5, hitRate: 0.85, idle: 'jitter', move: 'chase',
                 lastStand: true, overtimeAtk: 1.5,
                 drop: { rate: 0.12, items: ['bokuto', 'sword_copper', 'sword_iron', 'sword_norust'] } },
    marunage:  { name: 'マルナゲ', sprite: 'marunage', symbol: 'マ', color: '#7f97a0', hp: 7, atk: 3, def: 0, exp: 5, hitRate: 0.85, idle: 'sway', move: 'keepAway',
                 ranged: { range: 4, chance: 0.6, times: 1, text: '書類を投げてきた' },
                 drop: { rate: 0.12, items: ['stone', 'scroll_broadcast', 'scroll_identify'] } },
    nemawashi: { name: 'ネマワシ', sprite: 'nemawashi', symbol: 'ネ', color: '#7a5a3c', hp: 8, atk: 2, def: 0, exp: 6, hitRate: 0.85, idle: 'breathe', move: 'chase',
                 rumor: true,
                 drop: { rate: 0.12, items: ['scroll_map', 'scroll_identify', 'scroll_sleep'] } },
    madogiwa:  { name: 'マドギワ', sprite: 'madogiwa', symbol: 'ド', color: '#c9b083', hp: 18, atk: 3, def: 2, exp: 8, hitRate: 0.8, idle: 'slow', move: 'still', attackRate: 0.4,
                 aura: { status: 'sleep', range: 1, chance: 0.25, text: 'ぽかぽかした空気に、まぶたが重くなる……' },
                 drop: { rate: 0.12, items: ['herb_heal', 'herb_power'] } },
    sontaku:   { name: 'ソンタク', sprite: 'sontaku', symbol: 'ソ', color: '#d4b24a', hp: 11, atk: 4, def: 1, exp: 8, hitRate: 0.88, idle: 'sway', move: 'flank',
                 onHit: { status: 'confuse', rate: 0.3 },
                 drop: { rate: 0.12, items: ['herb_heal2', 'scroll_teiji', 'sand_big', 'energy'] } },
    otsubone:  { name: 'オツボネ', sprite: 'otsubone', symbol: 'オ', color: '#7b4fa0', hp: 14, atk: 4, def: 1, exp: 9, hitRate: 0.88, idle: 'breathe', move: 'territory',
                 onHit: { status: 'phone', rate: 0.3 },
                 drop: { rate: 0.12, items: ['sand_small', 'energy', 'coffee'] } },
    nabakari:  { name: 'ナバカリ', sprite: 'nabakari', symbol: 'ナ', color: '#d9a92e', hp: 6, atk: 3, def: 0, exp: 10, hitRate: 0.85, idle: 'sway', move: 'chase',
                 armor: 3,
                 drop: { rate: 0.12, items: ['shield_wood', 'shield_iron', 'shield_silent', 'shield_alarm'] } },
    amakudari: { name: 'アマクダリ', sprite: 'amakudari', symbol: 'ア', color: '#a8a8b8', hp: 12, atk: 3, def: 1, exp: 10, hitRate: 0.88, idle: 'float', move: 'chase',
                 dropIn: true, onHit: { steal: 0.3, rate: 0.5 }, tonyDrop: [10, 20],
                 drop: { rate: 0.12, items: ['sand_small', 'shield_case'] } },

    // ---- 上位版（色違い・肩書き付き） ----
    sabizan2:   { name: 'サビザン係長', sprite: 'sabizan', tint: 'hue-rotate(200deg) saturate(1.2)', symbol: 'サ', color: '#4a5f8a', hp: 22, atk: 7, def: 3, exp: 20, hitRate: 0.88, idle: 'jitter', move: 'chase',
                  lastStand: true, overtimeAtk: 1.5, onHit: { rust: 1, rate: 0.3 },
                  drop: { rate: 0.22, items: ['sword_iron', 'sword_steel', 'sword_teiji', 'sword_zangyo', 'hammer_hanko'] } },
    marunage2:  { name: 'マルナゲ課長', sprite: 'marunage', tint: 'hue-rotate(120deg) saturate(1.4)', symbol: 'マ', color: '#9a7fa0', hp: 18, atk: 5, def: 2, exp: 18, hitRate: 0.88, idle: 'sway', move: 'keepAway',
                  ranged: { range: 5, chance: 0.7, times: 2, text: '書類を次々に投げてきた' },
                  drop: { rate: 0.22, items: ['stone', 'scroll_broadcast', 'scroll_hide'] } },
    nemawashi2: { name: 'ネマワシ専務', sprite: 'nemawashi', tint: 'hue-rotate(260deg) saturate(1.5)', symbol: 'ネ', color: '#5a3c7a', hp: 18, atk: 4, def: 1, exp: 18, hitRate: 0.88, idle: 'breathe', move: 'chase',
                  rumor: true, rumorBuff: 20,
                  drop: { rate: 0.22, items: ['scroll_map', 'scroll_whet', 'scroll_broadcast'] } },
    madogiwa2:  { name: 'マドギワ部長', sprite: 'madogiwa', tint: 'hue-rotate(300deg) saturate(1.3)', symbol: 'ド', color: '#c98383', hp: 36, atk: 6, def: 4, exp: 22, hitRate: 0.82, idle: 'slow', move: 'still', attackRate: 0.4,
                  aura: { status: 'sleep', range: 4, chance: 0.2, text: '部屋じゅうがぽかぽかして、まぶたが重くなる……' },
                  drop: { rate: 0.22, items: ['herb_heal2', 'herb_cure', 'herb_happy'] } },
    sontaku2:   { name: 'ソンタク秘書', sprite: 'sontaku', tint: 'hue-rotate(170deg) saturate(1.2)', symbol: 'ソ', color: '#4ab2d4', hp: 24, atk: 7, def: 3, exp: 22, hitRate: 0.9, idle: 'sway', move: 'flank',
                  onHit: { status: 'confuse', rate: 0.35 }, buffAura: { range: 2, atk: 2 },
                  drop: { rate: 0.22, items: ['scroll_whet', 'scroll_teiji', 'herb_happy', 'shield_paid'] } },
    otsubone2:  { name: 'オツボネ会長', sprite: 'otsubone', tint: 'hue-rotate(140deg) saturate(1.3)', symbol: 'オ', color: '#4fa07b', hp: 30, atk: 7, def: 3, exp: 25, hitRate: 0.9, idle: 'breathe', move: 'territory',
                  onHit: { status: 'phone', rate: 0.4 },
                  aura: { status: 'phone', range: 3, chance: 0.25, text: 'オツボネ会長の小言が聞こえてくる……' },
                  drop: { rate: 0.22, items: ['sand_big', 'energy', 'coffee', 'shield_claim'] } },
    nabakari2:  { name: 'ナバカリ部長', sprite: 'nabakari', tint: 'hue-rotate(180deg) saturate(1.2)', symbol: 'ナ', color: '#2ea9d9', hp: 14, atk: 6, def: 1, exp: 30, hitRate: 0.88, idle: 'sway', move: 'chase',
                  armor: 5,
                  drop: { rate: 0.22, items: ['shield_iron', 'shield_steel', 'shield_case', 'shield_file'] } },
    amakudari2: { name: 'アマクダリ顧問', sprite: 'amakudari', tint: 'hue-rotate(-40deg) saturate(1.8) brightness(1.05)', symbol: 'ア', color: '#c8a838', hp: 26, atk: 6, def: 2, exp: 25, hitRate: 0.9, idle: 'float', move: 'chase',
                  dropIn: true, onHit: { steal: 0.5, rate: 0.5 }, tonyDrop: [25, 45],
                  drop: { rate: 0.22, items: ['sand_big', 'shield_case', 'sword_keihi'] } },

    // ボス（spawnTable には入れない。迷宮の boss で指定する）
    // summon: 気づいてから every ターンごとに手下を呼ぶ（max 体まで）
    // reward: 倒したときのごほうび。tony = トニー、items = この中から1つ必ず落とす、revival = 初めて倒したときに進む村の復興（トニー換算）
    boss_overtime: { name: '残業の番人', symbol: '番', color: '#c0392b', hp: 80, atk: 7, def: 3, exp: 60, hitRate: 0.9, move: 'chase',
              boss: true,
              summon: { every: 6, max: 3, ids: ['sabizan2', 'marunage'], text: '残業の番人は部下を呼んだ！' },
              reward: { tony: 300, items: ['herb_heal2', 'sword_steel', 'shield_steel', 'sand_big'], revival: 200 } },
  },

  // 状態異常（turns = 続くターン数）
  status: {
    confuse: { name: '寝不足', icon: '😵', turns: 8,  start: '寝不足で頭がふらふらする！', end: '頭がすっきりした。' },
    sleep:   { name: '居眠り', icon: '💤', turns: 5,  start: '居眠りしてしまった……',       end: '目が覚めた！' },
    phone:   { name: '電話中', icon: '📞', turns: 6,  start: '長い電話につかまった！（攻撃・道具が使えない）', end: 'やっと電話が終わった。' },
  },
  caffeineTurns: 30,  // 缶コーヒーで寝不足・居眠りにかかりにくくなるターン数

  // 鍛冶屋（強化値 n にする費用 = costBase × n × n。錆びてマイナスのときの修理は costBase）
  smith: { max: 9, min: -3, costBase: 100 }, // min = 錆びて下がる強化値の下限

  // アイテムの定義
  // cat（種類）: weapon=武器 / shield=盾 / herb=草 / scroll=巻物 / throw=投げ物
  // 草と巻物は、迷宮に入るたびに見た目がシャッフルされる（未識別）
  // price: 基準の値段（道具屋で売ると sellRate 倍。投げ石は1個あたり）
  // 武器・盾は鍛冶屋で +1〜+9 に強化できる（強化値は装備ごと）
  items: {
    // ---- 武器 ----
    bokuto:          { name: '木刀',           cat: 'weapon', atk: 2,  price: 50,   desc: '攻撃力+2' },
    sword_copper:    { name: '銅の剣',         cat: 'weapon', atk: 3,  price: 100,  desc: '攻撃力+3' },
    sword_iron:      { name: '鉄の剣',         cat: 'weapon', atk: 6,  price: 300,  desc: '攻撃力+6' },
    sword_steel:     { name: '鋼の剣',         cat: 'weapon', atk: 9,  price: 600,  desc: '攻撃力+9' },
    sword_president: { name: '社長の剣',       cat: 'weapon', atk: 12, price: 1200, desc: '攻撃力+12。いちばん偉い剣' },
    sword_norust:    { name: '錆びない剣',     cat: 'weapon', atk: 5,  price: 400,  noRust: true, desc: '攻撃力+5。錆びない' },
    sword_teiji:     { name: '定時の剣',       cat: 'weapon', atk: 5,  price: 500,  teijiBonus: 3, desc: '攻撃力+5。17:00より前は、さらに+3' },
    sword_zangyo:    { name: '残業刀',         cat: 'weapon', atk: 3,  price: 500,  overtimeBonus: 6, desc: '攻撃力+3。17:00を過ぎると、さらに+6' },
    hammer_hanko:    { name: 'ハンコハンマー', cat: 'weapon', atk: 8,  price: 700,  hitMod: -0.2, stun: 1, desc: '攻撃力+8。よく外れるが、当たると敵が1ターン止まる' },
    sword_keihi:     { name: '経費の剣',       cat: 'weapon', atk: 4,  price: 450,  tonyOnKill: [3, 8], desc: '攻撃力+4。敵を倒すとトニーが少しもらえる' },

    // ---- 盾 ----
    shield_wood:      { name: '木の盾',               cat: 'shield', def: 2, price: 100,  desc: '防御力+2' },
    shield_iron:      { name: '鉄の盾',               cat: 'shield', def: 4, price: 300,  desc: '防御力+4' },
    shield_steel:     { name: '鋼の盾',               cat: 'shield', def: 6, price: 600,  desc: '防御力+6' },
    shield_president: { name: '社長の盾',             cat: 'shield', def: 9, price: 1200, desc: '防御力+9。いちばん偉い盾' },
    shield_silent:    { name: '静音の盾',             cat: 'shield', def: 3, price: 400,  immune: 'phone', desc: '防御力+3。電話中にならない' },
    shield_alarm:     { name: '目覚まし時計の盾',     cat: 'shield', def: 3, price: 400,  immune: 'sleep', desc: '防御力+3。居眠りにならない' },
    shield_case:      { name: 'アタッシュケースの盾', cat: 'shield', def: 4, price: 450,  immune: 'theft', desc: '防御力+4。トニーを盗まれない' },
    shield_claim:     { name: 'クレーム返しの盾',     cat: 'shield', def: 3, price: 500,  reflect: 0.35, desc: '防御力+3。投げられた物をときどき跳ね返す' },
    shield_file:      { name: '分厚いファイルの盾',   cat: 'shield', def: 7, price: 500,  regenMul: 0.5, desc: '防御力+7。重くて自然回復が半分になる' },
    shield_paid:      { name: '有給の盾',             cat: 'shield', def: 2, price: 450,  regenMul: 1.5, desc: '防御力+2。自然回復が1.5倍になる' },

    // ---- 草 ----
    herb_heal:   { name: '回復草',     cat: 'herb', heal: 25, maxUp: 1, price: 50,  desc: 'HPを25回復。満タンなら最大HP+1' },
    herb_heal2:  { name: '特製回復草', cat: 'herb', heal: 60, maxUp: 2, price: 150, desc: 'HPを60回復。満タンなら最大HP+2' },
    herb_poison: { name: '毒草',       cat: 'herb', damage: 5, atkDown: 1, price: 20, desc: 'HPが5減り、力が1下がる' },
    herb_power:  { name: '力の草',     cat: 'herb', atkUp: 1, price: 200, desc: '力が1上がる' },
    herb_happy:  { name: '幸せの草',   cat: 'herb', levelUp: 1, price: 300, desc: 'レベルが1上がる' },
    herb_cure:   { name: '万能薬草',   cat: 'herb', cureAll: true, heal: 10, maxUp: 0, price: 150, desc: '状態異常をすべて治し、HPを10回復' },

    // ---- 巻物 ----
    scroll_identify:  { name: '識別の巻物',     cat: 'scroll', effect: 'identify',  price: 100, desc: '持ち物を1つ識別する' },
    scroll_map:       { name: '地図の巻物',     cat: 'scroll', effect: 'map',       price: 80,  desc: 'この階の地形と階段が分かる' },
    scroll_sleep:     { name: '眠りの巻物',     cat: 'scroll', effect: 'sleep',     price: 120, desc: '見えている敵を眠らせる' },
    scroll_hide:      { name: '隠れ身の巻物',   cat: 'scroll', effect: 'hide',      price: 120, desc: 'しばらく敵に見つからなくなる' },
    scroll_return:    { name: '帰還の巻物',     cat: 'scroll', effect: 'return',    price: 300, desc: 'その場から地上へ生還する' },
    scroll_whet:      { name: '砥石の巻物',     cat: 'scroll', effect: 'whet',      price: 400, desc: '装備中の武器を+1する（武器がなければ盾）。錆びも直る' },
    scroll_broadcast: { name: '一斉送信の巻物', cat: 'scroll', effect: 'broadcast', power: 12, price: 150, desc: '見えている敵全員に12前後のダメージ' },
    scroll_teiji:     { name: '定時の巻物',     cat: 'scroll', effect: 'teiji', to: 990, price: 250, desc: '17:00を過ぎていたら、時計を16:30に戻す' },

    // 時計を戻すアイテム（満腹度でいうパン）
    sand_small:   { name: '時の砂',           cat: 'time', rewind: 120, price: 80,  desc: '時計を2時間戻す' },
    sand_big:     { name: '大きな砂時計',     cat: 'time', resetStart: true, price: 250, desc: '時計を朝9:00まで戻す' },
    sand_cracked: { name: 'ひび割れた砂時計', cat: 'time', rewind: 120, damage: 6, price: 40, desc: '時計を2時間戻すが、HPが6減る' },

    // 飲み物
    energy: { name: 'エナジードリンク', cat: 'drink', boostTurns: 30, price: 60, desc: '30ターンの間、自然回復が2倍。残業中も回復する' },
    coffee: { name: '缶コーヒー',       cat: 'drink', caffeine: true, price: 40, desc: '寝不足・居眠りを治し、しばらくかかりにくくなる' },

    // 帰還の糸：拾うと糸が1本増える（持ち物には入らない）。使うときは広告が必要
    thread: { name: '帰還の糸', cat: 'thread', desc: '拾うと帰還の糸が1本増える' },

    // stack: 束で落ちている数（最小, 最大）。同じものは1枠にまとめて持てる
    stone: { name: '投げ石', cat: 'throw', throwDmg: 6, stack: [3, 6], price: 6, desc: '投げると6前後のダメージ。装備すると「投げる」ボタンで投げられる' },

    // トニー（お金）：床に落ちている。持ち物には入らない
    tony: { name: 'トニー', cat: 'tony', desc: '村で使えるお金' },
  },

  // 種類ごとの表示（仮素材）
  itemCats: {
    weapon: { label: '武器',   symbol: '剣', color: '#b9b9c8' },
    shield: { label: '盾',     symbol: '盾', color: '#a98a5a' },
    herb:   { label: '草',     symbol: '草', color: '#5fbf6a' },
    scroll: { label: '巻物',   symbol: '巻', color: '#e8dca8' },
    throw:  { label: '投げ物', symbol: '石', color: '#9a9a9a' },
    time:   { label: '砂時計', symbol: '砂', color: '#d9b46a' },
    drink:  { label: '飲み物', symbol: '飲', color: '#6ab0d9' },
    thread: { label: '糸',     symbol: '糸', color: '#d4485f' },
    tony:   { label: 'トニー', symbol: 'ト', color: '#f2c94c' },
  },

  // 未識別のときの呼び名（種類の数より多めに用意しておく）
  unknownNames: {
    herb:   ['青い草', '赤い草', '黄色い草', '白い草', '紫の草', '黒い草', 'まだらの草'],
    scroll: ['ゆらめく巻物', 'かすれた巻物', '焦げた巻物', '光る巻物', '湿った巻物', '古びた巻物', 'しわくちゃの巻物', '金縁の巻物', '破れた巻物'],
  },

  bag: {
    size: 12,          // 持てるアイテムの数
    throwRange: 10,    // 投げたアイテムが飛ぶ最大距離（マス）
    throwBaseDmg: 1,   // 投げ物以外を投げたときのダメージ
  },
  effects: {
    sleepTurns: 10,    // 眠りの巻物で眠るターン数
    hideTurns: 15,     // 隠れ身の巻物の効果ターン数
  },

  // 迷宮の定義
  dungeons: {
    cave: {
      name: '村はずれの洞窟',
      floors: 10,
      threads: 1,           // 最初に持っている帰還の糸の本数
      boss: 'boss_overtime',// 最下層のボス（最下層の階段は「帰還の魔法陣」になる）
      enemyStart: [3, 5],   // 階に着いたときの敵の数（最小, 最大）
      enemyMax: 8,          // 1つの階にいられる敵の最大数
      spawnEvery: 40,       // 何ターンごとに敵が1体湧くか
      // 出現する敵：from〜to階に、weightの比率で出る
      spawnTable: [
        { id: 'sabizan',    from: 1, to: 7,  weight: 5 },
        { id: 'marunage',   from: 1, to: 8,  weight: 4 },
        { id: 'nemawashi',  from: 2, to: 9,  weight: 3 },
        { id: 'madogiwa',   from: 2, to: 10, weight: 3 },
        { id: 'sontaku',    from: 3, to: 10, weight: 3 },
        { id: 'otsubone',   from: 3, to: 10, weight: 3 },
        { id: 'nabakari',   from: 4, to: 10, weight: 2 },
        { id: 'amakudari',  from: 4, to: 10, weight: 2 },
        { id: 'sabizan2',   from: 6, to: 10, weight: 3 },
        { id: 'marunage2',  from: 7, to: 10, weight: 2 },
        { id: 'sontaku2',   from: 8, to: 10, weight: 2 },
        { id: 'nabakari2',  from: 8, to: 10, weight: 1 },
        { id: 'otsubone2',  from: 9, to: 10, weight: 1 },
      ],
      // 未識別の有無。本番の洞窟は「未識別なし（true）」の予定。試作では確認のため false
      identifyAll: false,
      itemStart: [5, 8],    // 階に落ちているアイテムの数（最小, 最大）
      itemTable: [
        { id: 'herb_heal'         , from: 1, to: 10, weight: 10 },
        { id: 'herb_heal2'        , from: 3, to: 10, weight: 3 },
        { id: 'herb_poison'       , from: 1, to: 10, weight: 4 },
        { id: 'herb_power'        , from: 1, to: 10, weight: 2 },
        { id: 'herb_happy'        , from: 2, to: 10, weight: 1 },
        { id: 'herb_cure'         , from: 2, to: 10, weight: 2 },
        { id: 'scroll_identify'   , from: 1, to: 10, weight: 4 },
        { id: 'scroll_map'        , from: 1, to: 10, weight: 3 },
        { id: 'scroll_sleep'      , from: 2, to: 10, weight: 3 },
        { id: 'scroll_hide'       , from: 2, to: 10, weight: 2 },
        { id: 'scroll_return'     , from: 2, to: 10, weight: 1 },
        { id: 'scroll_whet'       , from: 3, to: 10, weight: 1 },
        { id: 'scroll_broadcast'  , from: 2, to: 10, weight: 2 },
        { id: 'scroll_teiji'      , from: 3, to: 10, weight: 1 },
        { id: 'sand_small'        , from: 1, to: 10, weight: 6 },
        { id: 'sand_big'          , from: 3, to: 10, weight: 2 },
        { id: 'sand_cracked'      , from: 1, to: 10, weight: 2 },
        { id: 'energy'            , from: 1, to: 10, weight: 3 },
        { id: 'coffee'            , from: 1, to: 10, weight: 3 },
        { id: 'thread'            , from: 2, to: 10, weight: 1 },
        { id: 'stone'             , from: 1, to: 10, weight: 5 },
        { id: 'bokuto'            , from: 1, to: 4, weight: 2 },
        { id: 'sword_copper'      , from: 1, to: 6, weight: 2 },
        { id: 'sword_iron'        , from: 4, to: 10, weight: 2 },
        { id: 'sword_steel'       , from: 7, to: 10, weight: 1 },
        { id: 'sword_president'   , from: 9, to: 10, weight: 0.3 },
        { id: 'sword_norust'      , from: 3, to: 10, weight: 1 },
        { id: 'sword_teiji'       , from: 3, to: 10, weight: 1 },
        { id: 'sword_zangyo'      , from: 3, to: 10, weight: 1 },
        { id: 'hammer_hanko'      , from: 6, to: 10, weight: 1 },
        { id: 'sword_keihi'       , from: 3, to: 10, weight: 1 },
        { id: 'shield_wood'       , from: 1, to: 6, weight: 2 },
        { id: 'shield_iron'       , from: 4, to: 10, weight: 2 },
        { id: 'shield_steel'      , from: 7, to: 10, weight: 1 },
        { id: 'shield_president'  , from: 9, to: 10, weight: 0.3 },
        { id: 'shield_silent'     , from: 3, to: 10, weight: 1 },
        { id: 'shield_alarm'      , from: 3, to: 10, weight: 1 },
        { id: 'shield_case'       , from: 3, to: 10, weight: 1 },
        { id: 'shield_claim'      , from: 3, to: 10, weight: 1 },
        { id: 'shield_file'       , from: 6, to: 10, weight: 1 },
        { id: 'shield_paid'       , from: 3, to: 10, weight: 1 },
      ],
    },

    // 今日の迷宮：日付から作るので、全員が同じ地形・同じアイテム配置になる
    daily: {
      name: '今日の迷宮',
      daily: true,
      floors: 0,            // 0 = 終わりなし
      threads: 1,
      needClear: 'cave',    // この迷宮から一度生還すると挑戦できる
      noCarry: true,        // 持ち込みなし（Lv1・手ぶら）
      tonyOnly: true,       // 持ち帰れるのはトニーだけ
      tries: 1,             // 1日の挑戦回数
      adTries: 1,           // 広告で増やせる回数
      // 深い階ほど敵が強くなる：from階を超えた1階ごとに、HPと攻撃力が hp・atk の割合で増える
      scale: { from: 5, hp: 0.10, atk: 0.06 },
      enemyStart: [3, 5],
      enemyMax: 8,
      spawnEvery: 40,
      spawnTable: [
        { id: 'sabizan',    from: 1,  to: 12,  weight: 5 },
        { id: 'marunage',   from: 1,  to: 14,  weight: 4 },
        { id: 'nemawashi',  from: 2,  to: 16,  weight: 3 },
        { id: 'madogiwa',   from: 2,  to: 18,  weight: 3 },
        { id: 'sontaku',    from: 3,  to: 18,  weight: 3 },
        { id: 'otsubone',   from: 3,  to: 20,  weight: 3 },
        { id: 'nabakari',   from: 4,  to: 20,  weight: 2 },
        { id: 'amakudari',  from: 4,  to: 20,  weight: 2 },
        { id: 'sabizan2',   from: 6,  to: 999, weight: 4 },
        { id: 'marunage2',  from: 7,  to: 999, weight: 3 },
        { id: 'nemawashi2', from: 9,  to: 999, weight: 2 },
        { id: 'madogiwa2',  from: 9,  to: 999, weight: 2 },
        { id: 'sontaku2',   from: 8,  to: 999, weight: 3 },
        { id: 'otsubone2',  from: 10, to: 999, weight: 2 },
        { id: 'nabakari2',  from: 8,  to: 999, weight: 2 },
        { id: 'amakudari2', from: 10, to: 999, weight: 2 },
      ],
      identifyAll: false,
      itemStart: [5, 8],
      itemTable: [
        { id: 'herb_heal'         , from: 1, to: 999, weight: 10 },
        { id: 'herb_heal2'        , from: 3, to: 999, weight: 3 },
        { id: 'herb_poison'       , from: 1, to: 999, weight: 4 },
        { id: 'herb_power'        , from: 1, to: 999, weight: 2 },
        { id: 'herb_happy'        , from: 2, to: 999, weight: 1 },
        { id: 'herb_cure'         , from: 2, to: 999, weight: 2 },
        { id: 'scroll_identify'   , from: 1, to: 999, weight: 4 },
        { id: 'scroll_map'        , from: 1, to: 999, weight: 3 },
        { id: 'scroll_sleep'      , from: 2, to: 999, weight: 3 },
        { id: 'scroll_hide'       , from: 2, to: 999, weight: 2 },
        { id: 'scroll_return'     , from: 2, to: 999, weight: 1 },
        { id: 'scroll_whet'       , from: 3, to: 999, weight: 1 },
        { id: 'scroll_broadcast'  , from: 2, to: 999, weight: 2 },
        { id: 'scroll_teiji'      , from: 3, to: 999, weight: 1 },
        { id: 'sand_small'        , from: 1, to: 999, weight: 6 },
        { id: 'sand_big'          , from: 3, to: 999, weight: 2 },
        { id: 'sand_cracked'      , from: 1, to: 999, weight: 2 },
        { id: 'energy'            , from: 1, to: 999, weight: 3 },
        { id: 'coffee'            , from: 1, to: 999, weight: 3 },
        { id: 'thread'            , from: 2, to: 999, weight: 1 },
        { id: 'stone'             , from: 1, to: 999, weight: 5 },
        { id: 'bokuto'            , from: 1, to: 4, weight: 2 },
        { id: 'sword_copper'      , from: 1, to: 6, weight: 2 },
        { id: 'sword_iron'        , from: 4, to: 999, weight: 2 },
        { id: 'sword_steel'       , from: 7, to: 999, weight: 1 },
        { id: 'sword_president'   , from: 15, to: 999, weight: 1 },
        { id: 'sword_norust'      , from: 3, to: 999, weight: 1 },
        { id: 'sword_teiji'       , from: 3, to: 999, weight: 1 },
        { id: 'sword_zangyo'      , from: 3, to: 999, weight: 1 },
        { id: 'hammer_hanko'      , from: 6, to: 999, weight: 1 },
        { id: 'sword_keihi'       , from: 3, to: 999, weight: 1 },
        { id: 'shield_wood'       , from: 1, to: 6, weight: 2 },
        { id: 'shield_iron'       , from: 4, to: 999, weight: 2 },
        { id: 'shield_steel'      , from: 7, to: 999, weight: 1 },
        { id: 'shield_president'  , from: 15, to: 999, weight: 1 },
        { id: 'shield_silent'     , from: 3, to: 999, weight: 1 },
        { id: 'shield_alarm'      , from: 3, to: 999, weight: 1 },
        { id: 'shield_case'       , from: 3, to: 999, weight: 1 },
        { id: 'shield_claim'      , from: 3, to: 999, weight: 1 },
        { id: 'shield_file'       , from: 6, to: 999, weight: 1 },
        { id: 'shield_paid'       , from: 3, to: 999, weight: 1 },
      ],
    },

    // 帰らずの迷宮（準備中）
    endless: {
      name: '帰らずの迷宮',
      locked: true,
    },
  },

  // タイトル画面
  // cast: 背景に並べるキャラクター（x, y = 足元の位置。画面の左上からの％、size = 画面の横幅に対する大きさ％）
  //   sprite: 敵の絵の名前（img/enemy_○○.png）、hero: true で主人公。tint で色違い、flip で左右反転
  //   idle: 待機中の動き（breathe / slow / sway / float / jitter）
  title: {
    logo: 'img/title_logo.png',
    cast: [
      // 後列
      { sprite: 'nemawashi', x: 13, y: 65, size: 27, idle: 'breathe', rot: -5, tint: 'hue-rotate(260deg) saturate(1.5)' },
      { sprite: 'otsubone',  x: 50, y: 63, size: 35, idle: 'breathe', flip: true },
      { sprite: 'amakudari', x: 87, y: 65, size: 27, idle: 'float', rot: 5, tint: 'hue-rotate(-40deg) saturate(1.8) brightness(1.05)' },
      // 中後列
      { sprite: 'madogiwa',  x: 14, y: 75, size: 31, idle: 'slow', rot: -4, flip: true, tint: 'hue-rotate(300deg) saturate(1.3)' },
      { sprite: 'sabizan',   x: 34, y: 74, size: 29, idle: 'jitter', rot: -3, tint: 'hue-rotate(200deg) saturate(1.2)' },
      { sprite: 'marunage',  x: 66, y: 74, size: 29, idle: 'sway', rot: 3, tint: 'hue-rotate(120deg) saturate(1.4)' },
      { sprite: 'sontaku',   x: 86, y: 75, size: 28, idle: 'sway', rot: 4, tint: 'hue-rotate(170deg) saturate(1.2)' },
      // 中列
      { sprite: 'madogiwa',  x: 11, y: 86, size: 33, idle: 'slow', rot: -3, flip: true },
      { sprite: 'nabakari',  x: 29, y: 84, size: 32, idle: 'sway', rot: -2, flip: true },
      { sprite: 'sontaku',   x: 71, y: 84, size: 32, idle: 'sway', rot: 2 },
      { sprite: 'marunage',  x: 90, y: 86, size: 33, idle: 'sway', rot: 3 },
      // 前列
      { sprite: 'sabizan',   x: 18, y: 94, size: 39, idle: 'jitter', rot: -3, flip: true },
      { sprite: 'nabakari',  x: 35, y: 92, size: 33, idle: 'sway', rot: -2, flip: true, tint: 'hue-rotate(180deg) saturate(1.2)' },
      { sprite: 'otsubone',  x: 67, y: 91, size: 33, idle: 'breathe', rot: 2, tint: 'hue-rotate(140deg) saturate(1.3)' },
      { sprite: 'amakudari', x: 83, y: 94, size: 37, idle: 'float', rot: 3 },
      // 主人公（中央・最前面）
      { hero: true,          x: 50, y: 96, size: 60, idle: 'breathe' },
    ],
  },

  // 祠に並べる迷宮の順番
  dungeonOrder: ['cave', 'daily', 'endless'],

  // Xに貼る文章
  share: {
    hashtag: '#定時ダンジョン',
  },

  // トニー（お金）
  tony: {
    piles: [1, 2],      // 1つの階に落ちている山の数（最小, 最大）
    amount: [10, 30],   // 1つの山の額（最小, 最大）。これに階数を掛ける
    // 生還したときの倍率（帰った時刻で変わる）。力尽きたら0（全部失う）
    mult: { ontime: 1.5, overtime: 1.0, late: 0.7 },
  },

  // 村
  village: {
    name: 'はじまりの村',
    storageSize: 100,   // 倉庫に入る数（あふれた分は自動で売る）
    sellRate: 0.5,      // 売るときの値段（price に対する割合）
    unknownSell: 10,    // 正体不明のアイテムを売るときの値段
    appraiseCost: 30,   // 鑑定屋の料金（1個）
    // 村の復興（順番に寄付していく）
    revival: [
      { cost: 300,  text: '道具屋が開店する' },
      { cost: 1000, text: '鑑定屋と鍛冶屋が開店する' },
    ],
    // 施設（need = 必要な復興段階）
    facilities: [
      { key: 'shrine',    name: 'アリアの祠', icon: '⛩️', need: 0 },
      { key: 'storage',   name: '倉庫',       icon: '📦', need: 0 },
      { key: 'shop',      name: '道具屋',     icon: '🛒', need: 1 },
      { key: 'appraiser', name: '鑑定屋',     icon: '🔍', need: 2 },
      { key: 'smith',     name: '鍛冶屋',     icon: '🔨', need: 2 },
    ],
    // 道具屋の品ぞろえ（count = 束の数）
    shop: [
      { id: 'herb_heal',       price: 50 },
      { id: 'sand_small',      price: 80 },
      { id: 'energy',          price: 60 },
      { id: 'stone',           price: 30, count: 5 },
      { id: 'scroll_identify', price: 100 },
      { id: 'coffee',          price: 40 },
      { id: 'herb_cure',       price: 150 },
      { id: 'bokuto',          price: 50 },
      { id: 'sword_copper',    price: 100 },
      { id: 'shield_wood',     price: 100 },
    ],
  },

  // 敵が主人公に気づく条件
  ai: {
    sightRange: 2,      // 通路では、この距離（マス）以内にいると気づく
    alertTurns: 10,     // 見失っても、このターン数は最後に見た場所を追いかける
  },

  // 色（仮素材）
  // アリアのセリフ（帰還の糸を使うとき）
  aria: {
    thread: 'もう、仕方ないですね……祈りますから、ちゃんと帰ってきてくださいよ。',
    revive: 'まだです！　まだ帰れます！　糸を引いてください！',
    ontime: 'えっ、今日は早いですね！　おかえりなさい！',
    overtime: 'おかえりなさい。今日も遅くまでお疲れさまでした。',
    late: '……おかえりなさい。もう朝ですよ。',
    shrine: 'いってらっしゃい。今日こそ定時で帰ってきてくださいね。',
    relic: '……ひとつだけなら、拾ってこられそうです。どれにしますか？',
  },

  colors: {
    void: '#0b0b10',
    wall: '#2b2735',
    room: '#6e604f',
    corridor: '#584c41',
    gridLine: 'rgba(0,0,0,0.18)',
    fog: 'rgba(0,0,0,0.5)',
    stairs: '#e8c35a',
    cape: '#8b1e32',
    suit: '#26304a',
    face: '#f1d2b6',
    target: 'rgba(255,255,255,0.6)',
    targetTurn: 'rgba(255,215,90,0.85)',
    targetAttack: 'rgba(255,90,90,0.9)',
    miniRoom: '#b9a58c',
    miniCorridor: '#8c7b68',
    miniEnemy: '#ff9a3c',
    miniItem: '#7fd0ff',
    dmgToEnemy: '#ffffff',
    dmgToPlayer: '#ff6b6b',
    heal: '#7dff9a',
    unknownName: '#ffd84a', // 持ち物画面での未識別アイテムの文字色
    sensed: 'rgba(255,154,60,0.55)', // 危険察知で見えている敵
  },
  // ダンジョンの地形テーマ（壁・床・装飾の見た目）。洞窟は階層帯ごとに色と装飾が変わる
  // moss/puddle/crystal/stalactite は装飾の出る確率（0〜1）。歩行判定には影響しない
  terrain: {
    tilePx: 64, // 地形を事前に描くときの1マスの大きさ（px）
    cave: {
      bands: [
        // 入口帯：明るめ、苔が多い
        { maxFloor: 3,  room: '#77644e', corridor: '#63533f', wallFace: '#4d4238', wallDeep: '#17141c', rim: '#a08b6d', moss: 0.34, puddle: 0,    crystal: 0,    stalactite: 0.16 },
        // 湿潤帯：暗く、水たまりと鍾乳石
        { maxFloor: 6,  room: '#6b5844', corridor: '#574838', wallFace: '#453a31', wallDeep: '#14121a', rim: '#8d7a5f', moss: 0.16, puddle: 0.09, crystal: 0,    stalactite: 0.24 },
        // 深層帯：青紫寄り、結晶が光る
        { maxFloor: 9,  room: '#5d5148', corridor: '#4c423c', wallFace: '#3c3540', wallDeep: '#100e16', rim: '#7d7468', moss: 0.05, puddle: 0.05, crystal: 0.16, stalactite: 0.22 },
        // 最下層（ボス）：暗い赤茶
        { maxFloor: 99, room: '#5e463a', corridor: '#4d382e', wallFace: '#40302a', wallDeep: '#120d10', rim: '#8a6a52', moss: 0,    puddle: 0,    crystal: 0.08, stalactite: 0.2 },
      ],
    },
  },
};
