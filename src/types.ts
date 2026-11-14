// schema/scenario.schema.json に対応する型定義
export type PlayerId = string;
export type VariantKey = "good" | "bad";
export type Phase = "initial" | "movement" | "firstPlay" | "nextPlay" | "outcome";
export type BallMotion = "hold" | "dribble" | "ground" | "air" | "steal" | "shot";

export interface Point {
  x: number;
  y: number;
}

export interface Ball extends Point {
  owner: PlayerId | null;
  motion: BallMotion;
}

export interface ArrowOverlay {
  type: "arrow";
  kind: "run" | "dribble" | "pass" | "shot";
  by: PlayerId;
  from: Point;
  to: Point;
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

export type Overlay = ArrowOverlay | PassLaneOverlay | SpaceOverlay | TriangleOverlay;

export interface Step {
  phase: Phase;
  title: string;
  explanation: string;
  durationMs: number;
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
  schemaVersion: 1;
  id: string;
  title: string;
  theme: string;
  coachNote?: string;
  targetGrade: "low" | "middle" | "high";
  teams: { home: Team; away: Team };
  variants: Record<VariantKey, Variant>;
}
