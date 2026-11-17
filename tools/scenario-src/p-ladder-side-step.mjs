// 練習メニュー L2 ラダー・サイドステップ(横向き)。広さ よこ 8m × たて 7m
// ラダー 10 マスを左から右へ横向きに。体は前(上)を向いたまま。ぬけたら、上のコーチからパスを受ける
import { buildDrill, arrow, callout, ball, ladder, steps } from "./lib.mjs";
const OUT = process.argv[2];

const x = (j) => +(1.5 + 0.45 * (j - 0.5)).toFixed(3); // j マス目の真ん中
const two = (...js) => js.map((j) => `R ${+(x(j) + 0.1).toFixed(3)},4.2 L ${+(x(j) - 0.1).toFixed(3)},4.2`).join(" ");
// 足が交差する(左足が右足の前を通って右側に着く)
const cross = (...js) => js.map((j) => `R ${+(x(j) - 0.1).toFixed(3)},4.2@-15 L ${+(x(j) + 0.1).toFixed(3)},4.2@15`).join(" ");

buildDrill({
  id: "ladder-side-step",
  group: "ladder-side-step",
  title: "ラダー・サイドステップ",
  pattern: "横向き",
  category: "agility",
  theme: "体を前に向けたまま、足を交差させずに横へすばやく動く(守備で相手について横へ動くための足の運び)",
  area: { w: 8, h: 7 },
  home: { name: "練習する人", players: [["h7", "CM"]] },
  away: { name: "コーチ", players: [["a1", "GK"]] },
  props: [ladder("1.5,4.2", "6,4.2", 10)],
  question: "ラダーを横へ進む。{h7}は、足をどう運ぶ?",
  choices: [
    { text: "足を交差させて、走るように進む", correct: false, feedback: "足を交差させると、からまってつまずきやすいよ。" },
    { text: "右足から入れて、左足をそろえる", correct: true, feedback: "そう!足を交差させないと、すぐ止まれるよ。" },
    { text: "横を向かずに、両足でとぶ", correct: false, feedback: "両足でとぶと、横へすばやく動けないよ。" },
  ],
  keyPoint: "足を交差させずに、横へトン・トン!",
  coachCue: "交差しないで、トン・トン!",
  coachNote: "U-10 向けのアジリティ(すばやさ)の練習。右へ進む時は右足から1マスに入れて、左足をそろえる(1マス2歩)。体とおへそは前(コーチの方)へ向けたまま、ひざを少し曲げて低い姿勢で動く。× は左足が右足の前を交差して、足がからまる例(ミスは足の運びの1点)。左向きも同じように行う。試合では、守備で相手の横の動きについていく時の足の運びになる。",
  practice: {
    setup: "1人1列。ラダー10マス(1マス45cm)を横向きに置く。ラダーの出口の先3m にコーチがボールを持って立つ",
    howTo: "ラダーの左はしに横向きで立ち、体は前へ向けたまま、右足・左足の順で1マスずつ横へ進む。ぬけたらコーチのパスをインサイドで止める。",
    reps: "片道で1本。右向き・左向きを2本ずつ × 2セット",
    levelUp: "ゆっくり正しく → 速く → 左向き → 1マスに2歩で入って外へ出る(イン・イン・アウト・アウト)",
    safety: "前の人がラダーをぬけてからスタートする。進む先に人がいないか見てから始める",
  },
  good: {
    banner: "横へすばやく進めた!",
    table: `
h7 0.8,4.2 2.5,4.2 3.85,4.2 6.6,4.2 6.6,3.1
a1 6.6,0.9 6.6,0.9 6.6,0.9 6.6,0.9 6.6,0.9`,
    steps: [
      { title: "はじまり", text: "{h7}がラダーの左に、横向きで立った。顔は前。", focus: ["h7"], ms: 1500, ball: ball("6.6,1.5", "a1", "hold") },
      { title: "右足から", text: "右足をマスに入れて、左足をそろえる。1マスに2歩。", ms: 1500, ball: ball("6.6,1.5", "a1", "hold"),
        ov: [...steps(two(1, 2, 3)), arrow("run", "h7"), callout("h7", "トン・トン", "good")] },
      { title: "交差しない", text: "足を交差させないで、低いしせいのまま横へ。", ms: 1400, ball: ball("6.6,1.5", "a1", "hold"),
        ov: [...steps(two(4, 5, 6)), arrow("run", "h7")] },
      { title: "最後まで", text: "最後のマスまで、同じリズムで進んだ。", ms: 1700, ball: ball("6.6,1.5", "a1", "hold"),
        ov: [...steps(two(7, 8, 9, 10)), arrow("run", "h7")] },
      { title: "すぐボール", text: "ぬけたら前へ。コーチのパスを止めた!", ms: 1500, ball: ball("6.6,2.5", "h7", "ground"),
        ov: [arrow("pass", "a1"), arrow("run", "h7"), callout("h7", "できた!", "good")] },
    ],
  },
  bad: {
    banner: "足がからまった…",
    table: `
h7 0.8,4.2 2.5,4.2 3.6,4.2 5.0,4.2 6.0,3.4
a1 6.6,0.9 6.6,0.9 6.6,0.9 6.6,0.9 6.6,0.9`,
    steps: [
      null,
      { title: "足が交差", text: "{h7}は、左足を右足の前に交差させて進んだ。", ms: 1500, ball: ball("6.6,1.5", "a1", "hold"),
        ov: [...steps(cross(1, 2, 3), { judgement: "bad" }), arrow("run", "h7"), callout("h7", "交差", "bad")] },
      { title: "からまった", text: "足がからまって、つまずきそうになった。", ms: 1400, ball: ball("6.6,1.5", "a1", "hold"),
        ov: [...steps(cross(4, 5), { judgement: "bad" }), arrow("run", "h7"), callout("h7", "あっ", "bad")] },
      { title: "おそくなった", text: "立て直すのに時間がかかって、おそくなった。", ms: 1700, ball: ball("6.6,1.5", "a1", "hold"),
        ov: [...steps(cross(6, 7, 8), { judgement: "bad" }), arrow("run", "h7")] },
      { title: "おくれた", text: "パスにおくれた。足を交差させずに進もう。", ms: 1500, ball: ball("6.0,2.8", "h7", "ground"),
        ov: [...steps(cross(9, 10), { judgement: "bad" }), arrow("pass", "a1"), arrow("run", "h7")] },
    ],
  },
}, OUT);
