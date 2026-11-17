// 練習メニュー D3 コーンでターン(BL-28。docs/DRILL_PLAN.md 2 章)
// 広さ よこ 6m × たて 15m。スタートの門から上のコーンまで運び、手前で切り返してスタートの門へもどる
import { buildDrill, arrow, callout, ball, cone, gate, foot } from "./lib.mjs";
const OUT = process.argv[2];

buildDrill({
  id: "cone-turn",
  group: "cone-turn",
  title: "コーンでターン",
  pattern: "コーン1本でもどる",
  category: "dribble",
  theme: "コーンの手前でボールを止めずに切り返し、向きを変えたらすぐ加速する(1対1で相手をかわすための足もとの技術)",
  area: { w: 6, h: 15 },
  home: { name: "練習する人", players: [["h7", "CM"]] },
  props: [gate("1.8,13.4", "4.2,13.4", "スタート"), cone("3,3.0")],
  question: "上のコーンまで運んで、もどってくる。{h7}は、どこで向きを変える?",
  choices: [
    { text: "コーンの手前で切り返す", correct: true, feedback: "そう!手前で切り返すと、すぐもどれるよ。" },
    { text: "コーンのまわりを大きく回る", correct: false, feedback: "大きく回ると、遠回りで時間がかかるよ。" },
    { text: "コーンの前で止まって考える", correct: false, feedback: "止まると、もう一度動き出すのに時間がかかるよ。" },
  ],
  keyPoint: "コーンの手前で切り返して、すぐダッシュ!",
  coachCue: "手前で切り返して、すぐダッシュ!",
  coachNote: "U-10 向け。コーンの約1m 手前で、右足の内側(インサイド)でボールを後ろへ切り返し、体の向きを変えたら足の甲で前へ押し出して加速する。切り返す前の最後のタッチを小さくして、ボールを止めすぎないのがコツ。× はコーンのまわりを大回りして時間がかかる例(ミスは向きの変え方の1点)。足のうらで引く・アウトサイドで切り返すなど、やり方を変えてもよい。左足でも同じ。試合では、1対1で相手の前で向きを変えてかわす土台になる(▶ 試合ではこの場面)。",
  practice: {
    setup: "1人1球。スタートの門(幅2.4m)から10m 先にコーン1本(よこ6m × たて15m)。列を2〜3つ作る",
    howTo: "スタートの門からコーンへ運び、コーンの手前で切り返して、スタートの門へダッシュでもどる。切り返す足と面(内側・外側・足のうら)をコーチが決める。",
    reps: "1往復で1本。4本 × 2セット(右足・左足で1セットずつ)",
    levelUp: "インサイドで切り返し → アウトサイド → 足のうらで引く → コーチの合図でターン → タイムを計る",
    safety: "もどってくる人と、次に出る人がぶつからないよう、門をぬけてから次の人がスタートする",
  },
  match: { id: "take-on-box" },
  good: {
    banner: "すぐにもどれた!",
    table: `
h7 3,14.4 3,9.6 3,5.4 3.4,4.4 3,11.8`,
    steps: [
      { title: "はじまり", text: "{h7}がスタートの門の前に立った。上にコーンがある。", focus: ["h7"], ms: 1500, ball: ball("3,13.8", "h7", "hold") },
      { title: "コーンへ運ぶ", text: "くつひもの所で小さくさわって、コーンへ向かう。", ms: 1600, ball: ball("3,9.0", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7")] },
      { title: "最後は小さく", text: "コーンが近い。最後のタッチは小さくして、止まらない。", ms: 1500, ball: ball("3,4.6", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), callout("h7", "小さく", "good")] },
      { title: "手前で切り返す", text: "コーンの手前で、内がわで後ろへ切り返した。", ms: 1300, ball: ball("3.2,5.0", "h7", "dribble"),
        foot: foot("h7", "inside", { toward: "3,10", plant: 60 }), ov: [callout("h7", "くるっ", "good")] },
      { title: "すぐダッシュ", text: "向きを変えたら、すぐダッシュ。スタートの門へもどれた!", ms: 2000, ball: ball("3,12.4", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), callout("h7", "できた!", "good")] },
    ],
  },
  bad: {
    banner: "時間がかかった…",
    table: `
h7 3,14.4 3,9.6 4.4,3.8 2.6,0.9 1.6,5.4`,
    steps: [
      null,
      null,
      { title: "コーンの横へ", text: "{h7}は、コーンの横へふくらんでいった。", ms: 1500, ball: ball("4.4,3.2", "h7", "dribble"),
        foot: foot("h7", "outside"), ov: [arrow("dribble", "h7", { judgement: "bad" }), callout("h7", "大回り", "bad")] },
      { title: "コーンを回る", text: "コーンのまわりを、大きくぐるっと回っている。", ms: 1300, ball: ball("2,1.4", "h7", "dribble"),
        foot: foot("h7", "inside"), ov: [arrow("dribble", "h7", { judgement: "bad" })] },
      { title: "まだもどれない", text: "遠回りしたので、まだ門にもどれない。手前で切り返そう。", ms: 2000, ball: ball("1.6,6.0", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), callout("h7", "おそい…", "bad")] },
    ],
  },
}, OUT);
