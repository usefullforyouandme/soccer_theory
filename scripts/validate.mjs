#!/usr/bin/env node
// シナリオJSONの検証: JSON Schema(構造) + ロジックチェック(整合性・リアリティ・教材としての読みやすさ)
// 使い方: node scripts/validate.mjs [ファイル...]  (省略時は scenarios/*.json 全件)
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const ROOT = new URL("..", import.meta.url).pathname;
const PHASES = ["initial", "movement", "firstPlay", "nextPlay", "outcome"];
const PLAYER_SPEED_WARN = 6; // m/s(小学生の全力疾走程度)
const PLAYER_SPEED_ERROR = 8; // m/s
const BALL_SPEED_ERROR = 25; // m/s
const BALL_OWNER_MAX_DIST = 2; // m
const PLAYER_OVERLAP_DIST = 2.5; // m(描画上の丸は半径1.5m。これ未満だと背番号が読みにくくなる)
const START_MATCH_TOLERANCE = 0.5; // m(good/bad の Step 1 は同じ配置)
const ARROW_TOLERANCE = 1.5; // m(矢印の始点・終点と実際の位置のずれ)
const TEXT_LIMIT = { low: 30, middle: 40, high: 50 }; // 対象学年ごとの表示文字数の目安
const KANJI = /\p{Script=Han}/gu;
// 学年別漢字配当表(2020年度〜)の1〜4年生分。middle(4年生向け)はこれ以外の漢字を警告する
const KANJI_UP_TO_G4 = new Set([...(
  // 1年
  "一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六" +
  // 2年
  "引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話" +
  // 3年
  "悪安暗医委意育員院飲運泳駅央横屋温化荷界開階寒感漢館岸起期客究急級宮球去橋業曲局銀区苦具君係軽血決研県庫湖向幸港号根祭皿仕死使始指歯詩次事持式実写者主守取酒受州拾終習集住重宿所暑助昭消商章勝乗植申身神真深進世整昔全相送想息速族他打対待代第題炭短談着注柱丁帳調追定庭笛鉄転都度投豆島湯登等動童農波配倍箱畑発反坂板皮悲美鼻筆氷表秒病品負部服福物平返勉放味命面問役薬由油有遊予羊洋葉陽様落流旅両緑礼列練路和" +
  // 4年
  "愛案以衣位茨印英栄媛塩岡億加果貨課芽賀改械害街各覚潟完官管関観願岐希季旗器機議求泣給挙漁共協鏡競極熊訓軍郡群径景芸欠結建健験固功好香候康佐差菜最埼材崎昨札刷察参産散残氏司試児治滋辞鹿失借種周祝順初松笑唱焼照城縄臣信井成省清静席積折節説浅戦選然争倉巣束側続卒孫帯隊達単置仲沖兆低底的典伝徒努灯働特徳栃奈梨熱念敗梅博阪飯飛必票標不夫付府阜富副兵別辺変便包法望牧末満未民無約勇要養浴利陸良料量輪類令冷例連老労録"
)]);
const TOKEN = /\{([ha][1-9][0-9]?)\}/g;
const PASS_DIST_WARN = 20; // m(4年生のキック力。ゴロ・浮き球とも)
const GROUND_SPEED_WARN = 10; // m/s(4年生のゴロのパスとして速すぎる)
// 初めて出る時に言いかえを付ける用語(docs/scenario-prompt.md の言いかえ一覧と同じ)
const TERMS = [
  ["ニア", /ニア/], ["ファー", /ファー/], ["マイナス", /マイナス/], ["カウンター", /カウンター/],
  ["フリー", /フリー(?!キック)/], ["カット", /カット/], ["こぼれ球", /こぼれ球/], ["スルーパス", /スルーパス/],
  ["しぼる", /しぼ[らりるれろっ]/], ["クロス", /クロス/], ["カバー", /カバー/], ["プレス", /プレス/],
];
const NEGATIVE_CUE = /な[!!]|するな|ない[!!]|じゃなく|だけ見ない/;
// よくあるミスの Step 2 が「動かない」型かどうか(偏りの集計用)
const STATIC_MISTAKE = /見てるだけ|止まって|動かない|のまま|いたまま|止まった/;

const schema = JSON.parse(readFileSync(join(ROOT, "schema/scenario.schema.json"), "utf8"));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** 画面に表示される文字列({h7} → 7番。低学年向けは 7ばん) */
const rendered = (s, grade) => s.replace(TOKEN, (_, id) => `${id.slice(1)}${grade === "low" ? "ばん" : "番"}`);
const tokens = (s) => [...s.matchAll(TOKEN)].map((m) => m[1]);

function checkLogic(s, file) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

  if (basename(file, ".json") !== s.id) err("id", `ファイル名と id(${s.id}) が一致しません`);

  // 練習メニュー(kind: drill)は、出てくる人だけ・広さ(area)の中で描く
  const drill = s.kind === "drill";
  const DRILL_CATS = ["dribble", "pass", "agility"];
  if (drill) {
    if (!s.area) err("area", "練習メニュー(kind: drill)には area(広さ)が必要です");
    if (!s.practice) err("practice", "練習メニュー(kind: drill)には practice(準備・やり方・回数)が必要です");
    if (!DRILL_CATS.includes(s.category)) err("category", `練習メニューの category は ${DRILL_CATS.join(" / ")} にしてください`);
    for (const k of ["keyword", "courseOrder", "counterpart", "drills"]) if (s[k] !== undefined) warn(k, "練習メニューでは使いません(ずかんの項目です)");
  } else {
    if (DRILL_CATS.includes(s.category)) err("category", `${s.category} は練習メニュー(kind: drill)だけの種類です`);
    for (const k of ["area", "practice", "match"]) if (s[k] !== undefined) err(k, "練習メニュー(kind: drill)だけの項目です");
  }
  // 描画の拡大率(src/stage.ts の fitArea と同じ)。選手の丸の大きさは画面上で同じなので、重なりの基準は拡大率で割る
  const scale = drill && s.area ? Math.min(50 / s.area.w, 68 / s.area.h) : 1;
  const overlapDist = PLAYER_OVERLAP_DIST / scale;
  const inArea = (where, p) => {
    if (drill && s.area && (p.x > s.area.w || p.y > s.area.h)) err(where, `(${p.x}, ${p.y}) が広さ ${s.area.w}×${s.area.h}m の外です`);
  };

  // ロスター
  const roster = new Map();
  for (const side of ["home", "away"]) {
    const prefix = side === "home" ? "h" : "a";
    const roles = s.teams[side].players.map((p) => p.role);
    if (!drill && roles.length !== 8) err(`teams.${side}`, "試合の場面は 8 人にしてください");
    if (!drill && roles.filter((r) => r === "GK").length !== 1) err(`teams.${side}`, "GK はちょうど1人にしてください");
    for (const p of s.teams[side].players) {
      if (p.id !== `${prefix}${p.number}`) err(`teams.${side}`, `${p.id} は ${prefix}${p.number} にしてください`);
      if (roster.has(p.id)) err(`teams.${side}`, `${p.id} が重複しています`);
      roster.set(p.id, { ...p, side });
    }
  }
  const isPlayer = (id) => roster.has(id);
  const sideOf = (id) => roster.get(id)?.side;

  // 子どもに見える文字列のチェック(漢字・長さ・トークン)
  const grade = s.targetGrade;
  const textLimit = TEXT_LIMIT[grade];
  const checkText = (where, text, { long = false } = {}) => {
    for (const id of tokens(text)) if (!isPlayer(id)) err(where, `存在しない選手トークン {${id}} があります`);
    const r = rendered(text, grade);
    const kanji = [...new Set(r.match(KANJI) ?? [])];
    if (grade === "low" && kanji.length) warn(where, `低学年向けのため漢字を避けてください: "${r}"`);
    if (grade === "middle") {
      const hard = kanji.filter((k) => !KANJI_UP_TO_G4.has(k));
      if (hard.length) warn(where, `4年生までに習わない漢字(${hard.join("")})を含みます: "${r}"`);
    }
    if (long && [...r].length > textLimit) warn(where, `対象学年には長すぎます(${[...r].length}字 > ${textLimit}字): "${r}"`);
  };
  checkText("title", s.title);
  checkText("pattern", s.pattern);
  if (s.counterpart) checkText("counterpart.label", s.counterpart.label);
  checkText("question", s.question, { long: true });
  if (s.questionTitle) checkText("questionTitle", s.questionTitle);
  else warn("questionTitle", "子ども向けの疑問形タイトルがありません(一覧と問いかけ中に答えが見えてしまいます)");
  if (s.questionTitle && s.questionTitle === s.title) warn("questionTitle", "title と同じです(答えが見えてしまいます)");
  if (!s.keyword && !drill) warn("keyword", "合言葉がありません");
  if (!s.courseOrder && !drill) warn("courseOrder", "おすすめの順番がありません");
  if (s.ruleNote) checkText("ruleNote", s.ruleNote);
  if (s.next) checkText("next.label", s.next.label);
  if (s.choices) {
    s.choices.forEach((c, k) => {
      checkText(`choices[${k}].text`, c.text);
      checkText(`choices[${k}].feedback`, c.feedback, { long: true });
    });
    if (s.choices.filter((c) => c.correct).length !== 1) err("choices", "正解(correct: true)はちょうど1つにしてください");
  }
  if (s.coachCue && NEGATIVE_CUE.test(s.coachCue)) warn("coachCue", `否定形・禁止形の声かけです。やることを肯定形で書いてください: "${s.coachCue}"`);
  checkText("keyPoint", s.keyPoint, { long: true });
  for (const side of ["home", "away"]) checkText(`teams.${side}.name`, s.teams[side].name);

  for (const [vName, v] of Object.entries(s.variants)) {
    checkText(`${vName}.label`, v.label);
    checkText(`${vName}.outcomeBanner`, v.outcomeBanner);
    if (vName === "good" && v.outcomeTone && v.outcomeTone !== "chance") warn(`${vName}.outcomeTone`, "お手本の結末は chance にしてください");
    if (vName === "bad" && v.outcomeTone === "chance") warn(`${vName}.outcomeTone`, "よくあるミスの結末は pinch か miss にしてください");
    if (drill && vName === "bad" && v.outcomeTone !== "miss") warn(`${vName}.outcomeTone`, "練習メニューのよくあるミスの結末は miss(△ 残念…)にしてください");
    if (v.steps.slice(1).some((st) => st.ball.offside) && vName === "good") warn(`${vName}`, "お手本にオフサイドのパスがあります");

    v.steps.forEach((st, i) => {
      const at = `${vName}.steps[${i}]`;
      if (st.phase !== PHASES[i]) err(at, `phase は "${PHASES[i]}" にしてください(現在 "${st.phase}")`);
      checkText(`${at}.title`, st.title);
      checkText(`${at}.explanation`, st.explanation, { long: true });
      for (const id of st.focus ?? []) if (!isPlayer(id)) err(`${at}.focus`, `存在しない選手 ${id} があります`);

      // 全選手がそろっているか
      const ids = Object.keys(st.players);
      for (const id of roster.keys()) if (!st.players[id]) err(at, `${id} の座標がありません`);
      for (const id of ids) if (!isPlayer(id)) err(at, `ロスターにない選手 ${id} があります`);

      // 選手同士の重なり
      for (let a = 0; a < ids.length; a++) {
        for (let b = a + 1; b < ids.length; b++) {
          const d = dist(st.players[ids[a]], st.players[ids[b]]);
          if (d < overlapDist) warn(at, `${ids[a]} と ${ids[b]} が近すぎて重なって見えます(${d.toFixed(1)}m)`);
        }
      }

      for (const id of ids) inArea(`${at}.players.${id}`, st.players[id]);
      inArea(`${at}.ball`, st.ball);
      if (st.foot) {
        const f = st.foot;
        if (!isPlayer(f.player)) err(`${at}.foot`, `存在しない選手 ${f.player} があります`);
        if (typeof f.toward === "string" && !isPlayer(f.toward)) err(`${at}.foot`, `存在しない選手 ${f.toward} を参照しています`);
        if (typeof f.toward === "object") inArea(`${at}.foot.toward`, f.toward);
        if (f.toward === f.player) err(`${at}.foot`, "自分自身を送る先にはできません");
      }

      // ボール
      const { ball } = st;
      if (ball.owner === null) {
        if (ball.motion !== "shot") err(`${at}.ball`, "owner が null になれるのは motion=shot のときだけです");
      } else if (!isPlayer(ball.owner)) {
        err(`${at}.ball`, `owner ${ball.owner} がロスターにいません`);
      } else if (st.players[ball.owner]) {
        const d = dist(ball, st.players[ball.owner]);
        if (d > BALL_OWNER_MAX_DIST) err(`${at}.ball`, `ボールが ${ball.owner} から ${d.toFixed(1)}m 離れています`);
      }
      if (i === 0 && ball.motion !== "hold") err(`${at}.ball`, "Step 1 の motion は hold にしてください");
      if (i === 0 && ball.offside) err(`${at}.ball`, "Step 1 に offside: true は付けられません");

      const prev = i > 0 ? v.steps[i - 1] : null;

      // 前ステップとの整合(速度・ボールの受け渡し・オフサイド)
      if (prev) {
        const sec = st.durationMs / 1000;
        for (const id of roster.keys()) {
          const p0 = prev.players[id];
          const p1 = st.players[id];
          if (!p0 || !p1) continue;
          const d = dist(p0, p1);
          const speed = d / sec;
          if (speed > PLAYER_SPEED_ERROR) err(at, `${id} の移動が速すぎます(${speed.toFixed(1)}m/s)`);
          else if (speed > PLAYER_SPEED_WARN) warn(at, `${id} の移動がやや速いです(${speed.toFixed(1)}m/s)`);
          // 練習メニューでは、コーチや順番待ちの人がその場にいるのは自然なので見ない
          if (d === 0 && !drill) warn(at, `${id} が前ステップから全く動いていません(微調整の移動を入れてください)`);
        }
        const ballSpeed = dist(prev.ball, ball) / sec;
        if (ballSpeed > BALL_SPEED_ERROR) err(`${at}.ball`, `ボールが速すぎます(${ballSpeed.toFixed(1)}m/s)`);
        // 4年生のキック力: GK のキック・スロー、コーナー・スローインは別の基準(目安 15m)なので除く
        const passer = prev.ball.owner;
        const setPiece = prev.ball.x < 1 || prev.ball.x > 49;
        if (["ground", "air", "steal"].includes(ball.motion) && passer && roster.get(passer)?.role !== "GK" && !setPiece) {
          const len = dist(prev.ball, ball);
          if (len > PASS_DIST_WARN) warn(`${at}.ball`, `${passer} のキックが ${len.toFixed(1)}m あります(4年生は ${PASS_DIST_WARN}m 以内が目安)`);
          else if (ball.motion === "ground" && ballSpeed > GROUND_SPEED_WARN) warn(`${at}.ball`, `${passer} のゴロのパスが速すぎます(${ballSpeed.toFixed(1)}m/s。4年生は ${GROUND_SPEED_WARN}m/s 以下が目安)`);
        }
        const ownerChanged = prev.ball.owner !== ball.owner;
        if (["hold", "dribble"].includes(ball.motion) && ownerChanged) {
          err(`${at}.ball`, `motion=${ball.motion} なのに持ち主が ${prev.ball.owner} → ${ball.owner} に変わっています`);
        }
        if (["ground", "air", "steal"].includes(ball.motion) && !ownerChanged) {
          err(`${at}.ball`, `motion=${ball.motion} なのに持ち主が変わっていません`);
        }
        if (ball.motion === "steal" && prev.ball.owner && ball.owner && sideOf(prev.ball.owner) === sideOf(ball.owner)) {
          err(`${at}.ball`, "steal は相手チームからボールを奪う場合だけ使ってください");
        }
        if (["ground", "air"].includes(ball.motion) && ball.owner && prev.ball.owner && !drill) {
          if (sideOf(prev.ball.owner) !== sideOf(ball.owner)) {
            err(`${at}.ball`, "相手へのパスは steal を使ってください");
          } else {
            // オフサイドは原則エラー。ミスとして見せる場合だけ ball.offside: true で明示する
            const off = offside(ball.owner, prev);
            if (off && !ball.offside) err(`${at}.ball`, `${off}(意図したものなら ball.offside: true を付けてください)`);
            if (!off && ball.offside) err(`${at}.ball`, `offside: true ですが、${ball.owner} はオフサイドの位置にいません`);
          }
        }
        if (ball.lofted && ball.motion !== "steal") err(`${at}.ball`, "lofted: true は motion が steal のときだけ付けてください(パスが通る浮き球は air)");
        if (ball.offside && !["ground", "air"].includes(ball.motion)) err(`${at}.ball`, "offside: true は motion が ground/air のパスだけに付けてください");
      }

      // オーバーレイの参照と整合
      st.overlays.forEach((o, j) => {
        const oat = `${at}.overlays[${j}]`;
        const refs = o.type === "arrow" ? [o.by]
          : o.type === "passLane" ? [o.from, o.to]
          : o.type === "triangle" ? o.players
          : o.type === "callout" ? [o.player]
          : o.type === "shotCone" && o.from !== "ball" ? [o.from]
          : o.type === "look" ? [o.player, ...(typeof o.at === "string" && o.at !== "ball" ? [o.at] : [])] : [];
        for (const id of refs) if (!isPlayer(id)) err(oat, `存在しない選手 ${id} を参照しています`);
        if (o.type === "triangle" && new Set(o.players.map(sideOf)).size > 1) {
          err(oat, "トライアングルは同じチームの3人で作ってください");
        }
        if (o.type === "passLane" && sideOf(o.from) !== sideOf(o.to)) {
          err(oat, "パスコースは同じチームの選手同士にしてください");
        }
        if (o.type === "space" && o.label) checkText(`${oat}.label`, o.label);
        if (o.type === "callout") checkText(`${oat}.text`, o.text);
        if (o.type === "shotCone" && o.label) checkText(`${oat}.label`, o.label);
        if (o.type === "look" && isPlayer(o.player)) {
          const target = o.at === "ball" ? st.ball : typeof o.at === "string" ? st.players[o.at] : o.at;
          if (o.at === o.player) err(oat, "自分自身を見る先にはできません");
          else if (target && dist(target, st.players[o.player]) < 2 / scale) warn(oat, `見る先が ${o.player} に近すぎて、向きが分かりません`);
        }
        if (o.type === "arrow" && prev && isPlayer(o.by)) checkArrow(o, prev, st, oat);
        if (drill && ["offsideLine", "shotCone"].includes(o.type)) err(oat, `練習メニューでは ${o.type} は使えません(ゴール・ラインを描かないため)`);
        if (!drill && ["cone", "gate", "ladder", "step"].includes(o.type)) warn(oat, `${o.type} は練習メニュー用のオーバーレイです`);
        if (o.type === "cone" || o.type === "step") inArea(oat, o);
        if (o.type === "ladder") {
          inArea(oat, o.a);
          inArea(oat, o.b);
          if (dist(o.a, o.b) < 0.5) err(oat, "ラダーの入り口と出口が近すぎます");
        }
        if (o.type === "gate") {
          inArea(oat, o.a);
          inArea(oat, o.b);
          if (o.label) checkText(`${oat}.label`, o.label);
        }
        if (o.type === "arrow") for (const p of [o.from, o.to]) if (p) inArea(oat, p);
        if (o.type === "space") inArea(oat, o);
        if (o.type === "look" && typeof o.at === "object") inArea(oat, o.at);
      });
    });
  }

  // 用語は、その子が最初に読む説明文で言いかえる(お手本・ミスのどちらから見ても通じるように)
  for (const [vName, v] of Object.entries(s.variants)) {
    const sentences = [s.question, ...v.steps.map((st) => st.explanation), s.keyPoint];
    const shorts = [s.title, s.questionTitle ?? "", ...v.steps.flatMap((st) => [st.title, ...st.overlays.flatMap((o) => [o.text ?? "", o.label ?? ""])])];
    for (const [term, re] of TERMS) {
      const first = sentences.find((t) => re.test(t));
      const usedShort = shorts.some((t) => re.test(t));
      if (first && !first.includes(`(${term.slice(0, 2)}`)) warn(`${vName}`, `「${term}」が初めて出る文に言いかえがありません: "${rendered(first, grade)}"(例: 〜(${term}))`);
      else if (!first && usedShort) warn(`${vName}`, `「${term}」が吹き出し・見出しだけに出ています。説明文で言いかえてください`);
      if (re.test(v.outcomeBanner)) warn(`${vName}.outcomeBanner`, `結末の見出しに「${term}」があります。用語を使わない言い方にしてください`);
    }
  }

  // good と bad の Step 1 は同じ配置にする(比べる起点をそろえる)
  const g0 = s.variants.good.steps[0];
  const b0 = s.variants.bad.steps[0];
  for (const id of roster.keys()) {
    if (g0.players[id] && b0.players[id] && dist(g0.players[id], b0.players[id]) > START_MATCH_TOLERANCE) {
      warn("bad.steps[0]", `${id} の初期位置が good と違います`);
    }
  }
  if (dist(g0.ball, b0.ball) > START_MATCH_TOLERANCE) warn("bad.steps[0].ball", "ボールの初期位置が good と違います");

  /** 矢印が実際の動きと食い違っていないか(矢印が「うそ」をつかないように) */
  function checkArrow(o, prev, st, oat) {
    if (o.kind === "run" || o.kind === "dribble") {
      const p0 = prev.players[o.by];
      const p1 = st.players[o.by];
      if (o.from && dist(o.from, p0) > ARROW_TOLERANCE) warn(oat, `矢印の始点が ${o.by} の前の位置とずれています`);
      if (o.to && dist(o.to, p1) > ARROW_TOLERANCE) warn(oat, `矢印の終点が ${o.by} の位置とずれています`);
      if (!o.from && !o.to && dist(p0, p1) < 1) warn(oat, `${o.by} がほとんど動いていないのに矢印があります`);
      if (o.kind === "dribble" && st.ball.owner !== o.by) warn(oat, `ドリブルの矢印ですが ${o.by} がボールを持っていません`);
    } else {
      if (prev.ball.owner !== o.by) warn(oat, `${o.kind} の矢印ですが ${o.by} は前ステップでボールを持っていません`);
      if (o.from && dist(o.from, prev.ball) > ARROW_TOLERANCE) warn(oat, "矢印の始点がボールの前の位置とずれています");
      if (o.to && dist(o.to, st.ball) > ARROW_TOLERANCE) warn(oat, "矢印の終点がボールの位置とずれています");
    }
  }

  /** パスが出た瞬間(前ステップ終了時)の位置で簡易オフサイド判定 */
  function offside(receiver, prev) {
    const side = sideOf(receiver);
    const r = prev.players[receiver];
    // home は Y=0 に向かって攻める。相手陣内 = Y<34
    const toward = side === "home" ? (y) => -y : (y) => y; // 大きいほど相手ゴールに近い
    if (toward(r.y) <= toward(34)) return null; // 自陣ではオフサイドにならない
    const defenders = [...roster.values()].filter((p) => p.side !== side).map((p) => toward(prev.players[p.id].y)).sort((a, b) => b - a);
    const secondLast = defenders[1];
    if (toward(r.y) > secondLast && toward(r.y) > toward(prev.ball.y)) {
      return `${receiver} がオフサイドの位置でパスを受けています(後ろから2人目の守備者より前)`;
    }
    return null;
  }

  return { errors, warnings };
}

/** 1本だけ検証する時もリンク先を確かめられるよう、同じフォルダのシナリオも読む */
function loadSiblings(list) {
  const byId = new Map();
  for (const dir of new Set(list.map(({ file }) => dirname(file)))) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
        byId.set(data.id, { file: join(dir, f), data });
      } catch {
        // 読めないファイルは、それ自身の検証でエラーになる
      }
    }
  }
  for (const item of list) byId.set(item.data.id, item);
  return byId;
}

/** 「反対側から見る」のリンクが、存在するシナリオを指し、おたがいに指し合っているか */
function checkCounterparts(list) {
  const problems = [];
  const byId = loadSiblings(list);
  for (const { file, data } of list) {
    const c = data.counterpart;
    if (!c) continue;
    const target = byId.get(c.id);
    if (c.id === data.id) problems.push(`${basename(file)}: counterpart が自分自身を指しています`);
    else if (!target) problems.push(`${basename(file)}: counterpart のシナリオ ${c.id} がありません`);
    else if (target.data.group === data.group) problems.push(`${basename(file)}: counterpart は別のテーマのシナリオにしてください(同じテーマはパターンで切りかえる)`);
    else if (target.data.counterpart?.id !== data.id) problems.push(`${basename(file)}: ${c.id} の counterpart が ${data.id} を指していません(おたがいに指し合ってください)`);
  }
  return problems;
}

/** 同じテーマ(group)のシナリオ同士で、タイトル・種類・パターン名がそろっているか */
function checkGroups(list) {
  const problems = [];
  const byGroup = new Map();
  for (const { file, data } of list) {
    if (!byGroup.has(data.group)) byGroup.set(data.group, []);
    byGroup.get(data.group).push({ file, data });
  }
  for (const [group, items] of byGroup) {
    const first = items[0].data;
    for (const { file, data } of items.slice(1)) {
      if (data.title !== first.title) problems.push(`${basename(file)}: group "${group}" のタイトルが ${basename(items[0].file)} と違います`);
      if (data.category !== first.category) problems.push(`${basename(file)}: group "${group}" の category が ${basename(items[0].file)} と違います`);
      for (const k of ["questionTitle", "keyword", "courseOrder", "ruleNote"]) {
        if (data[k] !== first[k]) problems.push(`${basename(file)}: group "${group}" の ${k} が ${basename(items[0].file)} と違います`);
      }
    }
    const patterns = items.map((x) => x.data.pattern);
    if (new Set(patterns).size !== patterns.length) problems.push(`group "${group}" に同じパターン名があります`);
  }
  // おすすめの順番は、テーマごとに別の番号にする
  const byOrder = new Map();
  for (const [group, items] of byGroup) {
    const o = items[0].data.courseOrder;
    if (o === undefined) continue;
    if (byOrder.has(o)) problems.push(`courseOrder ${o} が "${byOrder.get(o)}" と "${group}" で重なっています`);
    byOrder.set(o, group);
  }
  return problems;
}

/** 「つづきを見る」のリンク先があるか */
function checkNext(list) {
  const ids = new Set(list.map((x) => x.data.id));
  for (const dir of new Set(list.map(({ file }) => dirname(file)))) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) ids.add(basename(f, ".json"));
  }
  return list.filter(({ data }) => data.next && !ids.has(data.next.id)).map(({ file, data }) => `${basename(file)}: next のシナリオ ${data.next.id} がありません`);
}

/** 練習 → 試合(match)、試合 → 練習(drills[].id)のリンク先が、あって種類が合っているか */
function checkPracticeLinks(list) {
  const problems = [];
  const byId = loadSiblings(list);
  const kindOf = (id) => byId.get(id)?.data.kind ?? (byId.has(id) ? "match" : null);
  for (const { file, data } of list) {
    if (data.match && kindOf(data.match.id) !== "match") problems.push(`${basename(file)}: match のシナリオ ${data.match.id} が試合の場面にありません`);
    for (const d of data.drills ?? []) {
      if (d.id && kindOf(d.id) !== "drill") problems.push(`${basename(file)}: drills の ${d.id} が練習メニュー(kind: drill)にありません`);
    }
  }
  return problems;
}

/** よくあるミスの形の偏り(「動かない」型の数)を表示する */
function reportMistakeKinds(list) {
  const still = list.filter(({ data }) => {
    const st = data.variants.bad.steps[1];
    return [st.title, ...st.overlays.filter((o) => o.type === "callout").map((o) => o.text)].some((t) => STATIC_MISTAKE.test(t));
  });
  const oneVsOne = list.filter(({ data }) => /1対1/.test(data.variants.bad.steps.at(-1).explanation));
  const scored = list.filter(({ data }) => {
    const b = data.variants.good.steps.at(-1).ball;
    return b.motion === "shot" && b.x >= 22.5 && b.x <= 27.5 && b.y <= 0.5;
  });
  console.log(`  集計: ミスが「動かない」型 ${still.length} 本 / ミスの結末がキーパーと1対1 ${oneVsOne.length} 本 / お手本がゴールで終わる ${scored.length} 本(全 ${list.length} 本)`);
}

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(join(ROOT, "scenarios")).filter((f) => f.endsWith(".json")).map((f) => join(ROOT, "scenarios", f));

let failed = false;
const valid = [];
for (const file of files) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`✗ ${file}\n  JSON の読み込みに失敗: ${e.message}`);
    failed = true;
    continue;
  }
  if (!validateSchema(data)) {
    console.error(`✗ ${file}(スキーマ違反)`);
    for (const e of validateSchema.errors) console.error(`  ERROR ${e.instancePath || "/"} ${e.message}`);
    failed = true;
    continue;
  }
  const { errors, warnings } = checkLogic(data, file);
  console.log(`${errors.length ? "✗" : "✓"} ${file}(エラー ${errors.length} / 警告 ${warnings.length})`);
  for (const e of errors) console.error(`  ERROR ${e}`);
  for (const w of warnings) console.warn(`  WARN  ${w}`);
  if (errors.length) failed = true;
  else valid.push({ file, data });
}
const validMatches = valid.filter(({ data }) => data.kind !== "drill");
if (validMatches.length > 1) reportMistakeKinds(validMatches);
for (const p of [...checkGroups(valid), ...checkCounterparts(valid), ...checkNext(valid), ...checkPracticeLinks(valid)]) {
  console.error(`  ERROR ${p}`);
  failed = true;
}
process.exit(failed ? 1 : 0);
