// 最初のシナリオ「サイドからゴール前へ(左サイドから)」。lib.mjs より前に作ったため、単体で JSON を組み立てている
import { writeFileSync } from "node:fs";
const ORDER = ["h1","h2","h4","h3","h6","h7","h8","h9","a1","a3","a4","a2","a8","a6","a7","a9"];
const PH = ["initial","movement","firstPlay","nextPlay","outcome"];
const pt = (s) => { const [x,y] = s.split(",").map(Number); return { x, y }; };
function players(table) {
  const rows = Object.fromEntries(table.trim().split("\n").map((l) => { const [id, ...c] = l.trim().split(/\s+/); return [id, c]; }));
  return [0,1,2,3,4].map((i) => Object.fromEntries(ORDER.map((id) => [id, pt(rows[id][i])])));
}
const roster = (side) => {
  const p = side === "home" ? "h" : "a";
  return [["GK",1],["LB",2],["CB",4],["RB",3],["CM",6],["LM",7],["RM",8],["FW",9]]
    .map(([role, n]) => ({ id: `${p}${n}`, number: n, role }));
};
//        S1      S2         S3         S4         S5
const goodT = `
h1 25,58 25,56 25,54 25,52 25,51
h2 10,40 10,36 9,32 9,29 9,27
h4 25,44 24,40 23,36 23,33 23,31
h3 38,40 35,37 33,33 32,30 31,28
h6 22,30 15,26 12,19 13,15 14,13
h7 6,24 7,21 5,9 4,7 5,7
h8 42,26 36,17 32,12 27,10 27.3,8.8
h9 25,16 20,11 19.5,6.5 20,4.5 20.5,3.5
a1 25,3 23,3 23.5,2 24.5,1.5 25.5,1
a3 16,12 17.5,12.5 18,4.3 17.8,2.8 17.5,2.3
a4 25,11 23,9.5 22.5,5 22.5,3.5 23,3
a2 34,12 30,11 26,5 25.5,5 26,4
a8 10,20 9,19 7,12 6,9 7,9.5
a6 23,22 21,21 18,16 19,13 20,12
a7 38,21 38,19.5 35,15 33,13 31,11
a9 25,36 23,35 22,32 22,30 24.5,28.5`;
// bad は「9ばん と 8ばん が ゴールまえに はいらない」の1点だけを変える(他の味方は good と同じ考え方で動く)
const badT = `
h1 25,58 25,56 25,54 25,52 25,49.5
h2 10,40 10,36 9,32 9,30 10.5,33.5
h4 25,44 24,40 23,36 23,33 24,40
h3 38,40 35,37 33,33 32,30 30,37.5
h6 22,30 15,26 14,23 13.5,25 14,27.5
h7 6,24 7,21 7.5,21.5 7.5,23 9,25.5
h8 42,26 43,25 43,24 42,25 41,28
h9 25,16 13,17 12,17 11.5,18 12,20.5
a1 25,3 24,3 24,3.5 24,4 24,5
a3 16,12 14.5,14.5 13,14.5 12.5,15.5 13.5,17.5
a4 25,11 24,12 23,13 23,15 24,18
a2 34,12 32,12 30,13 30,15 31,18
a8 10,20 9,19 9.5,18.5 10,20.5 11,23
a6 23,22 21,21 15,19 16,23 16.5,26
a7 38,21 39,21 38,22 37,24 36,30
a9 25,36 24,35 24.5,33.5 25.5,31.5 25.5,44`;

const arrow = (kind, by, extra = {}) => ({ type: "arrow", kind, by, ...extra });
const space = (c, rx, ry, label) => ({ type: "space", ...pt(c), rx, ry, ...(label ? { label } : {}) });
const callout = (player, text, tone) => ({ type: "callout", player, text, tone });
const ball = (c, owner, motion) => ({ ...pt(c), owner, motion });

const goodP = players(goodT);
const badP = players(badT);
for (const id of ORDER) if (JSON.stringify(goodP[0][id]) !== JSON.stringify(badP[0][id])) throw new Error(`S1 mismatch ${id}`);

function variant(label, outcomeBanner, ps, steps) {
  return {
    label, outcomeBanner,
    steps: steps.map((st, i) => ({ phase: PH[i], title: st.title, explanation: st.text, durationMs: st.ms, ...(st.focus ? { focus: st.focus } : {}), players: ps[i], ball: st.ball, overlays: st.ov ?? [] })),
  };
}
const S1 = { title: "はじまり", text: "{h7}が左サイドでボールを持った。ゴール前の相手は3人だ。", ms: 1500, ball: ball("7,23", "h7", "hold"), focus: ["h7", "h9", "h8"] };
const scenario = {
  schemaVersion: 2,
  id: "side-attack-box-entry",
  title: "サイドからゴール前へ",
  category: "attack",
  group: "box-entry",
  pattern: "左サイドから",
  theme: "サイドでボールを持った時の、中央FWと逆サイドMFのゴール前への入り方",
  coachNote: "FW(9)がニアへ斜めに走ってDFとGKを引きつけ、逆サイドMF(8)が遅れてペナルティスポット付近へ入ることで、マイナスのクロス(プルバック)のコースが生まれる。bad はこの2人が「ボールに寄る/見ているだけ」になり、ゴール前に誰もいない典型例。出しどころを失ったボール保持者が密集へパスし、奪われた瞬間に押し上げていた最終ラインの背後を突かれる(攻撃時に後ろを上げること自体は正しいので、bad でも他の選手は good と同じ動きにしている)。",
  coachCue: "9番はニアへ!8番は遅れて真ん中へ!",
  drills: [
    {
      "title": "サイドからの3対2(+GK)",
      "description": "サイドの選手がドリブルで運び、FW役はニアへ、逆サイド役は遅れてペナルティスポット付近へ入る。DF2人とGKを置き、ニアで引きつけてからマイナスのクロスを通す。"
    },
    {
      "title": "ゴール前2人ルールのミニゲーム",
      "description": "ボールがサイドにあるとき、ゴール前に味方が2人以上いないと得点を認めない条件付きのゲーム。ボールに寄りすぎず、ゴール前へ入る習慣をつける。"
    }
  ],
  targetGrade: "middle",
  question: "{h9}と{h8}は、どこへ走ればチャンスになるかな?",
  keyPoint: "ボールに近づきすぎず、ゴール前に2人で入ろう!",
  teams: {
    home: { name: "味方", formation: "3-3-1", players: roster("home") },
    away: { name: "相手", formation: "3-3-1", players: roster("away") },
  },
  variants: {
    good: variant("お手本", "フリーでシュート!", goodP, [
      S1,
      { title: "動き出し", text: "{h9}はゴールに近い方(ニア)へ、{h8}は中央へ走り出す。", ms: 2500, ball: ball("7.5,20.2", "h7", "dribble"),
        ov: [arrow("run", "h9"), arrow("run", "h8"), arrow("run", "a3"), callout("h9", "ニアへ!", "good"), callout("h8", "中央へ!", "good")] },
      { title: "ドリブル", text: "相手の{a3}が{h9}について行き、サイドが空いた。{h7}はドリブルで前へ!", ms: 3000, ball: ball("5.5,8.3", "h7", "dribble"),
        ov: [arrow("dribble", "h7"), arrow("run", "h9"), arrow("run", "a3"), arrow("run", "h8"), space("26,10", 4, 3, "ここが空く!"), callout("h9", "引きつける", "good")] },
      { title: "後ろへパス", text: "{h9}が相手を引きつけて{h8}がフリーに。{h7}は後ろの{h8}へパス!", ms: 2000, ball: ball("26.8,9.2", "h8", "ground"),
        ov: [arrow("pass", "h7"), callout("h8", "フリー!", "good")] },
      { title: "シュート!", text: "{h8}がフリーでシュート!2人でゴール前に入ったから生まれたチャンスだ。", ms: 1500, ball: ball("26.9,0", null, "shot"), focus: ["h8", "h9"],
        ov: [arrow("shot", "h8")] },
    ]),
    bad: variant("よくあるミス", "カウンターでピンチ!", badP, [
      S1,
      { title: "近づきすぎ", text: "{h9}がボールに近づきすぎた。{h8}はボールを見ているだけ…", ms: 2500, ball: ball("7.5,20.2", "h7", "dribble"),
        ov: [arrow("run", "h9", { judgement: "bad" }), arrow("run", "a3"), callout("h9", "近づきすぎ", "bad"), callout("h8", "見てるだけ", "bad")] },
      { title: "近くへパス", text: "ゴール前にだれもいないので、{h7}は近くの{h9}へパスするしかない。", ms: 2000, ball: ball("12.2,18", "h9", "ground"),
        ov: [arrow("pass", "h7"), space("24,8", 6, 4, "だれもいない")] },
      { title: "取られた!", text: "{h9}は相手にかこまれ、相手の{a6}にボールを取られた!", ms: 2000, ball: ball("16.2,24", "a6", "steal"),
        ov: [arrow("dribble", "a6"), callout("h9", "かこまれた", "bad")] },
      { title: "ピンチ!", text: "味方は前に出ていて後ろが空いている。相手の{a9}がキーパーと1対1だ!", ms: 3000, ball: ball("25.6,45.1", "a9", "air"),
        ov: [arrow("pass", "a6"), arrow("run", "a9"), space("25,42", 7, 6)] },
    ]),
  },
};
const json = JSON.stringify(scenario, null, 2)
  .replace(/\{\n\s+("x": [^,]+),\n\s+("y": [^\n]+)\n\s+\}/g, "{ $1, $2 }")
  .replace(/\[\n\s+("[ah]\d+"),\n\s+("[ah]\d+"),\n\s+("[ah]\d+")\n\s+\]/g, "[$1, $2, $3]")
  .replace(/\[\n\s+("[ah]\d+"),\n\s+("[ah]\d+")\n\s+\]/g, "[$1, $2]")
  .replace(/\[\n\s+("[ah]\d+")\n\s+\]/g, "[$1]");
writeFileSync(`${process.argv[2]}/side-attack-box-entry.json`, json + "\n");
