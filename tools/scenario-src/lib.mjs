// シナリオ JSON の生成ヘルパー(座標表 → v2 スキーマの JSON)
import { writeFileSync } from "node:fs";

export const ORDER = ["h1", "h2", "h4", "h3", "h6", "h7", "h8", "h9", "a1", "a3", "a4", "a2", "a8", "a6", "a7", "a9"];
const PH = ["initial", "movement", "firstPlay", "nextPlay", "outcome"];
export const pt = (s) => {
  const [x, y] = s.split(",").map(Number);
  return { x, y };
};

/** "h1 25,56 25,54 ..." 形式の表 → 5ステップ分の players */
export function players(table) {
  const rows = Object.fromEntries(
    table.trim().split("\n").map((l) => {
      const [id, ...c] = l.trim().split(/\s+/);
      if (c.length !== 5) throw new Error(`${id}: 5列ではありません (${c.length})`);
      return [id, c];
    }),
  );
  for (const id of ORDER) if (!rows[id]) throw new Error(`${id} の行がありません`);
  return [0, 1, 2, 3, 4].map((i) => Object.fromEntries(ORDER.map((id) => [id, pt(rows[id][i])])));
}

const roster = (side) => {
  const p = side === "home" ? "h" : "a";
  return [["GK", 1], ["LB", 2], ["CB", 4], ["RB", 3], ["CM", 6], ["LM", 7], ["RM", 8], ["FW", 9]].map(([role, n]) => ({ id: `${p}${n}`, number: n, role }));
};

export const arrow = (kind, by, extra = {}) => ({ type: "arrow", kind, by, ...extra });
export const space = (c, rx, ry, label) => ({ type: "space", ...pt(c), rx, ry, ...(label ? { label } : {}) });
export const callout = (player, text, tone) => ({ type: "callout", player, text, tone });
export const lane = (from, to, state = "open") => ({ type: "passLane", from, to, state });
export const tri = (...p) => ({ type: "triangle", players: p });
export const offsideLine = (defending = "away") => ({ type: "offsideLine", defending });
export const ball = (c, owner, motion, extra = {}) => ({ ...pt(c), owner, motion, ...extra });

function variant(v) {
  const ps = players(v.table);
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
      overlays: st.ov ?? [],
    })),
  };
}

export function build(def, outDir) {
  const good = variant({ label: "お手本", tone: "chance", ...def.good });
  const bad = variant({ label: "よくあるミス", ...def.bad, steps: def.bad.steps.map((st, i) => st ?? def.good.steps[i]) });
  // Step 1 は good / bad 共通にする
  bad.steps[0] = { ...good.steps[0], players: good.steps[0].players };
  const scenario = {
    schemaVersion: 2,
    id: def.id,
    title: def.title,
    category: def.category,
    group: def.group,
    pattern: def.pattern,
    theme: def.theme,
    coachNote: def.coachNote,
    coachCue: def.coachCue,
    drills: def.drills,
    targetGrade: "middle",
    question: def.question,
    keyPoint: def.keyPoint,
    teams: {
      home: { name: "味方", formation: "3-3-1", players: roster("home") },
      away: { name: "相手", formation: "3-3-1", players: roster("away") },
    },
    variants: { good, bad },
  };
  const json = JSON.stringify(scenario, null, 2)
    .replace(/\{\n\s+("x": [^,]+),\n\s+("y": [^\n]+)\n\s+\}/g, "{ $1, $2 }")
    .replace(/\[\n\s+("[ah]\d+"),\n\s+("[ah]\d+"),\n\s+("[ah]\d+")\n\s+\]/g, "[$1, $2, $3]")
    .replace(/\[\n\s+("[ah]\d+"),\n\s+("[ah]\d+")\n\s+\]/g, "[$1, $2]")
    .replace(/\[\n\s+("[ah]\d+")\n\s+\]/g, "[$1]");
  writeFileSync(`${outDir}/${def.id}.json`, json + "\n");
}
