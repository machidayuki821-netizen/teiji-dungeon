// ============================================================
// data.js  ― ゲームのデータ・設定値
// 数値の調整は基本的にこのファイルだけで行う
// ============================================================
const DATA = {
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
    regenRate: 0.012,   // 1ターンごとに回復する量（最大HPに対する割合）
    // レベルアップに必要な累計経験値（左から Lv2, Lv3, Lv4 ...）
    expTable: [10, 25, 45, 70, 100, 140, 190, 250, 320, 400, 500, 620],
    // レベルが1上がるごとの上昇量
    levelUp: { hp: 5, atk: 1 },
  },

  // 敵の定義
  // move: 'chase' = まっすぐ追ってくる / 'erratic' = ふらふら動く（半分の確率でランダム移動）
  enemies: {
    slime:  { name: 'スライム', symbol: 'ス', color: '#4fae5a', hp: 6,  atk: 2, def: 0, exp: 3,  hitRate: 0.85, move: 'chase' },
    bat:    { name: 'コウモリ', symbol: 'モ', color: '#7a5aa8', hp: 7,  atk: 3, def: 0, exp: 5,  hitRate: 0.85, move: 'erratic' },
    kobold: { name: 'コボルド', symbol: 'コ', color: '#a8743a', hp: 11, atk: 3, def: 1, exp: 7,  hitRate: 0.88, move: 'chase' },
    goblin: { name: 'ゴブリン', symbol: 'ゴ', color: '#3f7f7a', hp: 16, atk: 5, def: 2, exp: 12, hitRate: 0.88, move: 'chase' },
  },

  // 迷宮の定義
  dungeons: {
    cave: {
      name: '村はずれの洞窟',
      floors: 10,
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
    },
  },

  // 敵が主人公に気づく条件
  ai: {
    sightRange: 2,      // 通路では、この距離（マス）以内にいると気づく
    alertTurns: 10,     // 見失っても、このターン数は最後に見た場所を追いかける
  },

  // 色（仮素材）
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
    dmgToEnemy: '#ffffff',
    dmgToPlayer: '#ff6b6b',
    heal: '#7dff9a',
  },
};
