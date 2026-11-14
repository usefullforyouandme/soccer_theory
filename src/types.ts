// schema/scenario.schema.json(v2)に対応する型定義
export type PlayerId = string;
export type VariantKey = "good" | "bad";
export type Phase = "initial" | "movement" | "firstPlay" | "nextPlay" | "outcome";
export type BallMotion = "hold" | "dribble" | "ground" | "air" | "steal" | "shot";
export type Judgement = "good" | "bad";
export type Grade = "low" | "middle" | "high";

export interface Point {
  x: number;
  y: number;
}

export interface Ball extends Point {
  owner: PlayerId | null;
  motion: BallMotion;
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

export type Overlay = ArrowOverlay | PassLaneOverlay | SpaceOverlay | TriangleOverlay | CalloutOverlay;

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

export interface Scenario {
  schemaVersion: 2;
  id: string;
  title: string;
  theme: string;
  coachNote?: string;
  targetGrade: Grade;
  /** Step 1 のあとに出す問いかけ(予想させる) */
  question: string;
  /** 最後に出す「きょうの ポイント」 */
  keyPoint: string;
  teams: { home: Team; away: Team };
  variants: Record<VariantKey, Variant>;
}
