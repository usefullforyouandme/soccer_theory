// 練習メニュー D4 スピードを変える(BL-28。docs/DRILL_PLAN.md 2 章)
// 広さ よこ 8m × たて 18m。下からゆっくり運び、真ん中の門をぬけたらダッシュ。門の横のおには、門をぬけたら追いかける
import { buildDrill, arrow, callout, ball, gate, foot } from "./lib.mjs";
const OUT = process.argv[2];

buildDrill({
  id: "change-speed",
  group: "change-speed",
  title: "スピードを変える",
  pattern: "門とおに1人",
  category: "dribble",
  theme: "門まではゆっくり運び、門をぬけたら一気にスピードを上げる(相手をふりきるための、速さの変え方)",
  area: { w: 8, h: 18 },
  home: { name: "練習する人", players: [["h7", "CM"]] },
  away: { name: "おに", players: [["a9", "FW"]] },
  props: [gate("2.8,10", "5.2,10", "ここから")],
  question: "門をぬけると、横のおにが追いかけてくる。{h7}は、どう運ぶ?",
  choices: [
    { text: "ずっと同じ速さで運ぶ", correct: false, feedback: "同じ速さだと、おにが追いつきやすいよ。" },
    { text: "門まではゆっくり、ぬけたらダッシュ", correct: true, feedback: "そう!急に速くなると、おにをふりきれるよ。" },
    { text: "最初から全力で走る", correct: false, feedback: "最初から全力だと、ボールが足からはなれやすいよ。" },
  ],
  keyPoint: "ゆっくり運んで、門をぬけたら一気にダッシュ!",
  coachCue: "ゆっくり…今だ、ダッシュ!",
  coachNote: "U-10 向け。門の手前までは小さなタッチでゆっくり運び、門をぬけた瞬間に足の甲で少し大きめに前へ押し出してダッシュする。速さの差が大きいほど、相手をふりきれる。ダッシュの時はタッチを大きくしてよいが、ボールに追いつける大きさまで。× はずっと同じ速さで運び、おにに追いつかれる例(ミスは速さを変えないことの1点)。試合では、ドリブルで運んでから相手をふりきる時の土台になる(▶ 試合ではこの場面)。",
  practice: {
    setup: "1人1球+おに1人。スタートから8m 先に門(幅2.4m)、門の横3m におに(よこ8m × たて18m)",
    howTo: "門まではゆっくり運ぶ。門をぬけたらダッシュして、ゴールの線まで運ぶ。おには、ドリブルする人が門をぬけたら追いかけて、体にタッチする。",
    reps: "1本ずつ交代で、4本 × 2セット(おにも交代)",
    levelUp: "おにはゆっくり追う → 本気で追う → 門の位置を毎回変える → おにがボールを取りにくる",
    safety: "おには後ろから押さない(体にタッチするだけ)。ゴールの線の先は3m 以上あける",
  },
  match: { id: "dribble-or-pass-open" },
  good: {
    banner: "おにをふりきった!",
    table: `
h7 4,16.8 4,14.4 4,11.2 4,6.2 4,2.0
a9 7.2,10.6 7.2,10.5 7.2,10.4 6.4,8.0 5.4,5.0`,
    steps: [
      { title: "はじまり", text: "{h7}がボールを持った。門の横にはおにがいる。", focus: ["h7"], ms: 1500, ball: ball("4,16.2", "h7", "hold") },
      { title: "ゆっくり運ぶ", text: "小さくさわって、ゆっくり門へ向かう。", ms: 1600, ball: ball("4,13.8", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), callout("h7", "ゆっくり", "good")] },
      { title: "門の手前", text: "まだゆっくり。おにはまだ動かない。", ms: 1600, ball: ball("4,10.6", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7")] },
      { title: "ぬけたらダッシュ", text: "門をぬけた!少し大きめにおして、一気にダッシュ。", ms: 1400, ball: ball("4,5.3", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), arrow("run", "a9"), callout("h7", "今だ!", "good")] },
      { title: "ふりきった!", text: "急に速くなったので、おには追いつけない!", ms: 1400, ball: ball("4,1.2", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), arrow("run", "a9"), callout("h7", "できた!", "good")] },
    ],
  },
  bad: {
    banner: "おにに追いつかれた…",
    table: `
h7 4,16.8 4,14.4 4,11.8 4,9.4 4,7.0
a9 7.2,10.6 7.2,10.5 7.2,10.4 6.0,8.6 5.3,6.6`,
    steps: [
      null,
      null,
      { title: "同じ速さ", text: "{h7}は、ずっと同じ速さで運んでいる。", ms: 1600, ball: ball("4,11.2", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7")] },
      { title: "門をぬけても", text: "門をぬけても、速さが変わらない。おにが来た。", ms: 1400, ball: ball("4,8.8", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7", { judgement: "bad" }), arrow("run", "a9"), callout("h7", "同じ速さ", "bad")] },
      { title: "追いつかれた", text: "おににタッチされた。ぬけたらダッシュしよう。", ms: 1400, ball: ball("4,6.4", "h7", "dribble"),
        foot: foot("h7", "instep"), ov: [arrow("dribble", "h7"), arrow("run", "a9"), callout("a9", "タッチ!", "bad")] },
    ],
  },
}, OUT);
