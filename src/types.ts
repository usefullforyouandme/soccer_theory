// schema/scenario.schema.json(v2)に対応する型定義
export type PlayerId = string;
export type VariantKey = "good" | "bad";
export type Phase = "initial" | "movement" | "firstPlay" | "nextPlay" | "outcome";
export type BallMotion = "hold" | "dribble" | "ground" | "air" | "steal" | "shot";
export type Judgement = "good" | "bad";
export type Grade = "low" | "middle" | "high";
/** 結末の種類: チャンス(緑)/ ピンチ(赤)/ 残念(灰。チャンスを逃した・相手ボールになった) */
export type OutcomeTone = "chance" | "pinch" | "miss";
export type GoalSide = "home" | "away";
/** 種類: ボールを前へ運ぶ / ゴールをねらう / ボールを取る・守る / 切りかえ / リスタート・キーパー(試合の場面)、ドリブル / パス / ラダー(練習メニュー) */
export type Category = "build" | "attack" | "defend" | "transition" | "restart" | "dribble" | "pass" | "agility";
/** 試合の場面 / 練習メニューの説明 */
export type ScenarioKind = "match" | "drill";
/** ボールに当てる所: 足の内がわ / 外がわ / うら / くつひもの所 / つま先 */
export type FootSurface = "inside" | "outside" | "sole" | "instep" | "toe";

export interface Point {
  x: number;
  y: number;
}

export interface Ball extends Point {
  owner: PlayerId | null;
  motion: BallMotion;
  /** このパスはオフサイド(ミスとして見せるために意図したもの)。ground/air のときだけ */
  offside?: boolean;
  /** 浮き球を相手(または味方)がカットした。steal のときだけ。air と同じく浮いて見せる */
  lofted?: boolean;
}

/** from/to を省略すると、選手(またはボール)の前ステップ位置 → 現ステップ位置から自動で描く */
export interface ArrowOverlay {
  type: "arrow";
  kind: "run" | "dribble" | "pass" | "shot";
  by: PlayerId;
  judgement?: Judgement;
  from?: Point;
  to?: Point;
}

export interface PassLaneOverlay {
  type: "passLane";
  from: PlayerId;
  to: PlayerId;
  state: "open" | "blocked";
}

export interface SpaceOverlay extends Point {
  type: "space";
  rx: number;
  ry: number;
  label?: string;
}

export interface TriangleOverlay {
  type: "triangle";
  players: [PlayerId, PlayerId, PlayerId];
}

/** 選手の頭上に出す吹き出し(良い動き/悪い動きをその場で示す) */
export interface CalloutOverlay {
  type: "callout";
  player: PlayerId;
  text: string;
  tone: Judgement;
}

/** オフサイドライン(守っているチームの後ろから2人目、またはボールの位置。選手の動きに追従) */
export interface OffsideLineOverlay {
  type: "offsideLine";
  /** 守っているチーム */
  defending: GoalSide;
}

/** シュートコース(ボールまたは選手と、ゴールの両ポストを結ぶ三角形) */
export interface ShotConeOverlay {
  type: "shotCone";
  from: PlayerId | "ball";
  /** ねらうゴール: away = 相手のゴール(Y=0)、home = 自分のゴール(Y=68) */
  goal: GoalSide;
  /** 三角形の真ん中の線(キーパーが立つ目安)を描く */
  centerLine?: boolean;
  label?: string;
}

/** 選手が見た方向(視野)の扇形。そのステップの間は選手の向きもこの方向になる */
export interface LookOverlay {
  type: "look";
  player: PlayerId;
  /** 見る先: 選手、ボール、または座標 */
  at: PlayerId | "ball" | Point;
  /** good = 周りを見ている(省略時)/ bad = ボールだけを見ている */
  judgement?: Judgement;
}

/** コーン(練習メニュー用) */
export interface ConeOverlay extends Point {
  type: "cone";
}

/** コーン 2 本の門(練習メニュー用) */
export interface GateOverlay {
  type: "gate";
  a: Point;
  b: Point;
  label?: string;
}

/** ラダー(練習メニュー用)。a(入り口)から b(出口)へ、rungs マスのはしごを置く */
export interface LadderOverlay {
  type: "ladder";
  a: Point;
  b: Point;
  rungs: number;
  /** はしごの幅(m)。省略時は 0.5 */
  width?: number;
}

/** 足を着いた所(練習メニュー用)。turn はつま先の向き(度。0 = 画面の上、プラスは右回り) */
export interface StepOverlay extends Point {
  type: "step";
  foot: "left" | "right";
  turn?: number;
  judgement?: Judgement;
}

export type Overlay =
  | ArrowOverlay
  | PassLaneOverlay
  | SpaceOverlay
  | TriangleOverlay
  | CalloutOverlay
  | OffsideLineOverlay
  | ShotConeOverlay
  | LookOverlay
  | ConeOverlay
  | GateOverlay
  | LadderOverlay
  | StepOverlay;

/** 足の使い方(練習メニュー用)。説明欄に「あしもと」図、ピッチに軸足の足あとを出す */
export interface Foot {
  player: PlayerId;
  kick: "right" | "left";
  surface: FootSurface;
  /** 軸足のつま先の向き(度)。0 = ボールを送る方向、プラスは右回り */
  plant?: number;
  /** ボールを送る先。省略時はボール(動かない時は選手)の動きの向き */
  toward?: PlayerId | Point;
  judgement?: Judgement;
}

export interface Step {
  phase: Phase;
  title: string;
  /** {h7} のような選手トークンを含められる(画面では色付きの「7番」になる) */
  explanation: string;
  durationMs: number;
  /** 強調する選手。省略時は explanation に出てくる選手 */
  focus?: PlayerId[];
  players: Record<PlayerId, Point>;
  ball: Ball;
  overlays: Overlay[];
  foot?: Foot;
}

export interface Variant {
  label: string;
  outcomeBanner: string;
  /** 省略時は good = chance、bad = pinch */
  outcomeTone?: OutcomeTone;
  steps: Step[];
}

export type Role = "GK" | "LB" | "CB" | "RB" | "LM" | "CM" | "RM" | "FW";

export interface TeamPlayer {
  id: PlayerId;
  number: number;
  role: Role;
}

export interface Team {
  name: string;
  formation: string;
  players: TeamPlayer[];
}

/** 練習メニュー(人数 / 広さ / ルール / 成功の目安) */
export interface Drill {
  title: string;
  players: string;
  area: string;
  rule: string;
  success: string;
  note?: string;
  /** この練習を動きで見せる練習メニュー(kind: drill)の id */
  id?: string;
}

/** 練習メニューの指導者向けカード(準備・やり方・回数・レベルアップ・安全) */
export interface Practice {
  setup: string;
  howTo: string;
  reps: string;
  levelUp?: string;
  safety?: string;
}

/** ずかん全体の合言葉 */
export type Keyword = "look" | "move" | "goal" | "switch" | "protect";

/** 選択式の予想 */
export interface Choice {
  text: string;
  correct: boolean;
  /** 答え合わせの一言 */
  feedback: string;
}

/** つづきの場面のシナリオ */
export interface NextLink {
  id: string;
  label: string;
}

/** 同じ場面を反対側から見たシナリオ(おたがいに指し合う) */
export interface Counterpart {
  id: string;
  /** ボタンの文字(例: 守る側から見る) */
  label: string;
}

export interface Scenario {
  schemaVersion: 2;
  /** 省略時は match(試合の場面) */
  kind?: ScenarioKind;
  id: string;
  /** テーマ名(同じテーマの別パターンは同じタイトル)。答えが書いてあるので、問いかけの後に出す */
  title: string;
  /** 子ども向けの疑問形タイトル(答えを書かない)。一覧と問いかけ中に出す */
  questionTitle?: string;
  /** 合言葉 */
  keyword?: Keyword;
  /** おすすめの順番 */
  courseOrder?: number;
  category: Category;
  /** テーマのID。同じテーマの別パターンは同じ値 */
  group: string;
  /** パターン名(ボールの位置・守備の状況の違い) */
  pattern: string;
  theme: string;
  coachNote?: string;
  /** 反対側(攻める側/守る側など)から見たシナリオ */
  counterpart?: Counterpart;
  /** 指導者がピッチで子どもに掛ける短い言葉(指導者向け欄に表示) */
  coachCue?: string;
  /** 関連する練習メニュー(指導者向け欄に表示) */
  drills?: Drill[];
  targetGrade: Grade;
  /** Step 1 のあとに出す問いかけ(予想させる) */
  question: string;
  /** 最後に出す「きょうの ポイント」 */
  keyPoint: string;
  /** 選択式の予想 */
  choices?: Choice[];
  /** ルールが大会で違う場面の注記 */
  ruleNote?: string;
  /** つづきの場面 */
  next?: NextLink;
  /** 練習メニューの広さ(m)。座標は X=0〜w、Y=0〜h */
  area?: { w: number; h: number };
  /** 練習メニューの指導者向けカード */
  practice?: Practice;
  /** 練習メニューから、この技術を使う試合の場面へ */
  match?: { id: string };
  teams: { home: Team; away: Team };
  variants: Record<VariantKey, Variant>;
}
