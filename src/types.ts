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
/** 種類: ボールを前へ運ぶ / ゴールをねらう / ボールを取る・守る / 切りかえ / リスタート・キーパー */
export type Category = "build" | "attack" | "defend" | "transition" | "restart";

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

export type Overlay =
  | ArrowOverlay
  | PassLaneOverlay
  | SpaceOverlay
  | TriangleOverlay
  | CalloutOverlay
  | OffsideLineOverlay
  | ShotConeOverlay
  | LookOverlay;

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
}

export interface Variant {
  label: string;
  outcomeBanner: string;
  /** 省略時は good = chance、bad = pinch */
  outcomeTone?: OutcomeTone;
  steps: Step[];
}

export interface TeamPlayer {
  id: PlayerId;
  number: number;
  role: "GK" | "LB" | "CB" | "RB" | "LM" | "CM" | "RM" | "FW";
}

export interface Team {
  name: string;
  formation: string;
  players: TeamPlayer[];
}

export interface Drill {
  title: string;
  description: string;
}

/** 同じ場面を反対側から見たシナリオ(おたがいに指し合う) */
export interface Counterpart {
  id: string;
  /** ボタンの文字(例: 守る側から見る) */
  label: string;
}

export interface Scenario {
  schemaVersion: 2;
  id: string;
  /** テーマ名(同じテーマの別パターンは同じタイトル) */
  title: string;
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
  teams: { home: Team; away: Team };
  variants: Record<VariantKey, Variant>;
}
