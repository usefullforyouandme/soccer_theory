// 練習メニュー D1 ジグザグドリブル(BL-27 のお手本。docs/DRILL_PLAN.md 2 章)
// 広さ よこ 6m × たて 14m。下から上へ進み、x=3 に一直線に置いたコーン 4 本の左右を交互に通る
import { buildDrill, arrow, callout, ball, cone, foot } from "./lib.mjs";
const OUT = process.argv[2];

buildDrill({
  id: "zigzag-dribble",
  group: "zigzag-dribble",
  title: "ジグザグドリブル",
  pattern: "コーン4本",
  category: "dribble",
  theme: "コーンの間を、細かいタッチでボールを体の近くに置いたまま、ジグザグにぬけていく(1対1でボールを失わないための足もとの技術)",
  area: { w: 6, h: 14 },
  home: { name: "練習する人", players: [["h7", "CM"]] },
  props: [cone("3,11"), cone("3,8.5"), cone("3,6"), cone("3,3.5")],
  question: "コーンが4本ならんでいる。{h7}は、どんなタッチでコーンの間を通る?",
  choices: [
    { text: "大きくけって、一気に走る", correct: false, feedback: "大きくけると、ボールが足からはなれて、コーンに当たりやすいよ。" },
    { text: "小さくさわって、ボールを近くに置く", correct: true, feedback: "そう!小さくさわると、すぐに向きを変えられるよ。" },
    { text: "コーンの外を大回りする", correct: false, feedback: "大回りすると時間がかかるよ。コーンの間を細かく通ろう。" },
  ],
  keyPoint: "小さくさわって、ボールをいつも足のそばに!",
  coachCue: "小さくさわって、ボールを足のそばに!",
  coachNote: "U-10 向けのコーンドリブル。右足のインサイド(内側)とアウトサイド(外側)を交互に使い、1歩に1回さわるくらいの細かいタッチでボールを体の近くに置く。× は、つま先で大きく押し出してボールが体から離れ、コーンに当たってコースから外れる例(ミスはタッチの大きさの1点)。左足でも同じ。試合では、1対1で相手の前でボールを失わないための土台になる(▶ 試合ではこの場面)。",
  practice: {
    setup: "1人1球。コーン4本を2.5m おきに一直線(よこ6m × たて14m)。列を2〜3つ作り、待つ人を減らす",
    howTo: "スタートからコーンの左右を交互に通り、最後のコーンをぬけたらゴール。右足の内側と外側で、1歩に1回さわるくらい細かく運ぶ。左足でも同じようにやる。",
    reps: "片道で1本。3〜5本 × 2セット(1本ごとに次の人と交代)",
    levelUp: "左足だけ → 両足を交互に → コーンの間をせまく(1.5m)→ タイムを計る",
    safety: "前の人がコーンを2本ぬけてからスタートする。列と列の間は3m以上あける",
  },
  match: { id: "take-on-wing" },
  good: {
    banner: "コーンを全部通れた!",
    table: `
h7 3,13.4 1.7,11 4.3,8.5 1.7,6 4.3,3.5`,
    steps: [
      { title: "はじまり", text: "{h7}がボールを持って、コーンの前に立った。", focus: ["h7"], ms: 1500, ball: ball("3,12.8", "h7", "hold") },
      { title: "インサイドで", text: "右足の内がわで、ちょんと左へ。ボールは足のそば。", ms: 1500, ball: ball("2.13,10.58", "h7", "dribble"),
        foot: foot("h7", "inside"), ov: [arrow("dribble", "h7"), callout("h7", "小さく", "good")] },
      { title: "アウトサイドで", text: "こんどは右足の外がわで右へ。小さくさわると、すぐ曲がれる。", ms: 1600, ball: ball("3.87,8.08", "h7", "dribble"),
        foot: foot("h7", "outside"), ov: [arrow("dribble", "h7")] },
      { title: "もう一度 左へ", text: "また内がわで左へ。コーンに当てずに進む。", ms: 1600, ball: ball("2.13,5.58", "h7", "dribble"),
        foot: foot("h7", "inside"), ov: [arrow("dribble", "h7")] },
      { title: "通りぬけた!", text: "外がわで右へ。最後のコーンも通りぬけた!", ms: 1600, ball: ball("4.3,2.9", "h7", "dribble"),
        foot: foot("h7", "outside"), ov: [arrow("dribble", "h7"), callout("h7", "できた!", "good")] },
    ],
  },
  bad: {
    banner: "コーンに当たった…",
    table: `
h7 3,13.4 2.6,12.2 1.9,10.4 4.2,9.4 5.2,7.6`,
    steps: [
      null,
      { title: "大きくけった", text: "{h7}は右足のつま先で、大きくけり出した。", ms: 1500, ball: ball("2,10.4", "h7", "dribble"),
        foot: foot("h7", "toe", { judgement: "bad" }), ov: [arrow("dribble", "h7", { judgement: "bad" }), callout("h7", "けりすぎ", "bad")] },
      { title: "コーンに当たった", text: "ボールが足から遠い。コーンに当たってしまった。", ms: 1600, ball: ball("2.6,8.8", "h7", "dribble"),
        ov: [arrow("dribble", "h7"), callout("h7", "遠い!", "bad")] },
      { title: "取りにいく", text: "{h7}はボールを追いかけて、コーンの外へ出た。", ms: 1600, ball: ball("5.4,8", "h7", "dribble"),
        ov: [arrow("dribble", "h7")] },
      { title: "時間がかかった", text: "コースにもどるのに時間がかかった。小さくさわろう。", ms: 1600, ball: ball("5,6.9", "h7", "dribble"),
        ov: [arrow("dribble", "h7")] },
    ],
  },
}, OUT);
