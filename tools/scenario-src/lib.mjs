// シナリオ JSON の生成ヘルパー(座標表 → v2 スキーマの JSON)
import { writeFileSync } from "node:fs";
import { GROUPS } from "./groups.mjs";

// フォーメーションごとの選手(役割, 背番号)。表の行の順番もこの順
const ROSTERS = {
  "3-3-1": [["GK", 1], ["LB", 2], ["CB", 4], ["RB", 3], ["CM", 6], ["LM", 7], ["RM", 8], ["FW", 9]],
  // 2-3-2: DF 2人(2・3)、MF 3人(7・6・8)、FW 2人(9・10)
  "2-3-2": [["GK", 1], ["LB", 2], ["RB", 3], ["CM", 6], ["LM", 7], ["RM", 8], ["FW", 9], ["FW", 10]],
};
const orderOf = (home = "3-3-1", away = "3-3-1") => [
  ...ROSTERS[home].map(([, n]) => `h${n}`),
  ...["a1", "a3", "a4", "a2", "a8", "a6", "a7", "a9"].filter((id) => ROSTERS[away].some(([, n]) => `a${n}` === id)),
];
export const ORDER = orderOf();
const PH = ["initial", "movement", "firstPlay", "nextPlay", "outcome"];
export const pt = (s) => {
  const [x, y] = s.split(",").map(Number);
  return { x, y };
};

/** "h1 25,56 25,54 ..." 形式の表 → 5ステップ分の players */
export function players(table, order = ORDER) {
  const rows = Object.fromEntries(
    table.trim().split("\n").map((l) => {
      const [id, ...c] = l.trim().split(/\s+/);
      if (c.length !== 5) throw new Error(`${id}: 5列ではありません (${c.length})`);
      return [id, c];
    }),
  );
  for (const id of order) if (!rows[id]) throw new Error(`${id} の行がありません`);
  for (const id of Object.keys(rows)) if (!order.includes(id)) throw new Error(`${id} はこのフォーメーションにいません`);
  return [0, 1, 2, 3, 4].map((i) => Object.fromEntries(order.map((id) => [id, pt(rows[id][i])])));
}

const roster = (side, formation = "3-3-1") => {
  const p = side === "home" ? "h" : "a";
  return ROSTERS[formation].map(([role, n]) => ({ id: `${p}${n}`, number: n, role }));
};

export const arrow = (kind, by, extra = {}) => ({ type: "arrow", kind, by, ...extra });
export const space = (c, rx, ry, label) => ({ type: "space", ...pt(c), rx, ry, ...(label ? { label } : {}) });
export const callout = (player, text, tone) => ({ type: "callout", player, text, tone });
export const lane = (from, to, state = "open") => ({ type: "passLane", from, to, state });
export const tri = (...p) => ({ type: "triangle", players: p });
export const offsideLine = (defending = "away") => ({ type: "offsideLine", defending });
export const look = (player, at, judgement) => ({ type: "look", player, at: typeof at === "string" && at.includes(",") ? pt(at) : at, ...(judgement ? { judgement } : {}) });
export const shotCone = (from, goal, extra = {}) => ({ type: "shotCone", from, goal, ...extra });
export const ball = (c, owner, motion, extra = {}) => ({ ...pt(c), owner, motion, ...extra });
// 練習メニュー用: コーン・門・足の使い方
export const cone = (c) => ({ type: "cone", ...pt(c) });
export const gate = (a, b, label) => ({ type: "gate", a: pt(a), b: pt(b), ...(label ? { label } : {}) });
/** ladder("2,8", "2,3", 10) = 入り口 → 出口に 10 マス。幅は width(m。省略時 0.5) */
export const ladder = (a, b, rungs, width) => ({ type: "ladder", a: pt(a), b: pt(b), rungs, ...(width ? { width } : {}) });
/** 足を着いた所。steps("L 1.9,7.7  R 2.1,7.7", { judgement: "bad" }) のように、L/R と座標を並べて書く(@角度 でつま先の向き。例: R 2.1,7.7@90) */
export const steps = (spec, extra = {}) => spec.trim().split(/\s+(?=[LR]\s)/).map((tok) => {
  const [lr, c] = tok.trim().split(/\s+/);
  const [xy, turn] = c.split("@");
  return { type: "step", ...pt(xy), foot: lr === "L" ? "left" : "right", ...(turn ? { turn: Number(turn) } : {}), ...extra };
});
/** foot("h7", "inside", { kick: "left", plant: 20, toward: "h8" | "3,4", judgement: "bad" })。kick の省略時は右足 */
export const foot = (player, surface, { kick = "right", toward, ...extra } = {}) => ({
  player, kick, surface, ...extra, ...(toward ? { toward: typeof toward === "string" && toward.includes(",") ? pt(toward) : toward } : {}),
});

/** props(コーン・門)は、全ステップの overlays の先頭に入れる(置いたままの道具なので) */
function variant(v, order, props = []) {
  const ps = players(v.table, order);
  return {
    label: v.label,
    outcomeBanner: v.banner,
    ...(v.tone ? { outcomeTone: v.tone } : {}),
    steps: v.steps.map((st, i) => ({
      phase: PH[i],
      title: st.title,
      explanation: st.text,
      durationMs: st.ms,
      ...(st.focus ? { focus: st.focus } : {}),
      players: ps[i],
      ball: st.ball,
      overlays: [...props, ...(st.ov ?? [])],
      ...(st.foot ? { foot: st.foot } : {}),
    })),
  };
}

export function build(def, outDir) {
  const meta = GROUPS[def.group];
  if (!meta) throw new Error(`${def.id}: group "${def.group}" が groups.mjs にありません`);
  const formation = def.formation ?? "3-3-1";
  const order = orderOf(formation);
  const good = variant({ label: "お手本", tone: "chance", ...def.good }, order);
  const bad = variant({ label: "よくあるミス", ...def.bad, steps: def.bad.steps.map((st, i) => st ?? def.good.steps[i]) }, order);
  // Step 1 は good / bad 共通にする
  bad.steps[0] = { ...good.steps[0], players: good.steps[0].players };
  const scenario = {
    schemaVersion: 2,
    id: def.id,
    title: def.title,
    questionTitle: meta.questionTitle,
    category: def.category,
    group: def.group,
    keyword: meta.keyword,
    courseOrder: meta.courseOrder,
    pattern: def.pattern,
    theme: def.theme,
    coachNote: def.coachNote,
    coachCue: def.coachCue,
    drills: meta.drills,
    targetGrade: "middle",
    question: def.question,
    keyPoint: def.keyPoint,
    choices: def.choices,
    ruleNote: meta.ruleNote,
    counterpart: def.counterpart,
    next: def.next,
    teams: {
      home: { name: "味方", formation, players: roster("home", formation) },
      away: { name: "相手", formation: "3-3-1", players: roster("away") },
    },
    variants: { good, bad },
  };
  write(scenario, outDir);
}

/**
 * 練習メニュー(kind: drill)。座標は area(幅 w × 奥行き h m)の中で、Y=0 が画面の上。
 * home / away は { name, players: [["h7", "CM"], ...] }(出てくる人だけ)。表の行も同じ人だけ書く。
 * props(cone / gate)は全ステップに入る。よくあるミスの結末は miss(△ 残念…)
 */
export function buildDrill(def, outDir) {
  const meta = GROUPS[def.group];
  if (!meta) throw new Error(`${def.id}: group "${def.group}" が groups.mjs にありません`);
  const team = (t = { name: "コーチ", players: [] }) => ({
    name: t.name,
    formation: "0-0",
    players: t.players.map(([id, role]) => ({ id, number: Number(id.slice(1)), role })),
  });
  const teams = { home: team(def.home), away: team(def.away) };
  const order = [...teams.home.players, ...teams.away.players].map((p) => p.id);
  const props = def.props ?? [];
  const good = variant({ label: "お手本", tone: "chance", ...def.good }, order, props);
  const bad = variant({ label: "よくあるミス", tone: "miss", ...def.bad, steps: def.bad.steps.map((st, i) => st ?? def.good.steps[i]) }, order, props);
  bad.steps[0] = { ...good.steps[0], players: good.steps[0].players };
  write({
    schemaVersion: 2,
    kind: "drill",
    id: def.id,
    title: def.title,
    questionTitle: meta.questionTitle,
    category: def.category,
    group: def.group,
    pattern: def.pattern,
    theme: def.theme,
    coachNote: def.coachNote,
    coachCue: def.coachCue,
    targetGrade: "middle",
    question: def.question,
    keyPoint: def.keyPoint,
    choices: def.choices,
    next: def.next,
    area: def.area,
    practice: def.practice,
    match: def.match,
    teams,
    variants: { good, bad },
  }, outDir);
}

function write(scenario, outDir) {
  const json = JSON.stringify(scenario, null, 2)
    .replace(/\{\n\s+("x": [^,]+),\n\s+("y": [^\n]+)\n\s+\}/g, "{ $1, $2 }")
    .replace(/\[\n\s+("[ah]\d+"),\n\s+("[ah]\d+"),\n\s+("[ah]\d+")\n\s+\]/g, "[$1, $2, $3]")
    .replace(/\[\n\s+("[ah]\d+"),\n\s+("[ah]\d+")\n\s+\]/g, "[$1, $2]")
    .replace(/\[\n\s+("[ah]\d+")\n\s+\]/g, "[$1]");
  writeFileSync(`${outDir}/${scenario.id}.json`, json + "\n");
}
