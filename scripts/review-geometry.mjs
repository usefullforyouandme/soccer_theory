// お手本(good)の幾何チェック。シナリオ JSON を読んで、座標から「お手本として不自然な所」を警告する。
//   node scripts/review-geometry.mjs            全シナリオの警告だけを一覧
//   node scripts/review-geometry.mjs <id> ...    id を含むシナリオの全ステップを展開(座標・動き・オーバーレイ・警告)
// 警告は「人が見て判断する材料」で、validate.mjs のようなエラーではない。基準は docs/MODEL_ANSWER_REVIEW.md 2 章。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "scenarios");
const only = process.argv.slice(2);
const verbose = only.length > 0;
const GOAL_X = [22.5, 27.5];

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segDist = (p, a, b) => {
  const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy;
  let t = L2 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return d(p, { x: a.x + t * vx, y: a.y + t * vy });
};
const angleAt = (b, a, c) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
};
// 点 p が、from からゴール(goalY 側)への三角形(シュートコース)の中にあるか
const inCone = (p, from, goalY) => {
  const t = (p.y - from.y) / (goalY - from.y);
  if (t <= 0 || t >= 1) return false;
  const xl = from.x + (GOAL_X[0] - from.x) * t, xr = from.x + (GOAL_X[1] - from.x) * t;
  return p.x >= Math.min(xl, xr) && p.x <= Math.max(xl, xr);
};
const f = (p) => `${p.x},${p.y}`;

for (const file of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  const s = JSON.parse(readFileSync(join(dir, file), "utf8"));
  if (only.length && !only.some((o) => s.id.includes(o))) continue;
  const g = s.variants.good;
  const lines = [];
  if (verbose) lines.push(`\n==== ${s.id} | ${s.title} / ${s.pattern} | ${s.category} | home ${s.teams.home.formation}`, `Q: ${s.question}`, `KP: ${s.keyPoint}`);
  let prev = null;
  g.steps.forEach((st, i) => {
    const P = st.players, warn = [];
    const home = Object.keys(P).filter((k) => k[0] === "h"), away = Object.keys(P).filter((k) => k[0] === "a");
    if (verbose) {
      lines.push(`-- S${i + 1} ${st.title} | ball ${f(st.ball)} ${st.ball.owner} ${st.ball.motion} | ${st.durationMs}ms`, `   ${st.explanation}`,
        `   H: ${home.map((k) => `${k.slice(1)}:${f(P[k])}`).join(" ")}`, `   A: ${away.map((k) => `${k.slice(1)}:${f(P[k])}`).join(" ")}`);
    }
    if (prev) {
      const mv = Object.keys(P).filter((k) => d(P[k], prev.players[k]) >= 3).map((k) => `${k}(${f(prev.players[k])}→${f(P[k])})`);
      if (verbose && mv.length) lines.push(`   move≥3m: ${mv.join(" ")}`);
      // 味方のパス: 経路の近くに相手がいないか(開始時・終了時の両方の座標で見る)
      if (["ground", "lofted"].includes(st.ball.motion) && st.ball.owner?.[0] === "h" && prev.ball.owner?.[0] === "h") {
        const from = prev.ball, to = st.ball;
        for (const [label, PP] of [["開始時", prev.players], ["終了時", P]]) {
          const near = away.filter((k) => segDist(PP[k], from, to) < 1.5 && d(PP[k], to) > 1.5 && d(PP[k], from) > 1.5)
            .map((k) => `${k}(${segDist(PP[k], from, to).toFixed(1)}m)`);
          if (near.length) warn.push(`パス経路に相手(${label}): ${near.join(",")}`);
        }
        const marks = away.filter((k) => d(P[k], P[st.ball.owner]) < 1.8);
        if (marks.length) warn.push(`受け手 ${st.ball.owner} に相手が密着: ${marks.join(",")}`);
        if (st.ball.motion === "ground" && d(from, to) > 20 && prev.ball.owner !== "h1") warn.push(`ゴロのパスが長い ${d(from, to).toFixed(0)}m`);
      }
    }
    const ov = st.overlays ?? [];
    if (verbose) {
      const sum = ov.map((o) => {
        if (o.type === "arrow") return `arrow:${o.kind}:${o.by}`;
        if (o.type === "passLane") return `lane:${o.from}→${o.to}:${o.state}`;
        if (o.type === "triangle") return `tri:${o.players.join("-")}`;
        if (o.type === "callout") return `say:${o.player}"${o.text}"(${o.tone})`;
        if (o.type === "space") return `space:${o.x},${o.y}${o.label ? `"${o.label}"` : ""}`;
        if (o.type === "look") return `look:${o.player}→${typeof o.at === "string" ? o.at : f(o.at)}${o.judgement ? ":" + o.judgement : ""}`;
        if (o.type === "shotCone") return `cone:${o.from}`;
        return o.type;
      });
      if (sum.length) lines.push(`   OV: ${sum.join(" ")}`);
    }
    for (const o of ov) {
      if (o.type === "triangle") {
        const [a, b, c] = o.players.map((k) => P[k]);
        const angs = [angleAt(a, b, c), angleAt(b, a, c), angleAt(c, a, b)];
        if (Math.min(...angs) < 25) warn.push(`三角形 ${o.players.join("-")} がつぶれている(各角 ${angs.map((x) => x.toFixed(0)).join("/")}°)`);
      }
      if (o.type === "passLane") {
        const a = P[o.from], b = P[o.to];
        const blockers = Object.keys(P).filter((k) => k !== o.from && k !== o.to && k[0] !== o.from[0] && segDist(P[k], a, b) < 1.5);
        if (o.state === "open" && blockers.length) warn.push(`open レーン ${o.from}→${o.to} の線上に相手 ${blockers.join(",")}`);
        if (o.state === "blocked" && !blockers.length) warn.push(`blocked レーン ${o.from}→${o.to} の線上(1.5m 以内)にだれもいない`);
        if (o.state === "open") {
          for (const k of Object.keys(P)) {
            if (k === o.from || k === o.to || k[0] !== o.from[0]) continue;
            if (d(P[k], b) < 12 && angleAt(b, a, P[k]) > 150) warn.push(`受け手 ${o.to} が ${o.from}-${k} の直線上(角 ${angleAt(b, a, P[k]).toFixed(0)}°)`);
          }
        }
      }
      if (o.type === "shotCone") {
        // 味方のシュートコース(相手ゴール Y=0)に相手がいるか(GK は除く)。相手のコース(自ゴール Y=68)は味方がふさいでいるか
        const from = o.from === "ball" ? st.ball : P[o.from];
        if (o.from !== "ball" && o.from[0] === "h") {
          const inside = away.filter((k) => k !== "a1" && inCone(P[k], from, 0));
          if (inside.length) warn.push(`${o.from} のシュートコースに相手 ${inside.join(",")}`);
        } else if (o.from === "ball" && st.ball.owner?.[0] === "a") {
          const inside = home.filter((k) => k !== "h1" && inCone(P[k], from, 68));
          const near = home.filter((k) => k !== "h1" && d(P[k], from) < 8);
          if (!inside.length && near.length && /ふさ|間に立/.test(st.explanation)) warn.push(`相手のシュートコースをふさいでいる味方がいない(近くにいるのは ${near.join(",")})`);
        }
      }
    }
    // 文章で「フリー・空いている」と言っている味方の最寄りの相手。
    // 対象は、キーワードと同じ文でその直前に出てくる味方(「{a3}が{h7}を止めに来た。{h9}はフリー」なら h9 だけ)。
    // 同じ文に味方が出てこなければ、ボールを持っている味方(「{h7}から{h9}へ。…だれもいない」なら h9)。
    const FREE = /フリー|だれもいない|空いている|空いてる|ガラガラ/;
    if (FREE.test(st.explanation)) {
      const targets = new Set();
      for (const sent of st.explanation.split(/(?<=[。!?])/)) {
        const k = sent.search(FREE);
        if (k < 0) continue;
        const hs = [...sent.slice(0, k).matchAll(/\{(h\d+)\}/g)].map((m) => m[1]);
        const h = hs.length ? hs[hs.length - 1] : st.ball.owner?.[0] === "h" ? st.ball.owner : null;
        if (h) targets.add(h);
      }
      for (const h of targets) {
        const n = away.filter((a) => a !== "a1").map((a) => [a, d(P[h], P[a])]).sort((x, y) => x[1] - y[1])[0];
        if (n[1] < 3) warn.push(`「空いている」${h} の ${n[1].toFixed(1)}m に相手 ${n[0]}`);
      }
    }
    if (warn.length) lines.push(`${verbose ? "   !!" : `${s.id} S${i + 1}:`} ${warn.join(" / ")}`);
    prev = st;
  });
  if (lines.length) console.log(lines.join("\n"));
}
