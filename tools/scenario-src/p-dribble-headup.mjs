// 練習メニュー D2 顔を上げてドリブル(BL-28。docs/DRILL_PLAN.md 2 章)
// 広さ よこ 8m × たて 16m。下から上へ、コーンの門 3 つをまっすぐぬける。上にいるコーチが指で数を見せる
import { buildDrill, arrow, callout, ball, gate, look, foot } from "./lib.mjs";
const OUT = process.argv[2];

buildDrill({
  id: "head-up-dribble",
  group: "head-up-dribble",
  title: "顔を上げてドリブル",
  pattern: "門3つとコーチ",
  category: "dribble",
  theme: "ボールを運びながら顔を上げて、前にいるコーチの指の数を見る(ドリブル中に周りを見るための技術)",
  area: { w: 8, h: 16 },
  home: { name: "練習する人", players: [["h7", "CM"]] },
  away: { name: "コーチ", players: [["a1", "GK"]] },
  props: [gate("2.8,12", "5.2,12"), gate("2.8,8.2", "5.2,8.2"), gate("2.8,4.4", "5.2,4.4")],
  question: "前でコーチが指を出している。{h7}は、ドリブルしながら何を見る?",
  choices: [
    { text: "ボールだけをじっと見る", correct: false, feedback: "ボールだけを見ると、前で何が起きているか分からないよ。" },
    { text: "さわったら顔を上げて、コーチの指を見る", correct: true, feedback: "そう!さわった後に顔を上げると、前が見えるよ。" },
    { text: "ずっと前だけを見て走る", correct: false, feedback: "ずっと前だけだと、ボールが足からはなれてしまうよ。" },
  ],
  keyPoint: "さわったら顔を上げて、前を見よう!",
  coachCue: "さわったら、顔を上げて!",
  coachNote: "U-10 向け。足の甲(くつひもの所)で小さく押し出し、ボールが足からはなれている間に顔を上げてコーチの指を見る。「さわる → 見る → またさわる」のリズムを作るのがねらい。× はボールだけを見て、数が言えない例(ミスは見ていないことの1点。運び方は同じ)。コーチは指の数を2〜3回変える。試合では、パスが来る前やドリブル中に周りを見る土台になる(▶ 試合ではこの場面)。",
  practice: {
    setup: "1人1球。コーンの門(幅2.4m)を4m おきに3つ(よこ8m × たて16m)。コーチは最後の門の先に立つ",
    howTo: "門を順にまっすぐぬける。足の甲で小さくさわり、さわった後に顔を上げてコーチの指を見て、数を大きな声で言う。最後の門をぬけたらゴール。",
    reps: "片道で1本。4本 × 2セット(コーチは1本ごとに数を変える)",
    levelUp: "数を言う → 指の向き(右・左)へ曲がる → 門の間を短く → 2人のコーチの指を足し算",
    safety: "前の人が2つ目の門をぬけてからスタートする。コーチの手前2m で止まる",
  },
  match: { id: "scan-before-center" },
  good: {
    banner: "数を言えた!",
    table: `
h7 4,14.8 4,11.9 4,8.9 4,6.0 4,3.0
a1 4,1.0 4,1.0 4,1.0 4,1.0 4,1.0`,
    steps: [
      { title: "はじまり", text: "{h7}がボールを持って、門の前に立った。前にはコーチ。", focus: ["h7"], ms: 1500, ball: ball("4,14.2", "h7", "hold") },
      { title: "さわったら見る", text: "くつひもの所で小さくおして、顔を上げてコーチを見た。", ms: 1600, ball: ball("4,11.3", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), look("h7", "a1")] },
      { title: "ボールにもどる", text: "またボールを見て、小さくさわる。ボールは足のそば。", ms: 1600, ball: ball("4,8.3", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7")] },
      { title: "数を言う", text: "さわったら、もう一度顔を上げる。「3本!」と言えた。", ms: 1600, ball: ball("4,5.4", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), look("h7", "a1"), callout("h7", "3本!", "good")] },
      { title: "ぬけた!", text: "最後の門もぬけた。前を見ながら運べたね!", ms: 1600, ball: ball("4,2.4", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), callout("h7", "できた!", "good")] },
    ],
  },
  bad: {
    banner: "数が言えなかった…",
    table: `
h7 4,14.8 4,11.9 4,8.9 4,6.0 4,3.0
a1 4,1.0 4,1.0 4,1.0 4,1.0 4,1.0`,
    steps: [
      null,
      { title: "ボールだけ見る", text: "{h7}は、ボールだけをじっと見て運んでいる。", ms: 1600, ball: ball("4,11.3", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), look("h7", "ball", "bad"), callout("h7", "下ばかり", "bad")] },
      { title: "まだ下を見る", text: "顔を上げないので、コーチの指が見えない。", ms: 1600, ball: ball("4,8.3", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), look("h7", "ball", "bad")] },
      { title: "数が分からない", text: "「何本?」と聞かれても、答えられなかった。", ms: 1600, ball: ball("4,5.4", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), look("h7", "ball", "bad"), callout("h7", "え?", "bad")] },
      { title: "前が見えない", text: "門はぬけたけど、前が見えていない。さわったら顔を上げよう。", ms: 1600, ball: ball("4,2.4", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7")] },
    ],
  },
}, OUT);
