// 左サイドのシナリオ(side-attack-box-entry)を左右反転して「右サイドから」を作る
import { readFileSync, writeFileSync } from "node:fs";
const OUT = process.argv[2];
const src = JSON.parse(readFileSync(`${OUT}/side-attack-box-entry.json`, "utf8"));
const SWAP = { h7: "h8", h8: "h7", h2: "h3", h3: "h2", a7: "a8", a8: "a7", a2: "a3", a3: "a2" };
const sw = (id) => SWAP[id] ?? id;
const mx = (p) => ({ ...p, x: Math.round((50 - p.x) * 10) / 10 });

function mirrorStep(st) {
  const players = {};
  for (const [id, p] of Object.entries(st.players)) players[sw(id)] = mx(p);
  const order = Object.keys(st.players).map(sw);
  const sorted = Object.fromEntries(Object.keys(st.players).map((id) => [id, players[id]]));
  const overlays = st.overlays.map((o) => {
    const c = { ...o };
    for (const k of ["by", "player", "from", "to"]) if (typeof c[k] === "string") c[k] = sw(c[k]);
    for (const k of ["from", "to"]) if (c[k] && typeof c[k] === "object") c[k] = mx(c[k]);
    if (c.players) c.players = c.players.map(sw);
    if (c.type === "space") Object.assign(c, mx(c));
    return c;
  });
  void order;
  return {
    ...st,
    focus: st.focus?.map(sw),
    players: sorted,
    ball: { ...mx(st.ball), owner: st.ball.owner ? sw(st.ball.owner) : null },
    overlays,
  };
}

const TEXT = {
  good: [
    "{h8}が右サイドでボールを持った。ゴール前の相手は3人だ。",
    "{h9}はゴールに近い方(ニア)へ、{h7}は中央へ走り出す。",
    "相手の{a2}が{h9}について行き、サイドが空いた。{h8}はドリブルで前へ!",
    "{h9}が相手を引きつけて{h7}がフリーに。{h8}は後ろの{h7}へパス!",
    "{h7}がフリーでシュート!2人でゴール前に入ったから生まれたチャンスだ。",
  ],
  bad: [
    "{h8}が右サイドでボールを持った。ゴール前の相手は3人だ。",
    "{h9}がボールに近づきすぎた。{h7}はボールを見ているだけ…",
    "ゴール前にだれもいないので、{h8}は近くの{h9}へパスするしかない。",
    "{h9}は相手にかこまれ、相手の{a6}にボールを取られた!",
    "味方は前に出ていて後ろが空いている。相手の{a9}がキーパーと1対1だ!",
  ],
};

const out = {
  ...src,
  id: "side-attack-box-entry-right",
  counterpart: undefined, // 「反対側から見る」は左サイドのパターンだけ
  pattern: "右サイドから",
  question: "{h9}と{h7}は、どこへ走ればチャンスになるかな?",
  coachNote: "左サイドからのパターンを左右反転した、右サイドからの攻撃。FW(9)がニアへ斜めに走ってDFとGKを引きつけ、逆サイドMF(7)が遅れてペナルティスポット付近へ入ることで、マイナスのクロス(プルバック)のコースが生まれる。左右どちらのサイドでも、「ニアへ1人、遅れて中央へ1人」の考え方は同じであることを、左サイドのパターンと比べて確かめる。bad は9と7がボールに寄る/見ているだけになり、ゴール前に誰もいない例。",
  coachCue: "9番はニアへ!7番は遅れて真ん中へ!",
  variants: Object.fromEntries(
    Object.entries(src.variants).map(([k, v]) => [k, {
      ...v,
      steps: v.steps.map((st, i) => {
        const m = mirrorStep(st);
        if (m.focus === undefined) delete m.focus;
        return { ...m, explanation: TEXT[k][i] };
      }),
    }]),
  ),
};
// キーの順番を元のファイルにそろえる
const ordered = {};
for (const k of Object.keys(src)) ordered[k] = out[k];
const json = JSON.stringify(ordered, null, 2)
  .replace(/\{\n\s+("x": [^,]+),\n\s+("y": [^\n]+)\n\s+\}/g, "{ $1, $2 }")
  .replace(/\[\n\s+("[ah]\d+"),\n\s+("[ah]\d+"),\n\s+("[ah]\d+")\n\s+\]/g, "[$1, $2, $3]")
  .replace(/\[\n\s+("[ah]\d+"),\n\s+("[ah]\d+")\n\s+\]/g, "[$1, $2]")
  .replace(/\[\n\s+("[ah]\d+")\n\s+\]/g, "[$1]");
writeFileSync(`${OUT}/side-attack-box-entry-right.json`, json + "\n");
