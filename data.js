// ============================================================
// data.js  ― ゲームのデータ・設定値
// 数値の調整は基本的にこのファイルだけで行う
// ============================================================
const DATA = {
  version: '6.0',  // データのバージョン（画面右下に表示。更新したら数字を上げる）

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
      size: 1.2,     // 1マスに対する絵の大きさ
      hop: 0.12,     // 歩いたときに跳ねる高さ（1マスに対する割合）。0で跳ねない
      tilt: 0.12,    // 歩いたときに左右に傾く角度（0.12で約7度）。1歩ごとに左右が入れ替わる
      stretch: 0.08, // 歩いたときに縦に伸びる量（0.08で8%）
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
  // move: 'chase' = まっすぐ追ってくる / 'erratic' = ふらふら動く（半分の確率でランダム移動）
  // drop: 倒したときに落とすアイテム。rate = 確率、items = 候補（この中から1つ）
  enemies: {
    slime:  { name: 'スライム', symbol: 'ス', color: '#4fae5a', hp: 6,  atk: 2, def: 0, exp: 3,  hitRate: 0.85, move: 'chase',
              drop: { rate: 0.10, items: ['herb_heal', 'sand_small'] } },
    bat:    { name: 'コウモリ', symbol: 'モ', color: '#7a5aa8', hp: 7,  atk: 3, def: 0, exp: 5,  hitRate: 0.85, move: 'erratic',
              drop: { rate: 0.10, items: ['stone', 'energy'] } },
    kobold: { name: 'コボルド', symbol: 'コ', color: '#a8743a', hp: 11, atk: 3, def: 1, exp: 7,  hitRate: 0.88, move: 'chase',
              drop: { rate: 0.15, items: ['stone', 'sword_copper', 'shield_wood'] } },
    goblin: { name: 'ゴブリン', symbol: 'ゴ', color: '#3f7f7a', hp: 16, atk: 5, def: 2, exp: 12, hitRate: 0.88, move: 'chase',
              drop: { rate: 0.20, items: ['sand_small', 'sword_iron', 'thread'] } },

    // ボス（spawnTable には入れない。迷宮の boss で指定する）
    // summon: 気づいてから every ターンごとに手下を呼ぶ（max 体まで）
    // reward: 倒したときのごほうび。tony = トニー、items = この中から1つ必ず落とす、revival = 初めて倒したときに進む村の復興（トニー換算）
    boss_overtime: { name: '残業の番人', symbol: '番', color: '#c0392b', hp: 80, atk: 7, def: 3, exp: 60, hitRate: 0.9, move: 'chase',
              boss: true,
              summon: { every: 6, max: 3, ids: ['kobold', 'goblin'], text: '残業の番人は部下を呼んだ！' },
              reward: { tony: 300, items: ['herb_heal2', 'sword_iron', 'shield_iron', 'sand_big'], revival: 200 } },
  },

  // アイテムの定義
  // cat（種類）: weapon=武器 / shield=盾 / herb=草 / scroll=巻物 / throw=投げ物
  // 草と巻物は、迷宮に入るたびに見た目がシャッフルされる（未識別）
  // price: 基準の値段（道具屋で売ると sellRate 倍。投げ石は1個あたり）
  items: {
    sword_copper: { name: '銅の剣', price: 100, cat: 'weapon', atk: 3, desc: '攻撃力+3' },
    sword_iron:   { name: '鉄の剣', price: 300, cat: 'weapon', atk: 6, desc: '攻撃力+6' },
    shield_wood:  { name: '木の盾', price: 100, cat: 'shield', def: 2, desc: '防御力+2' },
    shield_iron:  { name: '鉄の盾', price: 300, cat: 'shield', def: 4, desc: '防御力+4' },

    herb_heal:   { name: '回復草', price: 50,     cat: 'herb', heal: 25, maxUp: 1, desc: 'HPを25回復。満タンなら最大HP+1' },
    herb_heal2:  { name: '特製回復草', price: 150, cat: 'herb', heal: 60, maxUp: 2, desc: 'HPを60回復。満タンなら最大HP+2' },
    herb_poison: { name: '毒草', price: 20,       cat: 'herb', damage: 5, atkDown: 1, desc: 'HPが5減り、力が1下がる' },
    herb_power:  { name: '力の草', price: 200,     cat: 'herb', atkUp: 1, desc: '力が1上がる' },
    herb_happy:  { name: '幸せの草', price: 300,   cat: 'herb', levelUp: 1, desc: 'レベルが1上がる' },

    scroll_identify: { name: '識別の巻物', price: 100,   cat: 'scroll', effect: 'identify', desc: '持ち物を1つ識別する' },
    scroll_map:      { name: '地図の巻物', price: 80,   cat: 'scroll', effect: 'map',      desc: 'この階の地形と階段が分かる' },
    scroll_sleep:    { name: '眠りの巻物', price: 120,   cat: 'scroll', effect: 'sleep',    desc: '見えている敵を眠らせる' },
    scroll_hide:     { name: '隠れ身の巻物', price: 120, cat: 'scroll', effect: 'hide',     desc: 'しばらく敵に見つからなくなる' },
    scroll_return:   { name: '帰還の巻物', price: 300,   cat: 'scroll', effect: 'return',   desc: 'その場から地上へ生還する' },

    // 時計を戻すアイテム（満腹度でいうパン）
    sand_small:   { name: '時の砂', price: 80,           cat: 'time', rewind: 120, desc: '時計を2時間戻す' },
    sand_big:     { name: '大きな砂時計', price: 250,     cat: 'time', resetStart: true, desc: '時計を朝9:00まで戻す' },
    sand_cracked: { name: 'ひび割れた砂時計', price: 40, cat: 'time', rewind: 120, damage: 6, desc: '時計を2時間戻すが、HPが6減る' },

    // 回復を早めるアイテム
    energy: { name: 'エナジードリンク', price: 60, cat: 'drink', boostTurns: 30, desc: '30ターンの間、自然回復が2倍。残業中も回復する' },

    // 帰還の糸：拾うと糸が1本増える（持ち物には入らない）。使うときは広告が必要
    thread: { name: '帰還の糸', cat: 'thread', desc: '拾うと帰還の糸が1本増える' },

    // stack: 束で落ちている数（最小, 最大）。同じものは1枠にまとめて持てる
    stone: { name: '投げ石', price: 6, cat: 'throw', throwDmg: 6, stack: [3, 6], desc: '投げると6前後のダメージ。装備すると「投げる」ボタンで投げられる' },

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
    scroll: ['ゆらめく巻物', 'かすれた巻物', '焦げた巻物', '光る巻物', '湿った巻物', '古びた巻物'],
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
        { id: 'slime',  from: 1, to: 5,  weight: 5 },
        { id: 'bat',    from: 2, to: 10, weight: 3 },
        { id: 'kobold', from: 3, to: 10, weight: 4 },
        { id: 'goblin', from: 6, to: 10, weight: 3 },
      ],
      // 未識別の有無。本番の洞窟は「未識別なし（true）」の予定。試作では確認のため false
      identifyAll: false,
      itemStart: [5, 8],    // 階に落ちているアイテムの数（最小, 最大）
      itemTable: [
        { id: 'herb_heal',       from: 1, to: 10, weight: 10 },
        { id: 'herb_heal2',      from: 3, to: 10, weight: 3 },
        { id: 'herb_poison',     from: 1, to: 10, weight: 4 },
        { id: 'herb_power',      from: 1, to: 10, weight: 2 },
        { id: 'herb_happy',      from: 2, to: 10, weight: 1 },
        { id: 'scroll_identify', from: 1, to: 10, weight: 4 },
        { id: 'scroll_map',      from: 1, to: 10, weight: 3 },
        { id: 'scroll_sleep',    from: 2, to: 10, weight: 3 },
        { id: 'scroll_hide',     from: 2, to: 10, weight: 2 },
        { id: 'scroll_return',   from: 2, to: 10, weight: 1 },
        { id: 'sand_small',      from: 1, to: 10, weight: 6 },
        { id: 'sand_big',        from: 3, to: 10, weight: 2 },
        { id: 'sand_cracked',    from: 1, to: 10, weight: 2 },
        { id: 'energy',          from: 1, to: 10, weight: 4 },
        { id: 'thread',          from: 2, to: 10, weight: 1 },
        { id: 'stone',           from: 1, to: 10, weight: 5 },
        { id: 'sword_copper',    from: 1, to: 6,  weight: 2 },
        { id: 'sword_iron',      from: 5, to: 10, weight: 1 },
        { id: 'shield_wood',     from: 1, to: 6,  weight: 2 },
        { id: 'shield_iron',     from: 5, to: 10, weight: 1 },
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
        { id: 'slime',  from: 1, to: 5,   weight: 5 },
        { id: 'bat',    from: 2, to: 999, weight: 3 },
        { id: 'kobold', from: 3, to: 999, weight: 4 },
        { id: 'goblin', from: 6, to: 999, weight: 3 },
      ],
      identifyAll: false,
      itemStart: [5, 8],
      itemTable: [
        { id: 'herb_heal',       from: 1, to: 999, weight: 10 },
        { id: 'herb_heal2',      from: 3, to: 999, weight: 3 },
        { id: 'herb_poison',     from: 1, to: 999, weight: 4 },
        { id: 'herb_power',      from: 1, to: 999, weight: 2 },
        { id: 'herb_happy',      from: 2, to: 999, weight: 1 },
        { id: 'scroll_identify', from: 1, to: 999, weight: 4 },
        { id: 'scroll_map',      from: 1, to: 999, weight: 3 },
        { id: 'scroll_sleep',    from: 2, to: 999, weight: 3 },
        { id: 'scroll_hide',     from: 2, to: 999, weight: 2 },
        { id: 'scroll_return',   from: 2, to: 999, weight: 1 },
        { id: 'sand_small',      from: 1, to: 999, weight: 6 },
        { id: 'sand_big',        from: 3, to: 999, weight: 2 },
        { id: 'sand_cracked',    from: 1, to: 999, weight: 2 },
        { id: 'energy',          from: 1, to: 999, weight: 4 },
        { id: 'thread',          from: 2, to: 999, weight: 1 },
        { id: 'stone',           from: 1, to: 999, weight: 5 },
        { id: 'sword_copper',    from: 1, to: 6,   weight: 2 },
        { id: 'sword_iron',      from: 5, to: 999, weight: 1 },
        { id: 'shield_wood',     from: 1, to: 6,   weight: 2 },
        { id: 'shield_iron',     from: 5, to: 999, weight: 1 },
      ],
    },

    // 帰らずの迷宮（準備中）
    endless: {
      name: '帰らずの迷宮',
      locked: true,
    },
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
};
