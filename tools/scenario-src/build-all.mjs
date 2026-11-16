#!/usr/bin/env node
// 座標表のスクリプトから scenarios/*.json を作り直す
//   node tools/scenario-src/build-all.mjs            → scenarios/ に上書き
//   node tools/scenario-src/build-all.mjs --check    → 一時フォルダに作り、scenarios/ と1バイトでも違えばエラー
// 後のスクリプトは前のスクリプトが作った JSON(同じテーマのタイトルなど)を読むので、この順番で実行する
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
const SCENARIOS = join(HERE, "../../scenarios");
const ORDER = [
  "00-box-entry-left.mjs",
  "w1-counter-press.mjs",
  "w1-press-and-cover.mjs",
  "w1-support-angle.mjs",
  "w1-run-behind.mjs",
  "w2-counter-attack.mjs",
  "w2-one-two.mjs",
  "w2-mark-and-ball.mjs",
  "w2-restart-shape.mjs",
  "w3-build.mjs",
  "w3-attack.mjs",
  "w3-defend-transition.mjs",
  "w3-restart.mjs",
  "w3-box-entry-right.mjs",
  "w4-box-entry-byline.mjs",
  "w5-scan-before.mjs",
  "w5-two-v-one.mjs",
  "w5-delay-outnumbered.mjs",
  "w5-tuck-in.mjs",
  "w5-corner-attack.mjs",
  "w6-take-on.mjs",
  "w6-shoot.mjs",
  "w7-formation-232.mjs",
  "w8-gk.mjs",
  "w8-cb.mjs",
  "w8-sb.mjs",
  "w8-cm.mjs",
  "w8-wm.mjs",
  "w8-fw.mjs",
];

const check = process.argv.includes("--check");
const out = check ? mkdtempSync(join(tmpdir(), "scenarios-")) : SCENARIOS;
for (const f of ORDER) execFileSync(process.execPath, [join(HERE, f), out], { stdio: "inherit" });

if (!check) {
  console.log(`✓ ${readdirSync(out).length} 本のシナリオを ${out} に書き出しました`);
  process.exit(0);
}
// スクリプトから作られたファイルが scenarios/ と一致するか(スクリプトを通さずに JSON だけ直していないか)
const generated = readdirSync(out);
const diff = generated.filter((f) => {
  try {
    return readFileSync(join(out, f), "utf8") !== readFileSync(join(SCENARIOS, f), "utf8");
  } catch {
    return true;
  }
});
rmSync(out, { recursive: true, force: true });
if (diff.length) {
  console.error(`✗ スクリプトと scenarios/ の内容が違います: ${diff.join(", ")}`);
  console.error("  座標や文章は tools/scenario-src/ のスクリプトを直して、npm run scenarios で作り直してください。");
  process.exit(1);
}
console.log(`✓ ${generated.length} 本すべて、スクリプトと scenarios/ が一致しています`);
