// 練習メニュー L3 ラダー・グーパージャンプ。広さ よこ 3m × たて 9m
// ラダー 10 マスを下から上へ、両足でとぶ。グー = 両足をマスの中、パー = 両足をラダーの外。ぬけたらコーチのパスを受ける
import { buildDrill, arrow, callout, ball, ladder, steps } from "./lib.mjs";
const OUT = process.argv[2];

const y = (j) => +(8 - 0.45 * (j - 0.5)).toFixed(3);
const goo = (j) => `L 1.4,${y(j)} R 1.6,${y(j)}`;
const paa = (j) => `L 1.1,${y(j)}@-10 R 1.9,${y(j)}@10`;
const onRail = (j) => `L 1.25,${y(j)}@-10 R 1.75,${y(j)}@10`; // パーが小さく、ラダーのはしをふむ
const gp = (...js) => js.map((j) => (j % 2 ? goo(j) : paa(j))).join(" ");

buildDrill({
  id: "ladder-jump",
  group: "ladder-jump",
  title: "ラダー・グーパージャンプ",
  pattern: "両足でジャンプ",
  category: "agility",
  theme: "両足でリズムよくとび、グーはマスの中・パーはラダーの外にしっかり着く(体のバランスと、着いてすぐ動く力)",
  area: { w: 3, h: 9 },
  home: { name: "練習する人", players: [["h7", "CM"]] },
  away: { name: "コーチ", players: [["a1", "GK"]] },
  props: [ladder("1.5,8", "1.5,3.5", 10)],
  question: "グー・パーでとんで進む。{h7}は、パーの時どこに足を着く?",
  choices: [
    { text: "ラダーのはしの上", correct: false, feedback: "はしの上は、ふんでずれたり、すべったりするよ。" },
    { text: "ラダーの外に、しっかり開いて", correct: true, feedback: "そう!外に開いて着くと、リズムよくとべるよ。" },
    { text: "マスの中に、かた足だけ", correct: false, feedback: "かた足だとバランスがくずれるよ。両足で着こう。" },
  ],
  keyPoint: "グーは中、パーは外!リズムよくとぼう",
  coachCue: "グー・パー・グー・パー!",
  coachNote: "U-10 向けのアジリティ(すばやさ)の練習。両足でとび、グーは両足をそろえてマスの中、パーは両足を開いてラダーの外に着く。つま先で軽く着いて、すぐ次へとぶ(ひざを軽く曲げてやわらかく)。× はパーの開きが小さく、ラダーのはしをふむ例(ミスは足を着く場所の1点)。はしをふむとラダーがずれて、すべる原因にもなる。ぬけたらすぐコーチのパスを止める。",
  practice: {
    setup: "1人1列。ラダー10マス(1マス45cm)。ラダーの先3m にコーチがボールを持って立つ",
    howTo: "1マス目はグー(両足をマスの中)、2マス目はパー(両足をラダーの外)と、交互に両足でとんで進む。ぬけたらコーチのパスをインサイドで止める。",
    reps: "片道で1本。4本 × 2セット",
    levelUp: "ゆっくり正しく → 速く → グー・グー・パー → 片足ケンケン(右・左)",
    safety: "着く時はひざを軽く曲げる。ラダーは平らな所に置き、ずれたら直してからスタートする",
  },
  good: {
    banner: "リズムよくとべた!",
    table: `
h7 1.5,8.8 1.5,6.6 1.5,5.25 1.5,3.1 1.5,2.1
a1 1.5,0.5 1.5,0.5 1.5,0.5 1.5,0.5 1.5,0.5`,
    steps: [
      { title: "はじまり", text: "{h7}がラダーの前に立った。先にはコーチ。", focus: ["h7"], ms: 1500, ball: ball("1.5,1.0", "a1", "hold") },
      { title: "グー・パー", text: "グーはマスの中、パーはラダーの外。両足で着く。", ms: 1500, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(gp(1, 2, 3)), arrow("run", "h7"), callout("h7", "グー・パー", "good")] },
      { title: "外に開く", text: "パーの時は、ラダーの外にしっかり開いて着く。", ms: 1400, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(gp(4, 5, 6)), arrow("run", "h7")] },
      { title: "リズムよく", text: "つま先で軽く着いて、すぐ次へとぶ。", ms: 1700, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(gp(7, 8, 9, 10)), arrow("run", "h7")] },
      { title: "すぐボール", text: "ぬけたら、コーチのパスをすぐ止めた!", ms: 1500, ball: ball("1.5,1.5", "h7", "ground"),
        ov: [arrow("pass", "a1"), callout("h7", "できた!", "good")] },
    ],
  },
  bad: {
    banner: "ラダーをふんだ…",
    table: `
h7 1.5,8.8 1.5,6.6 1.5,5.25 1.5,3.1 1.5,2.1
a1 1.5,0.5 1.5,0.5 1.5,0.5 1.5,0.5 1.5,0.5`,
    steps: [
      null,
      { title: "パーが小さい", text: "{h7}は、パーの開きが小さい。ラダーのはしをふんだ。", ms: 1500, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(`${goo(1)} ${goo(3)}`), ...steps(onRail(2), { judgement: "bad" }), arrow("run", "h7"), callout("h7", "ふんだ", "bad")] },
      { title: "またふんだ", text: "パーの時、また足がラダーのはしに乗った。", ms: 1400, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(goo(5)), ...steps(`${onRail(4)} ${onRail(6)}`, { judgement: "bad" }), arrow("run", "h7")] },
      { title: "ずれそう", text: "はしをふむと、ラダーがずれてすべりやすい。", ms: 1700, ball: ball("1.5,1.0", "a1", "hold"),
        ov: [...steps(`${goo(7)} ${goo(9)}`), ...steps(`${onRail(8)} ${onRail(10)}`, { judgement: "bad" }), arrow("run", "h7")] },
      { title: "パーは外へ", text: "パスは止めたけど、パーはラダーの外に着こう。", ms: 1500, ball: ball("1.5,1.5", "h7", "ground"),
        ov: [arrow("pass", "a1")] },
    ],
  },
}, OUT);
