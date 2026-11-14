// 1パターン(おてほん/ミス)分のピッチ描画。時間の管理は main.ts が行い、ここは「ステップ i の進捗 t」の1コマを描く
import type { ArrowOverlay, Ball, Grade, Overlay, PlayerId, Point, Scenario, Step, Variant, VariantKey } from "./types";

const NS = "http://www.w3.org/2000/svg";
const PLAYER_R = 1.5;
const BALL_R = 1.0;
const BALL_GAP = PLAYER_R + BALL_R * 0.9; // 保持中のボールは選手の丸に隠れないよう少し離して描く
const GHOST_MIN_DIST = 4; // 比較表示で「おてほんの位置」を出す最小のずれ(m)
const BANNER = { x: 3, w: 44, h: 9 }; // 結末バナーの横位置・大きさ(縦位置は空いている所を探す)
const GOAL_X = [22.5, 27.5] as const;
const TOKEN = /\{([ha][1-9][0-9]?)\}/g;
let stageSeq = 0;

/** 矢印の色(種類ごとに色と線の形の両方を変える) */
const ARROW_COLORS = {
  "run-home": "#ffffff",
  "run-away": "#ffb4b4",
  "pass-home": "#ffd400",
  "pass-away": "#ff9f43",
  dribble: "#fff3b0",
  shot: "#ffd400",
  bad: "#ff3b30",
} as const;
type ArrowStyle = keyof typeof ARROW_COLORS;

type Attrs = Record<string, string | number>;

function setAttrs(e: Element, attrs: Attrs) {
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  setAttrs(e, attrs);
  parent?.appendChild(e);
  return e;
}

function html<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", parent?: Element): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  parent?.appendChild(e);
  return e;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 2;
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (v: Point): Point => {
  const l = Math.hypot(v.x, v.y);
  return l < 1e-6 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
};
const teamOf = (id: PlayerId) => (id.startsWith("h") ? "home" : "away");
const show = (e: SVGElement, on: boolean) => (e.style.display = on ? "" : "none");
/** ゴールに入ったか(ゴールラインの上で、ゴールの幅の内側) */
const inGoal = (p: Point) => p.x >= GOAL_X[0] && p.x <= GOAL_X[1] && (p.y <= 0.5 || p.y >= 67.5);

/** 1コマ分の状態(ステップ中に毎フレーム変わるもの) */
interface Frame {
  pos: Record<PlayerId, Point>;
  e: number;
}

// ---------- 説明文の選手トークン({h7} → 色付きの「7番」。低学年向けは「7ばん」) ----------
export const playerLabel = (id: PlayerId, grade: Grade) => `${id.slice(1)}${grade === "low" ? "ばん" : "番"}`;
export const plainText = (s: string, grade: Grade) => s.replace(TOKEN, (_, id: string) => playerLabel(id, grade));
export const mentionedPlayers = (s: string) => [...s.matchAll(TOKEN)].map((m) => m[1]);

/** トークンをチーム色のチップにして parent に流し込む */
export function renderRichText(s: string, parent: HTMLElement, grade: Grade) {
  parent.replaceChildren();
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    parent.append(s.slice(last, m.index));
    const chip = html("span", `pchip ${teamOf(m[1])}`);
    chip.textContent = playerLabel(m[1], grade);
    parent.append(chip);
    last = m.index! + m[0].length;
  }
  parent.append(s.slice(last));
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** ピッチ(8人制: 50m × 68m)と攻める方向の表示。ゴールの要素を [相手のゴール, 自分のゴール] で返す */
function drawField(g: SVGGElement, uid: string, mini: boolean): SVGRectElement[] {
  for (let i = 0; i < 10; i++) {
    svg("rect", { x: 0, y: i * 6.8, width: 50, height: 6.8, class: i % 2 ? "turf-b" : "turf-a" }, g);
  }
  const line = { class: "line" };
  svg("rect", { x: 0, y: 0, width: 50, height: 68, ...line }, g);
  svg("line", { x1: 0, y1: 34, x2: 50, y2: 34, ...line }, g);
  svg("circle", { cx: 25, cy: 34, r: 7, ...line }, g);
  svg("circle", { cx: 25, cy: 34, r: 0.3, class: "spot" }, g);
  const goals: SVGRectElement[] = [];
  for (const [y0, dir] of [[0, 1], [68, -1]] as const) {
    svg("rect", { x: 13, y: dir === 1 ? 0 : 56, width: 24, height: 12, ...line }, g);
    svg("rect", { x: 18.5, y: dir === 1 ? 0 : 64, width: 13, height: 4, ...line }, g);
    svg("circle", { cx: 25, cy: y0 + dir * 8, r: 0.3, class: "spot" }, g);
    goals.push(svg("rect", { x: GOAL_X[0], y: dir === 1 ? -1.4 : 68, width: 5, height: 1.4, class: "goal", fill: `url(#${uid}-net)` }, g));
  }
  if (mini) return goals;
  // 攻める方向: 左の余白に大きな矢印、上下にゴールの名前
  svg("path", { d: "M-2.6,6 L-0.6,10.5 L-1.8,10.5 L-1.8,62 L-3.4,62 L-3.4,10.5 L-4.6,10.5 Z", class: "dir-arrow" }, g);
  const dirText = svg("text", { x: -2.6, y: 36, class: "dir-text", "text-anchor": "middle", "dominant-baseline": "central" }, g);
  dirText.textContent = "せめる方向";
  const top = svg("text", { x: 25, y: -3.6, class: "goal-label", "text-anchor": "middle", "dominant-baseline": "central" }, g);
  top.textContent = "▲ 相手のゴール";
  const bottom = svg("text", { x: 25, y: 71.6, class: "goal-label", "text-anchor": "middle", "dominant-baseline": "central" }, g);
  bottom.textContent = "自分のゴール";
  return goals;
}

export interface StageOptions {
  mini?: boolean;
  /** 比較表示のとき、この variant(おてほん)の位置を薄く重ねる */
  ghost?: Variant;
  /** 説明文を読み上げ領域(aria-live)にするか */
  live?: boolean;
}

export class Stage {
  readonly el: HTMLElement;
  readonly variant: Variant;
  private readonly grade: Grade;
  private readonly mini: boolean;
  private readonly ghost?: Variant;
  private readonly svgEl: SVGSVGElement;
  private readonly trailLayer: SVGGElement;
  private readonly ghostLayer: SVGGElement;
  private readonly overlayLayer: SVGGElement;
  private readonly labelLayer: SVGGElement;
  private readonly fxLayer: SVGGElement;
  private readonly bannerLayer: SVGGElement;
  private readonly goals: SVGRectElement[];
  private readonly players = new Map<PlayerId, { g: SVGGElement; ring: SVGCircleElement; nose: SVGGElement }>();
  private readonly ballG: SVGGElement;
  private readonly ballShadow: SVGEllipseElement;
  private readonly captionTitle: HTMLElement;
  private readonly captionText: HTMLElement;
  private readonly uid = `st${++stageSeq}`;
  private captionStep = -1;
  /** ステップが変わったときだけオーバーレイ等を作り直し、フレームごとは座標だけ更新する */
  private builtStep = -1;
  private updaters: ((f: Frame) => void)[] = [];
  private goalFx = false;

  constructor(scenario: Scenario, readonly key: VariantKey, opts: StageOptions = {}) {
    this.variant = scenario.variants[key];
    this.grade = scenario.targetGrade;
    this.mini = !!opts.mini;
    this.ghost = opts.ghost;
    this.el = html("section", `stage stage-${key}${this.mini ? " stage-mini" : ""}`);

    if (!this.mini) {
      const label = html("h2", "stage-label", this.el);
      label.textContent = `${key === "good" ? "◎" : "×"} ${this.variant.label}`;
    }

    const viewBox = this.mini ? "-1.5 -2 53 72" : "-5 -6 60 80";
    this.svgEl = svg("svg", { viewBox, class: "pitch", role: "img" });
    this.svgEl.setAttribute("aria-label", `${scenario.title}(${this.variant.label})`);
    this.el.appendChild(this.svgEl);
    this.defineDefs();

    this.goals = drawField(svg("g", {}, this.svgEl), this.uid, this.mini);
    this.trailLayer = svg("g", { class: "trails" }, this.svgEl);
    this.ghostLayer = svg("g", { class: "ghosts" }, this.svgEl);
    this.overlayLayer = svg("g", { class: "overlays" }, this.svgEl);
    const playerLayer = svg("g", { class: "players" }, this.svgEl);
    for (const side of ["home", "away"] as const) {
      for (const p of scenario.teams[side].players) {
        const g = svg("g", { class: `player ${side}${p.role === "GK" ? " gk" : ""}` }, playerLayer);
        const ring = svg("circle", { r: PLAYER_R + 0.8, class: "focus-ring" }, g);
        const nose = svg("g", { class: "nose" }, g);
        svg("path", { d: "M-0.7,-1.3 L0,-2.35 L0.7,-1.3 Z" }, nose); // 向き(上向きで作って回転させる)
        svg("circle", { r: PLAYER_R, class: "body" }, g);
        const num = svg("text", { class: "num", "text-anchor": "middle", "dominant-baseline": "central" }, g);
        num.textContent = String(p.number);
        this.players.set(p.id, { g, ring, nose });
      }
    }
    const ballLayer = svg("g", { class: "ball-layer" }, this.svgEl);
    this.ballShadow = svg("ellipse", { rx: BALL_R, ry: BALL_R * 0.5, class: "ball-shadow" }, ballLayer);
    this.ballG = svg("g", { class: "ball" }, ballLayer);
    svg("circle", { r: BALL_R, class: "ball-body" }, this.ballG);
    svg("path", { d: "M0,-0.45 L0.43,-0.14 L0.27,0.36 L-0.27,0.36 L-0.43,-0.14 Z", class: "ball-patch" }, this.ballG);
    this.labelLayer = svg("g", { class: "labels" }, this.svgEl); // ラベル・吹き出しは選手より手前
    this.fxLayer = svg("g", { class: "goal-fx" }, this.svgEl);
    this.bannerLayer = svg("g", { class: "banner" }, this.svgEl);

    const caption = html("div", "caption", this.mini ? undefined : this.el);
    this.captionTitle = html("p", "caption-title", caption);
    this.captionText = html("p", "caption-text", caption);
    if (opts.live) this.captionText.setAttribute("aria-live", "polite");
  }

  /** ステップ i の進捗 t(0〜1)のコマを描く。i=0 は初期配置 */
  render(i: number, t: number) {
    const steps = this.variant.steps;
    const cur = steps[i];
    const prev = i > 0 ? steps[i - 1] : cur;
    if (i === 0) t = 1;
    const e = easeInOut(t);
    if (this.captionStep !== i) this.setCaption(i);

    // 選手
    const pos: Record<PlayerId, Point> = {};
    for (const id of this.players.keys()) pos[id] = lerp(prev.players[id], cur.players[id], e);

    // ボール
    const b = this.ballAt(prev, cur, pos, t, e);
    const lift = cur.ball.motion === "air" && i > 0 ? Math.sin(Math.PI * this.ballProgress(cur.ball, t, e)) : 0;
    this.ballShadow.setAttribute("cx", String(b.x + lift * 0.8));
    this.ballShadow.setAttribute("cy", String(b.y + lift * 1.2));
    this.ballShadow.style.opacity = String(0.35 * (1 - lift * 0.5));
    this.ballG.setAttribute("transform", `translate(${b.x} ${b.y}) scale(${1 + lift * 0.7})`);

    const focus = new Set(this.focusOf(cur));
    for (const [id, { g, ring, nose }] of this.players) {
      const p = pos[id];
      g.setAttribute("transform", `translate(${p.x} ${p.y})`);
      ring.classList.toggle("on", focus.has(id));
      // 向き: 動いているステップは進む方向、止まっているときはボールの方向
      const move = { x: cur.players[id].x - prev.players[id].x, y: cur.players[id].y - prev.players[id].y };
      const dir = Math.hypot(move.x, move.y) > 0.8 ? move : { x: b.x - p.x, y: b.y - p.y };
      const deg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI + 90;
      nose.setAttribute("transform", `rotate(${deg.toFixed(1)})`);
    }

    if (this.builtStep !== i) this.buildStep(i, cur, prev, focus);
    const frame: Frame = { pos, e };
    for (const update of this.updaters) update(frame);
    const opacity = String(i === 0 ? 1 : clamp01(t / 0.2));
    this.overlayLayer.style.opacity = opacity;
    this.labelLayer.style.opacity = opacity;

    const scored = i > 0 && cur.ball.motion === "shot" && inGoal(cur.ball) && this.ballProgress(cur.ball, t, e) >= 1;
    this.drawGoalFx(scored ? cur.ball : null);
    this.drawBanner(i === steps.length - 1 && t >= 1, pos, b, cur.ball.owner, focus, scored);
  }

  /** 読み上げ用の文 */
  spokenText(i: number) {
    return plainText(this.variant.steps[i].explanation, this.grade);
  }

  durationOf(i: number) {
    return i === 0 ? 0 : this.variant.steps[i].durationMs;
  }

  private setCaption(i: number) {
    this.captionStep = i;
    const step = this.variant.steps[i];
    this.captionTitle.textContent = `${i + 1}. ${step.title}`;
    renderRichText(step.explanation, this.captionText, this.grade);
  }

  private focusOf(step: Step): PlayerId[] {
    if (step.focus) return step.focus;
    const named = mentionedPlayers(step.explanation);
    if (named.length) return named;
    return step.overlays.flatMap((o) => (o.type === "arrow" ? [o.by] : []));
  }

  // ---------- ボール ----------
  private ballProgress(ball: Ball, t: number, e: number) {
    const carried = ball.motion === "hold" || ball.motion === "dribble";
    return carried ? e : easeOut(clamp01((t - 0.05) / 0.9));
  }

  /** 保持中は持ち主の足もと(丸の外側)、パス・シュート中は出し手→受け手へ */
  private ballAt(prev: Step, cur: Step, pos: Record<PlayerId, Point>, t: number, e: number): Point {
    const owner = cur.ball.owner;
    const carried = cur.ball.motion === "hold" || cur.ball.motion === "dribble";
    if (carried && owner && prev.ball.owner === owner) {
      const d = unit(lerp(this.ballDir(prev.ball, prev, owner), this.ballDir(cur.ball, cur, owner), e));
      return { x: pos[owner].x + d.x * BALL_GAP, y: pos[owner].y + d.y * BALL_GAP };
    }
    const from = this.ballRest(prev);
    const to = this.ballRest(cur);
    return lerp(from, to, this.ballProgress(cur.ball, t, e));
  }

  /** ステップ終了時に表示するボールの位置 */
  private ballRest(step: Step): Point {
    const owner = step.ball.owner;
    if (!owner) return step.ball;
    const d = this.ballDir(step.ball, step, owner);
    const p = step.players[owner];
    return { x: p.x + d.x * BALL_GAP, y: p.y + d.y * BALL_GAP };
  }

  private ballDir(ball: Ball, step: Step, owner: PlayerId): Point {
    const p = step.players[owner];
    const d = unit({ x: ball.x - p.x, y: ball.y - p.y });
    if (d.x || d.y) return d;
    return { x: 0, y: teamOf(owner) === "home" ? -1 : 1 }; // 相手ゴールの方向
  }

  /** ステップの始めに、そのステップで使う足あと・ゴースト・オーバーレイの要素を作る */
  private buildStep(i: number, cur: Step, prev: Step, focus: Set<PlayerId>) {
    this.builtStep = i;
    this.updaters = [];
    for (const layer of [this.trailLayer, this.ghostLayer, this.overlayLayer, this.labelLayer]) layer.replaceChildren();
    this.buildTrails(i, focus);
    this.buildGhosts(i);
    this.buildOverlays(i, cur, prev);
  }

  // ---------- 足あと・ゴースト ----------
  /** 強調している選手の、これまでの動きを薄い線で残す */
  private buildTrails(i: number, focus: Set<PlayerId>) {
    if (this.mini || i === 0) return;
    for (const id of focus) {
      const past = this.variant.steps.slice(0, i).map((s) => s.players[id]);
      const pts = [...past, this.variant.steps[i].players[id]];
      let len = 0;
      for (let k = 1; k < pts.length; k++) len += dist(pts[k - 1], pts[k]);
      if (len < 1.5) continue;
      const line = svg("polyline", { class: `trail ${teamOf(id)}` }, this.trailLayer);
      for (const p of past) svg("circle", { cx: p.x, cy: p.y, r: 0.35, class: `trail-dot ${teamOf(id)}` }, this.trailLayer);
      const fixed = past.map((p) => `${p.x},${p.y}`).join(" ");
      this.updaters.push(({ pos }) => line.setAttribute("points", `${fixed} ${pos[id].x},${pos[id].y}`));
    }
  }

  /** 比較表示: おてほんと大きく違う味方の「本当はここ」を薄い丸で重ねる */
  private buildGhosts(i: number) {
    if (!this.ghost) return;
    const gcur = this.ghost.steps[i];
    const gprev = i > 0 ? this.ghost.steps[i - 1] : gcur;
    for (const id of this.players.keys()) {
      if (teamOf(id) !== "home") continue;
      const group = svg("g", {}, this.ghostLayer);
      const link = svg("line", { class: "ghost-link" }, group);
      const circle = svg("circle", { r: PLAYER_R, class: "ghost" }, group);
      const num = svg("text", { class: "ghost-num", "text-anchor": "middle", "dominant-baseline": "central" }, group);
      num.textContent = id.slice(1);
      this.updaters.push(({ pos, e }) => {
        const g = lerp(gprev.players[id], gcur.players[id], e);
        const p = pos[id];
        const on = dist(g, p) >= GHOST_MIN_DIST;
        show(group, on);
        if (!on) return;
        setAttrs(link, { x1: p.x, y1: p.y, x2: g.x, y2: g.y });
        setAttrs(circle, { cx: g.x, cy: g.y });
        setAttrs(num, { x: g.x, y: g.y });
      });
    }
  }

  // ---------- オーバーレイ ----------
  private buildOverlays(i: number, cur: Step, prev: Step) {
    const layer = this.overlayLayer;
    // 面 → 線 → 矢印 → 吹き出し の順に重ねる
    const order: Overlay["type"][] = ["space", "triangle", "passLane", "arrow", "callout"];
    const sorted = [...cur.overlays].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    for (const o of sorted) {
      switch (o.type) {
        case "space":
          svg("ellipse", { cx: o.x, cy: o.y, rx: o.rx, ry: o.ry, class: "ov-space" }, layer);
          if (o.label && !this.mini) this.label(o.label, o.x, o.y); // スペースは空いている場所なので中心に置く
          break;
        case "triangle": {
          const poly = svg("polygon", { class: "ov-triangle" }, layer);
          this.updaters.push(({ pos }) => poly.setAttribute("points", o.players.map((id) => `${pos[id].x},${pos[id].y}`).join(" ")));
          break;
        }
        case "passLane": {
          const line = svg("line", { class: `ov-lane ${o.state}` }, layer);
          const mark = o.state === "blocked" ? this.label("×", 0, 0, "ov-blocked") : null;
          this.updaters.push(({ pos }) => {
            const a = pos[o.from];
            const b = pos[o.to];
            setAttrs(line, { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
            if (mark) setAttrs(mark, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          });
          break;
        }
        case "arrow":
          if (i > 0) this.drawArrow(o, prev, cur); // 前ステップ → 現ステップの動きなので、ステップ中は変わらない
          break;
        case "callout":
          if (!this.mini) this.buildCallout(o.player, o.text, o.tone);
          break;
      }
    }
  }

  private drawArrow(o: ArrowOverlay, prev: Step, cur: Step) {
    const isBallKind = o.kind === "pass" || o.kind === "shot";
    const from = o.from ?? (isBallKind ? this.ballRest(prev) : prev.players[o.by]);
    const to = o.to ?? (isBallKind ? this.ballRest(cur) : cur.players[o.by]);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.8) return;
    const style: ArrowStyle = o.judgement === "bad"
      ? "bad"
      : o.kind === "run" ? `run-${teamOf(o.by)}`
      : o.kind === "pass" ? `pass-${teamOf(o.by)}`
      : o.kind;
    // 終点は選手の丸の手前で止める(走る矢印は選手の現在位置に向かうため)
    const cut = Math.min(isBallKind ? 0.6 : PLAYER_R + 0.3, len / 3);
    svg("line", {
      x1: from.x,
      y1: from.y,
      x2: to.x - (dx / len) * cut,
      y2: to.y - (dy / len) * cut,
      class: `ov-arrow ${o.kind}${o.judgement === "bad" ? " bad" : ""}`,
      stroke: ARROW_COLORS[style],
      "marker-end": `url(#${this.uid}-${style})`,
    }, this.overlayLayer);
    if (o.judgement === "bad") this.label("×", from.x + dx * 0.5, from.y + dy * 0.5, "ov-bad-mark");
  }

  /** 選手の頭上の吹き出し。選手について動き、ピッチの外にはみ出さないよう位置を調整 */
  private buildCallout(player: PlayerId, text: string, tone: "good" | "bad") {
    const w = [...text].length * 1.75 + 1.6;
    const h = 2.9;
    const g = svg("g", { class: `callout ${tone}` }, this.labelLayer);
    const tip = svg("path", { class: "callout-tip" }, g);
    const bg = svg("rect", { width: w, height: h, rx: 1.2, class: "callout-bg" }, g);
    const t = svg("text", { class: "callout-text", "text-anchor": "middle", "dominant-baseline": "central" }, g);
    t.textContent = `${tone === "good" ? "◎" : "×"} ${text}`;
    this.updaters.push(({ pos }) => {
      const p = pos[player];
      const above = p.y > 6; // 上端の近くでは下に出す
      const cy = above ? p.y - PLAYER_R - 0.9 - h / 2 : p.y + PLAYER_R + 0.9 + h / 2;
      const cx = Math.min(50 - w / 2, Math.max(w / 2, p.x));
      const tipY = above ? cy + h / 2 : cy - h / 2;
      const tipTo = above ? p.y - PLAYER_R - 0.1 : p.y + PLAYER_R + 0.1;
      tip.setAttribute("d", `M${p.x - 0.7},${tipY} L${p.x},${tipTo} L${p.x + 0.7},${tipY} Z`);
      setAttrs(bg, { x: cx - w / 2, y: cy - h / 2 });
      setAttrs(t, { x: cx, y: cy });
    });
  }

  private label(text: string, x: number, y: number, className = "ov-label") {
    const t = svg("text", { x, y, class: className, "text-anchor": "middle", "dominant-baseline": "central" }, this.labelLayer);
    t.textContent = text;
    return t;
  }

  // ---------- ゴールの演出・結末バナー ----------
  /** ボールがゴールに入った瞬間に、ネットの揺れ・波紋・紙ふぶきを出す */
  private drawGoalFx(ball: Point | null) {
    if (this.mini || !!ball === this.goalFx) return;
    this.goalFx = !!ball;
    this.fxLayer.replaceChildren();
    for (const goal of this.goals) goal.classList.remove("scored");
    if (!ball) return;
    const top = ball.y < 34;
    this.goals[top ? 0 : 1].classList.add("scored");
    const y = top ? 0 : 68;
    const out = top ? -1 : 1; // ゴールの外側(ピッチの外)の向き
    for (const delay of [0, 0.25]) {
      const ring = svg("circle", { cx: ball.x, cy: y, r: 1.2, class: "fx-ripple" }, this.fxLayer);
      ring.style.animationDelay = `${delay}s`;
    }
    const colors = ["#ffd400", "#ff8a00", "#ffffff", "#1e5bd8", "#3ec46d"];
    for (let k = 0; k < 16; k++) {
      const angle = (Math.PI * (k + 0.5)) / 16; // ピッチの内側へ半円状に広げる
      const r = 4 + (k % 3) * 1.6;
      const piece = svg("rect", { x: ball.x - 0.35, y: y - 0.2, width: 0.7, height: 0.4, class: "fx-confetti", fill: colors[k % colors.length] }, this.fxLayer);
      piece.style.setProperty("--dx", `${Math.cos(angle) * r}px`);
      piece.style.setProperty("--dy", `${-out * Math.sin(angle) * r}px`);
      piece.style.setProperty("--rot", `${(k % 2 ? 1 : -1) * (180 + k * 25)}deg`);
      piece.style.animationDelay = `${(k % 4) * 0.04}s`;
    }
  }

  /**
   * 結末バナー。選手・ボール・ボールから攻めるゴールまでのコース(決着点)をなるべく隠さない高さに出す。
   * ゴールが決まったときは、ボールが入る瞬間を見せてから少し遅れて出す。
   */
  private drawBanner(visible: boolean, pos: Record<PlayerId, Point>, ball: Point, owner: PlayerId | null, focus: Set<PlayerId>, delayed: boolean) {
    const layer = this.bannerLayer;
    if (!visible || this.mini) {
      layer.replaceChildren();
      return;
    }
    if (layer.childElementCount) return;
    const good = this.key === "good";
    const top = this.bannerTop(pos, ball, owner, focus);
    layer.classList.toggle("delayed", delayed);
    svg("rect", { x: BANNER.x, y: top, width: BANNER.w, height: BANNER.h, rx: 2.2, class: `banner-bg ${this.key}` }, layer);
    const sub = svg("text", { x: 25, y: top + 2.5, class: "banner-sub", "text-anchor": "middle", "dominant-baseline": "central" }, layer);
    sub.textContent = good ? "◎ チャンス!" : "× ピンチ!";
    const text = this.variant.outcomeBanner;
    const main = svg("text", { x: 25, y: top + 6.3, class: "banner-main", "text-anchor": "middle", "dominant-baseline": "central" }, layer);
    main.style.fontSize = String(Math.min(3.6, 38 / [...text].length));
    main.textContent = text;
  }

  /** バナーの上端 Y。隠してしまう量が最も少ない高さを選び、同じならボールから遠い方にする */
  private bannerTop(pos: Record<PlayerId, Point>, ball: Point, owner: PlayerId | null, focus: Set<PlayerId>) {
    const obstacles: { p: Point; r: number; w: number }[] = [];
    for (const [id, p] of Object.entries(pos)) obstacles.push({ p, r: PLAYER_R + 0.3, w: focus.has(id) ? 3 : 1 });
    obstacles.push({ p: ball, r: BALL_R + 0.3, w: 3 });
    if (owner) {
      // ボールを持っている選手が攻めるゴールまでのコース(ここで勝負が決まる)
      const goal = { x: 25, y: teamOf(owner) === "home" ? 0 : 68 };
      const n = Math.ceil(dist(ball, goal) / 2);
      for (let k = 1; k <= n; k++) obstacles.push({ p: lerp(ball, goal, k / n), r: 1.5, w: 2 });
    }
    let best = { top: 0.5, cost: Infinity, far: -1 };
    for (let top = 0.5; top <= 68 - BANNER.h - 0.5; top += 0.25) {
      let cost = 0;
      for (const { p, r, w } of obstacles) {
        const dx = Math.max(BANNER.x - p.x, 0, p.x - (BANNER.x + BANNER.w));
        const dy = Math.max(top - p.y, 0, p.y - (top + BANNER.h));
        cost += Math.max(0, r - Math.hypot(dx, dy)) * w;
      }
      const far = Math.abs(top + BANNER.h / 2 - ball.y);
      if (cost < best.cost - 1e-6 || (cost < best.cost + 1e-6 && far > best.far)) best = { top, cost, far };
    }
    return best.top;
  }

  private defineDefs() {
    const defs = svg("defs", {}, this.svgEl);
    for (const [name, color] of Object.entries(ARROW_COLORS)) {
      const big = name === "shot" || name.startsWith("pass");
      const m = svg("marker", {
        id: `${this.uid}-${name}`,
        viewBox: "0 0 10 10",
        refX: 5,
        refY: 5,
        markerWidth: big ? 3.4 : 3,
        markerHeight: big ? 3.4 : 3,
        orient: "auto-start-reverse",
      }, defs);
      svg("path", { d: "M0,0 L10,5 L0,10 z", fill: color }, m);
    }
    // ゴールネットの模様
    const net = svg("pattern", { id: `${this.uid}-net`, width: 0.7, height: 0.7, patternUnits: "userSpaceOnUse" }, defs);
    svg("rect", { width: 0.7, height: 0.7, fill: "#fff" }, net);
    svg("path", { d: "M0,0 L0.7,0.7 M0.7,0 L0,0.7", stroke: "#b9c4b9", "stroke-width": 0.08 }, net);
  }
}
