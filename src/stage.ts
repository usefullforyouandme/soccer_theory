// 1パターン(おてほん/ミス)分のピッチ描画とアニメーション
import type { Overlay, PlayerId, Point, Scenario, Step, Variant, VariantKey } from "./types";

const NS = "http://www.w3.org/2000/svg";
const PLAYER_R = 1.5;
const BALL_R = 0.75;
let stageSeq = 0;

type Attrs = Record<string, string | number>;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
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

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** ピッチのライン(8人制: 50m × 68m) */
function drawField(g: SVGGElement) {
  for (let i = 0; i < 10; i++) {
    svg("rect", { x: 0, y: i * 6.8, width: 50, height: 6.8, class: i % 2 ? "turf-b" : "turf-a" }, g);
  }
  const line = { class: "line" };
  svg("rect", { x: 0, y: 0, width: 50, height: 68, ...line }, g);
  svg("line", { x1: 0, y1: 34, x2: 50, y2: 34, ...line }, g);
  svg("circle", { cx: 25, cy: 34, r: 7, ...line }, g);
  svg("circle", { cx: 25, cy: 34, r: 0.3, class: "spot" }, g);
  for (const [y0, dir] of [[0, 1], [68, -1]] as const) {
    const pa = dir === 1 ? 0 : 56;
    const ga = dir === 1 ? 0 : 64;
    svg("rect", { x: 13, y: pa, width: 24, height: 12, ...line }, g);
    svg("rect", { x: 18.5, y: ga, width: 13, height: 4, ...line }, g);
    svg("circle", { cx: 25, cy: y0 + dir * 8, r: 0.3, class: "spot" }, g);
    svg("rect", { x: 22.5, y: dir === 1 ? -1.4 : 68, width: 5, height: 1.4, class: "goal" }, g);
  }
}

export class Stage {
  readonly el: HTMLElement;
  private readonly variant: Variant;
  private readonly svgEl: SVGSVGElement;
  private readonly overlayLayer: SVGGElement;
  private readonly labelLayer: SVGGElement;
  private readonly bannerLayer: SVGGElement;
  private readonly players = new Map<PlayerId, { g: SVGGElement; ring: SVGCircleElement }>();
  private readonly ballShadow: SVGEllipseElement;
  private readonly ball: SVGCircleElement;
  private readonly captionTitle: HTMLElement;
  private readonly captionText: HTMLElement;
  private readonly uid = `st${++stageSeq}`;

  constructor(scenario: Scenario, readonly key: VariantKey, opts: { mini?: boolean } = {}) {
    this.variant = scenario.variants[key];
    this.el = html("section", `stage stage-${key}${opts.mini ? " stage-mini" : ""}`);

    if (!opts.mini) {
      const label = html("h2", "stage-label", this.el);
      label.textContent = `${key === "good" ? "◎" : "×"} ${this.variant.label}`;
    }

    this.svgEl = svg("svg", { viewBox: "-2.5 -2.5 55 73", class: "pitch", role: "img" });
    this.svgEl.setAttribute("aria-label", `${scenario.title}(${this.variant.label})`);
    this.el.appendChild(this.svgEl);
    this.defineMarkers();

    drawField(svg("g", {}, this.svgEl));
    this.overlayLayer = svg("g", { class: "overlays" }, this.svgEl);
    const playerLayer = svg("g", { class: "players" }, this.svgEl);
    for (const side of ["home", "away"] as const) {
      for (const p of scenario.teams[side].players) {
        const g = svg("g", { class: `player ${side}${p.role === "GK" ? " gk" : ""}` }, playerLayer);
        const ring = svg("circle", { r: PLAYER_R + 0.8, class: "focus-ring" }, g);
        svg("circle", { r: PLAYER_R, class: "body" }, g);
        const num = svg("text", { class: "num", "text-anchor": "middle", "dominant-baseline": "central" }, g);
        num.textContent = String(p.number);
        this.players.set(p.id, { g, ring });
      }
    }
    const ballLayer = svg("g", { class: "ball-layer" }, this.svgEl);
    this.ballShadow = svg("ellipse", { rx: BALL_R, ry: BALL_R * 0.5, class: "ball-shadow" }, ballLayer);
    this.ball = svg("circle", { r: BALL_R, class: "ball" }, ballLayer);
    this.labelLayer = svg("g", { class: "labels" }, this.svgEl); // ラベルは選手より手前に描く
    this.bannerLayer = svg("g", { class: "banner" }, this.svgEl);

    const caption = html("div", "caption", opts.mini ? undefined : this.el);
    this.captionTitle = html("p", "caption-title", caption);
    this.captionText = html("p", "caption-text", caption);
    this.captionText.setAttribute("aria-live", "polite");
  }

  /** ステップ i の終了状態を即座に表示 */
  show(i: number) {
    this.setCaption(i);
    this.render(i, 1);
  }

  /** ステップ i-1 → i へアニメーション。cancelled() が true になったら途中で終了 */
  animate(i: number, speed: number, cancelled: () => boolean): Promise<void> {
    this.setCaption(i);
    const duration = prefersReducedMotion() ? 0 : this.variant.steps[i].durationMs / speed;
    if (i === 0 || duration === 0) {
      this.render(i, 1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled()) return resolve();
        const t = clamp01((now - start) / duration);
        this.render(i, t);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  private setCaption(i: number) {
    const step = this.variant.steps[i];
    this.captionTitle.textContent = `${i + 1}. ${step.title}`;
    this.captionText.textContent = step.explanation;
  }

  private render(i: number, t: number) {
    const cur = this.variant.steps[i];
    const prev = i > 0 ? this.variant.steps[i - 1] : cur;
    const e = easeInOut(t);

    const pos: Record<PlayerId, Point> = {};
    for (const [id, { g }] of this.players) {
      const p = lerp(prev.players[id], cur.players[id], e);
      pos[id] = p;
      g.setAttribute("transform", `translate(${p.x} ${p.y})`);
    }

    // ボール: 保持・ドリブルは選手と同じ動き、パス・シュートは少し遅れて出て減速しながら届く
    const carried = cur.ball.motion === "hold" || cur.ball.motion === "dribble";
    const tb = carried ? e : easeOut(clamp01((t - 0.05) / 0.9));
    const b = lerp(prev.ball, cur.ball, tb);
    const lift = cur.ball.motion === "air" ? Math.sin(Math.PI * tb) : 0;
    this.ballShadow.setAttribute("cx", String(b.x + lift * 0.6));
    this.ballShadow.setAttribute("cy", String(b.y + lift * 0.9));
    this.ballShadow.style.opacity = String(0.35 * (1 - lift * 0.5));
    this.ball.setAttribute("cx", String(b.x));
    this.ball.setAttribute("cy", String(b.y));
    this.ball.setAttribute("r", String(BALL_R * (1 + lift * 0.8)));

    const focus = new Set(cur.overlays.flatMap((o) => (o.type === "arrow" ? [o.by] : [])));
    for (const [id, { ring }] of this.players) ring.classList.toggle("on", focus.has(id));

    this.drawOverlays(cur, pos, i === 0 ? 1 : clamp01(t / 0.2));
    this.drawBanner(i === this.variant.steps.length - 1 && t >= 1, cur.ball.y);
  }

  private drawOverlays(step: Step, pos: Record<PlayerId, Point>, opacity: number) {
    const layer = this.overlayLayer;
    layer.replaceChildren();
    this.labelLayer.replaceChildren();
    layer.style.opacity = String(opacity);
    this.labelLayer.style.opacity = String(opacity);
    // 面 → 線 → 矢印 の順に重ねる
    const order: Overlay["type"][] = ["space", "triangle", "passLane", "arrow"];
    const sorted = [...step.overlays].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    for (const o of sorted) {
      switch (o.type) {
        case "space": {
          svg("ellipse", { cx: o.x, cy: o.y, rx: o.rx, ry: o.ry, class: "ov-space" }, layer);
          if (o.label) this.label(o.label, o.x, o.y); // スペースは空いている場所なので中心に置けば選手と重なりにくい
          break;
        }
        case "triangle": {
          const pts = o.players.map((id) => `${pos[id].x},${pos[id].y}`).join(" ");
          svg("polygon", { points: pts, class: "ov-triangle" }, layer);
          break;
        }
        case "passLane": {
          const a = pos[o.from];
          const b = pos[o.to];
          svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `ov-lane ${o.state}` }, layer);
          if (o.state === "blocked") this.label("×", (a.x + b.x) / 2, (a.y + b.y) / 2, "ov-blocked");
          break;
        }
        case "arrow": {
          const team = o.by.startsWith("h") ? "home" : "away";
          const dx = o.to.x - o.from.x;
          const dy = o.to.y - o.from.y;
          const len = Math.hypot(dx, dy) || 1;
          const cut = Math.min(0.9, len / 3); // 矢じりが終点に重なりすぎないよう少し手前で止める
          svg("line", {
            x1: o.from.x,
            y1: o.from.y,
            x2: o.to.x - (dx / len) * cut,
            y2: o.to.y - (dy / len) * cut,
            class: `ov-arrow ${o.kind} ${team}`,
            "marker-end": `url(#${this.uid}-${team})`,
          }, layer);
          break;
        }
      }
    }
  }

  private label(text: string, x: number, y: number, className = "ov-label") {
    const t = svg("text", { x, y, class: className, "text-anchor": "middle", "dominant-baseline": "central" }, this.labelLayer);
    t.textContent = text;
  }

  /** 結末バナー。ボールのある側(プレーの決着点)を隠さないよう反対側に出す */
  private drawBanner(visible: boolean, ballY: number) {
    const layer = this.bannerLayer;
    if (!visible) {
      layer.replaceChildren();
      return;
    }
    if (layer.childElementCount) return;
    const good = this.key === "good";
    const top = ballY < 34 ? 40 : 4;
    svg("rect", { x: 3, y: top, width: 44, height: 13, rx: 2.5, class: `banner-bg ${this.key}` }, layer);
    const sub = svg("text", { x: 25, y: top + 3.4, class: "banner-sub", "text-anchor": "middle", "dominant-baseline": "central" }, layer);
    sub.textContent = good ? "◎ チャンス!" : "× ピンチ!";
    const text = this.variant.outcomeBanner;
    const main = svg("text", { x: 25, y: top + 8.6, class: "banner-main", "text-anchor": "middle", "dominant-baseline": "central" }, layer);
    main.style.fontSize = String(Math.min(4, 40 / text.length));
    main.textContent = text;
  }

  private defineMarkers() {
    const defs = svg("defs", {}, this.svgEl);
    for (const team of ["home", "away"]) {
      const m = svg("marker", {
        id: `${this.uid}-${team}`,
        viewBox: "0 0 10 10",
        refX: 5,
        refY: 5,
        markerWidth: 3.2,
        markerHeight: 3.2,
        orient: "auto-start-reverse",
      }, defs);
      svg("path", { d: "M0,0 L10,5 L0,10 z", class: `marker ${team}` }, m);
    }
  }
}
