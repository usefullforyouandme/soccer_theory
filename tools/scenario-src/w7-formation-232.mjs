// 2-3-2 版(指導者レビュー CR-12)。3-3-1 のシナリオを元に、味方を 2-3-2(DF 2人・MF 3人・FW 2人)に置きかえて作る
//   - 元のシナリオの文章・ボール・オーバーレイを使い、役割が入れかわる選手の ID を swap で置きかえる
//   - 座標は「元の 3-3-1 の座標」+ rows(置きかえる選手の 5 ステップ分)。4番(CB)はいなくなり、10番(FW)がふえる
import { readFileSync } from "node:fs";
import { build } from "./lib.mjs";
const OUT = process.argv[2];
const ORDER_232 = ["h1", "h2", "h3", "h6", "h7", "h8", "h9", "h10", "a1", "a3", "a4", "a2", "a8", "a6", "a7", "a9"];

const swapId = (map, id) => (typeof id === "string" && map[id]) || id;
const swapText = (map, s) => s.replace(/\{(h\d+)\}/g, (m, id) => (map[id] ? `{${map[id]}}` : m));

function stepsOf(variant, swap, texts = {}) {
  return variant.steps.map((st, i) => ({
    title: st.title,
    text: texts[i] ?? swapText(swap, st.explanation),
    ms: st.durationMs,
    ...(st.focus ? { focus: st.focus.map((id) => swapId(swap, id)) } : {}),
    ball: { ...st.ball, owner: swapId(swap, st.ball.owner) },
    ov: st.overlays.map((o) => {
      const c = { ...o };
      for (const k of ["by", "player", "from", "to", "at"]) if (typeof c[k] === "string") c[k] = swapId(swap, c[k]);
      if (c.players) c.players = c.players.map((id) => swapId(swap, id));
      return c;
    }),
  }));
}

/** 元の座標(4番を除く)に rows を上書きして、2-3-2 の座標表(文字列)を作る */
function tableOf(variant, rows) {
  return ORDER_232.map((id) => {
    if (rows[id]) return `${id} ${rows[id]}`;
    if (id === "h10") throw new Error("h10 の座標がありません");
    return `${id} ${variant.steps.map((st) => `${st.players[id].x},${st.players[id].y}`).join(" ")}`;
  }).join("\n");
}

function derive(srcId, def) {
  const src = JSON.parse(readFileSync(`${OUT}/${srcId}.json`, "utf8"));
  const swap = def.swap ?? {};
  for (const id of Object.keys(def.good.rows)) {
    if (def.bad.rows[id] && def.bad.rows[id].split(" ")[0] !== def.good.rows[id].split(" ")[0]) throw new Error(`${def.id}: ${id} の Step 1 が good と bad で違います`);
  }
  build({
    id: def.id,
    formation: "2-3-2",
    title: src.title,
    category: src.category,
    group: src.group,
    pattern: def.pattern,
    theme: src.theme,
    coachNote: def.coachNote,
    coachCue: def.coachCue ?? src.coachCue,
    question: def.question ?? swapText(swap, src.question),
    keyPoint: src.keyPoint,
    choices: src.choices?.map((c) => ({ ...c, text: swapText(swap, c.text), feedback: swapText(swap, c.feedback) })),
    good: {
      banner: src.variants.good.outcomeBanner,
      table: tableOf(src.variants.good, def.good.rows),
      steps: stepsOf(src.variants.good, swap, def.good.texts),
    },
    bad: {
      banner: src.variants.bad.outcomeBanner,
      tone: src.variants.bad.outcomeTone,
      table: tableOf(src.variants.bad, def.bad.rows),
      steps: stepsOf(src.variants.bad, swap, def.bad.texts),
    },
  }, OUT);
}

// ---------------- B1 サイドからゴール前へ(2-3-2・左から) ----------------
// FW が2人なので、9がニア、10がおくれて真ん中へ。8は外で後ろを支える。DF は2・3の2人
derive("side-attack-box-entry", {
  id: "side-attack-box-entry-232",
  pattern: "2-3-2で(左から)",
  swap: { h8: "h10" },
  coachNote: "「左サイドから」を、2-3-2(DF 2人・MF 3人・FW 2人)のチームで描いたもの。FW が2人いるので、9がニアへ走ってDFとGKを引きつけ、もう1人のFW(10)がおくれてペナルティスポット付近へ入る。逆サイドのRM(8)は、ゴール前に入りすぎず外で後ろを支える。形がちがっても「ニアへ1人、おくれて真ん中へ1人」の考え方は同じ。bad は9と10がボールに寄る/見ているだけになり、奪われた後は背後を2対1で突かれる(DF が2人なので、3-3-1 より後ろが手うすになりやすい)。",
  coachCue: "9番はニアへ!10番は遅れて真ん中へ!",
  good: {
    rows: {
      h2: "16,42 16,38 15,34 15,31 15,29",
      h3: "34,42 33,38 32,34 31,31 30,29",
      h8: "42,26 40,22 38,19 36,17 35,16",
      h10: "30,18 31,14 30,12 23.5,9.6 23.8,8.6",
    },
  },
  bad: {
    rows: {
      h2: "16,42 16,38 15,34 15,32 15,38",
      h3: "34,42 33,38 32,34 31,32 27,44",
      h8: "42,26 41,25 40,24 40.5,26 39.5,28.5",
      h10: "30,18 30.5,18.5 31,19 31,20 31,22",
    },
    texts: { 4: "相手の{a9}へパス。{a9}と{a7}の2人に、守るのは{h3}だけ!" },
  },
});

// ---------------- C1 1人が行く、1人がカバー(2-3-2・サイド) ----------------
// DF が2人なので、カバーは「となりのDF(3)」。3が空けた右は、8がもどって助ける
derive("press-and-cover-wing", {
  id: "press-and-cover-232",
  pattern: "2-3-2で(サイド)",
  swap: { h4: "h3" },
  coachNote: "「サイドの守り」を、2-3-2(DF 2人)のチームで描いたもの。DF が2人なので、2がボールに行ったら、となりのDF(3)が中から寄ってななめ後ろでカバーする。3が空けた右側は、RM(8)がもどって助ける。形がちがっても「1人が行ったら、もう1人はななめ後ろ」の考え方は同じ。bad は3も同時にボールへ飛びこみ、1回のフェイントで2人ともかわされ、中央でフリーでシュートを打たれる例。DF が2人のチームほど、2人目が飛びこむと後ろにだれもいなくなる。",
  coachCue: "1人が行ったら、となりはななめ後ろ!",
  good: {
    rows: {
      h3: "26,48 15,48.5 11,50 9,50.5 10,50",
      h8: "36,34 33,40 30,45 28,47 27,48",
      h10: "30,24 30,27 29,30 28,32 27,33",
    },
  },
  bad: {
    rows: {
      h3: "26,48 12.5,44.5 11.5,45.5 12,47 13,49.5",
      h8: "36,34 34,38 32,42 30,45 30,48",
      h10: "30,24 30,27 29,30 28,32 27,33.5",
    },
  },
});

// ---------------- D1 取られたらすぐ取り返す(2-3-2・サイド) ----------------
// FW が2人いるので、取られた時に近くで取り返しに行ける人がふえる。後ろは2・3の2人で中を守る
derive("counter-press-wing", {
  id: "counter-press-232",
  pattern: "2-3-2で(サイド)",
  coachNote: "「サイドで取られた時」を、2-3-2(DF 2人・FW 2人)のチームで描いたもの。FW が2人いるので、取られた瞬間に近くにいる人がふえ、10も中へのパスコースを消せる。後ろは2が前に出てパスをカットし、3が中央を守る。形がちがっても「取られたら、近くの人はすぐ取り返しに行く」考え方は同じ。bad は7と6が自分のゴールの方へ下がってしまい、DF が2人しかいない後ろをスルーパスで突かれる例。",
  good: {
    rows: {
      h3: "30,36 27,35 25,33 24.5,32 24,31",
      h10: "28,10 24,13 22,14.5 22,12 23,10",
    },
  },
  bad: {
    rows: {
      h3: "30,36 29.5,36 29,36.5 24,41 24.5,46",
      h10: "28,10 28.5,11.5 28.5,13 28,15 27.5,18",
    },
  },
});

// ---------------- E1 ゴールキックの時の広がり方(2-3-2・前から来る) ----------------
// DF が2人なので、2・3が左右に広がり、真ん中には CM(6)が下りて受ける
derive("restart-shape-press", {
  id: "restart-shape-232",
  pattern: "2-3-2で(前から来る)",
  swap: { h4: "h6", h6: "h10" },
  coachNote: "「相手が前から来る時」のゴールキックを、2-3-2(DF 2人)のチームで描いたもの。DF が2人なので、2・3がタッチライン近くまで大きく広がり、真ん中にはCM(6)が下りてきて受ける。形がちがっても「相手が前から来る時は、大きく広がってパスの道を作る」考え方は同じ。bad は全員がボールの近くに集まり、近くの6番へ短いパスを出すしかなく、ゴール前で奪われる例。※ゴールキック時に相手がどこまで近づけるかは大会のルールで違う。",
  good: {
    rows: {
      h6: "22,52 25,59.5 26,59 27,57 28,54",
      h10: "28,44 29,42 30,39 30.5,37 31,35",
    },
  },
  bad: {
    rows: {
      h6: "22,52 25,59 25,59.5 24.5,60.5 22,59",
      h10: "28,44 22,54.5 22.5,55.5 21.5,56 20,56.5",
    },
  },
});
