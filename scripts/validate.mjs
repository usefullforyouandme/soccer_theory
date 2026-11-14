#!/usr/bin/env node
// シナリオJSONの検証: JSON Schema(構造) + ロジックチェック(整合性・リアリティ)
// 使い方: node scripts/validate.mjs [ファイル...]  (省略時は scenarios/*.json 全件)
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const ROOT = new URL("..", import.meta.url).pathname;
const PHASES = ["initial", "movement", "firstPlay", "nextPlay", "outcome"];
const PLAYER_SPEED_WARN = 6; // m/s(小学生の全力疾走程度)
const PLAYER_SPEED_ERROR = 8; // m/s
const BALL_SPEED_ERROR = 25; // m/s
const BALL_OWNER_MAX_DIST = 2; // m
const PLAYER_OVERLAP_DIST = 1; // m
const KANJI = /\p{Script=Han}/u;

const schema = JSON.parse(readFileSync(join(ROOT, "schema/scenario.schema.json"), "utf8"));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function checkLogic(s, file) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

  if (basename(file, ".json") !== s.id) err("id", `ファイル名と id(${s.id}) が一致しません`);

  // ロスター
  const roster = new Map();
  for (const side of ["home", "away"]) {
    const prefix = side === "home" ? "h" : "a";
    const roles = s.teams[side].players.map((p) => p.role);
    if (roles.filter((r) => r === "GK").length !== 1) err(`teams.${side}`, "GK はちょうど1人にしてください");
    for (const p of s.teams[side].players) {
      if (p.id !== `${prefix}${p.number}`) err(`teams.${side}`, `${p.id} は ${prefix}${p.number} にしてください`);
      if (roster.has(p.id)) err(`teams.${side}`, `${p.id} が重複しています`);
      roster.set(p.id, { ...p, side });
    }
  }
  const isPlayer = (id) => roster.has(id);

  if (s.targetGrade === "low") {
    if (KANJI.test(s.title)) warn("title", "低学年向けのため漢字を避けてください");
  }

  for (const [vName, v] of Object.entries(s.variants)) {
    if (s.targetGrade === "low" && KANJI.test(v.outcomeBanner)) {
      warn(`${vName}.outcomeBanner`, "低学年向けのため漢字を避けてください");
    }
    v.steps.forEach((st, i) => {
      const at = `${vName}.steps[${i}]`;
      if (st.phase !== PHASES[i]) err(at, `phase は "${PHASES[i]}" にしてください(現在 "${st.phase}")`);
      if (s.targetGrade === "low") {
        for (const key of ["title", "explanation"]) {
          if (KANJI.test(st[key])) warn(`${at}.${key}`, `漢字を含みます: "${st[key]}"`);
        }
      }

      // 全選手がそろっているか
      const ids = Object.keys(st.players);
      for (const id of roster.keys()) if (!st.players[id]) err(at, `${id} の座標がありません`);
      for (const id of ids) if (!isPlayer(id)) err(at, `ロスターにない選手 ${id} があります`);

      // 選手同士の重なり
      for (let a = 0; a < ids.length; a++) {
        for (let b = a + 1; b < ids.length; b++) {
          const d = dist(st.players[ids[a]], st.players[ids[b]]);
          if (d < PLAYER_OVERLAP_DIST) warn(at, `${ids[a]} と ${ids[b]} が重なっています(${d.toFixed(1)}m)`);
        }
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

      // 前ステップとの整合(速度・ボールの受け渡し)
      if (i > 0) {
        const prev = v.steps[i - 1];
        const sec = st.durationMs / 1000;
        for (const id of roster.keys()) {
          const p0 = prev.players[id];
          const p1 = st.players[id];
          if (!p0 || !p1) continue;
          const d = dist(p0, p1);
          const speed = d / sec;
          if (speed > PLAYER_SPEED_ERROR) err(at, `${id} の移動が速すぎます(${speed.toFixed(1)}m/s)`);
          else if (speed > PLAYER_SPEED_WARN) warn(at, `${id} の移動がやや速いです(${speed.toFixed(1)}m/s)`);
          if (d === 0) warn(at, `${id} が前ステップから全く動いていません(微調整の移動を入れてください)`);
        }
        const ballSpeed = dist(prev.ball, ball) / sec;
        if (ballSpeed > BALL_SPEED_ERROR) err(`${at}.ball`, `ボールが速すぎます(${ballSpeed.toFixed(1)}m/s)`);
        const ownerChanged = prev.ball.owner !== ball.owner;
        if (["hold", "dribble"].includes(ball.motion) && ownerChanged) {
          err(`${at}.ball`, `motion=${ball.motion} なのに持ち主が ${prev.ball.owner} → ${ball.owner} に変わっています`);
        }
        if (["ground", "air", "steal"].includes(ball.motion) && !ownerChanged) {
          err(`${at}.ball`, `motion=${ball.motion} なのに持ち主が変わっていません`);
        }
        if (ball.motion === "steal" && prev.ball.owner && ball.owner && roster.get(prev.ball.owner)?.side === roster.get(ball.owner)?.side) {
          err(`${at}.ball`, "steal は相手チームからボールを奪う場合だけ使ってください");
        }
      }

      // オーバーレイの参照
      st.overlays.forEach((o, j) => {
        const oat = `${at}.overlays[${j}]`;
        const refs = o.type === "arrow" ? [o.by] : o.type === "passLane" ? [o.from, o.to] : o.type === "triangle" ? o.players : [];
        for (const id of refs) if (!isPlayer(id)) err(oat, `存在しない選手 ${id} を参照しています`);
        if (o.type === "triangle" && new Set(o.players.map((id) => roster.get(id)?.side)).size > 1) {
          err(oat, "トライアングルは同じチームの3人で作ってください");
        }
        if (o.type === "passLane" && roster.get(o.from)?.side !== roster.get(o.to)?.side) {
          err(oat, "パスコースは同じチームの選手同士にしてください");
        }
      });
    });
  }
  return { errors, warnings };
}

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(join(ROOT, "scenarios")).filter((f) => f.endsWith(".json")).map((f) => join(ROOT, "scenarios", f));

let failed = false;
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
}
process.exit(failed ? 1 : 0);
