// 練習メニュー L1 ラダー・1マス2歩(前向き)。広さ よこ 3m × たて 9m
// ラダー 10 マス(1マス 0.45m・幅 0.5m)を下から上へ。ぬけたら、前のコーチからパスを受ける
import { buildDrill, arrow, callout, ball, ladder, steps } from "./lib.mjs";
const OUT = process.argv[2];

const y = (j) => +(8 - 0.45 * (j - 0.5)).toFixed(3); // j マス目の真ん中
const two = (...js) => js.map((j) => `L 1.38,${y(j)} R 1.62,${y(j)}`).join(" ");
const L = [ladder("1.5,8", "1.5,3.5", 10)];

buildDrill({
  id: "ladder-two-step",
  group: "ladder-two-step",
  title: "ラダー・1マス2歩",
  pattern: "前向き",
  category: "agility",
  theme: "ラダーの1マスに両足を1回ずつ、細かくすばやく着く(試合で急に止まる・向きを変えるための、足の速い動き)",
  area: { w: 3, h: 9 },
  home: { name: "練習する人", players: [["h7", "CM"]] },
  away: { name: "コーチ", players: [["a1", "GK"]] },
  props: L,
  question: "ラダーを前へ進む。{h7}は、どんな足の運びで進む?",
  choices: [
    { text: "大またで、マスをとばして進む", correct: false, feedback: "大まただと、足が細かく動かないよ。" },
    { text: "1マスに両足を1回ずつ、細かく進む", correct: true, feedback: "そう!1マスに2歩、細かく速く動かそう。" },
    { text: "1歩ずつ止まって、足もとを見る", correct: false, feedback: "止まると、リズムが切れてしまうよ。" },
  ],
  keyPoint: "1マスに2歩、つま先で細かく速く!",
  coachCue: "トン・トン、細かく!",
  coachNote: "U-10 向けのアジリティ(すばやさ)の練習。1マスに左右1回ずつ、かかとをつけずにつま先(母指球)で細かく着く。うでもふって、リズムよく進む。× は大またでマスをとばす例(ミスは歩はばの1点)。速さより、正しい足の運びとリズムを先に身につける。ラダーをぬけたらすぐコーチのパスを止めて、足の動きをボールにつなげる。ラダーが無い時は、地面にテープやチョークでマスをかいてもよい。",
  practice: {
    setup: "1人1列。ラダー10マス(1マス45cm)。ラダーの先3m にコーチがボールを持って立つ",
    howTo: "1マスに左足・右足の順で1回ずつ着いて、前へ進む。ラダーをぬけたらコーチがパスを出すので、インサイドで止める。",
    reps: "片道で1本。4本 × 2セット(1本ごとに次の人と交代)",
    levelUp: "ゆっくり正しく → 速く → 右足から始める → 後ろ向き → ぬけたらすぐドリブル",
    safety: "前の人がラダーをぬけてからスタートする。ラダーのはしをふんですべらないよう、平らな所に置く",
  },
  good: {
    banner: "細かく進めた!",
    table: `
h7 1.5,8.8 1.5,6.6 1.5,5.25 1.5,3.1 1.5,2.1
a1 1.5,0.5 1.5,0.5 1.5,0.5 1.5,0.5 1.5,0.5`,
    steps: [
      { title: "はじまり", text: "{h7}がラダーの前に立った。先にはコーチ。", focus: ["h7"], ms: 1500, ball: ball("1.5,1.0", "a1", "hold") },
      { title: "1マスに2歩", text: "1マスに左・右と1回ずつ。つま先で細かく着く。", ms: 1500, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(two(1, 2, 3)), arrow("run", "h7"), callout("h7", "トン・トン", "good")] },
      { title: "リズムよく", text: "うでもふって、同じリズムで進む。", ms: 1400, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(two(4, 5, 6)), arrow("run", "h7")] },
      { title: "最後まで細かく", text: "最後のマスまで、1マスに2歩。足がよく動いている。", ms: 1700, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(two(7, 8, 9, 10)), arrow("run", "h7")] },
      { title: "すぐボール", text: "ぬけたら、コーチのパスをすぐ止めた!", ms: 1500, ball: ball("1.5,1.5", "h7", "ground"),
        ov: [arrow("pass", "a1"), callout("h7", "できた!", "good")] },
    ],
  },
  bad: {
    banner: "マスをとばした…",
    table: `
h7 1.5,8.8 1.5,6.6 1.5,4.8 1.5,2.9 1.5,2.1
a1 1.5,0.5 1.5,0.5 1.5,0.5 1.5,0.5 1.5,0.5`,
    steps: [
      null,
      { title: "大また", text: "{h7}は大またで、マスを1つとばして進んだ。", ms: 1500, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(`L 1.38,${y(1)} R 1.62,${y(3)}`, { judgement: "bad" }), arrow("run", "h7"), callout("h7", "大また", "bad")] },
      { title: "またとばす", text: "1マスに1歩だけ。足が細かく動いていない。", ms: 1400, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(`L 1.38,${y(5)} R 1.62,${y(7)}`, { judgement: "bad" }), arrow("run", "h7")] },
      { title: "すぐ終わった", text: "すぐぬけたけど、細かい足の練習にならなかった。", ms: 1700, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(`L 1.38,${y(9)}`, { judgement: "bad" }), arrow("run", "h7")] },
      { title: "1マスに2歩で", text: "パスは止めたけど、ラダーは1マスに2歩で進もう。", ms: 1500, ball: ball("1.5,1.5", "h7", "ground"),
        ov: [arrow("pass", "a1")] },
    ],
  },
}, OUT);
