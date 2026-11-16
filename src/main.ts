import "./style.css";
import { termsIn } from "./glossary";
import { POSITIONS, SCENE_KINDS, type PositionGuide, type PositionKey } from "./positions";
import { plainText, prefersReducedMotion, renderRichText, roleLabels, Stage } from "./stage";
import type { Category, Keyword, Scenario, VariantKey } from "./types";

// scenarios/*.json をビルド時に同梱する(実行時の外部通信なし)
const modules = import.meta.glob<Scenario>("../scenarios/*.json", { eager: true, import: "default" });
// 同じテーマの中では、3-3-1 のパターンを先に、別のフォーメーション(2-3-2 など)の版を後ろに並べる
const otherFormation = (s: Scenario) => Number(s.teams.home.formation !== "3-3-1");
const scenarios = Object.values(modules).sort((a, b) => otherFormation(a) - otherFormation(b) || a.id.localeCompare(b.id));

/** 種類の表示順と見出し */
const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "build", label: "ボールを前へ運ぶ", icon: "➡️" },
  { key: "attack", label: "ゴールをねらう", icon: "🥅" },
  { key: "defend", label: "ボールを取る・守る", icon: "🛡️" },
  { key: "transition", label: "切りかえ", icon: "🔄" },
  { key: "restart", label: "リスタート・キーパー", icon: "🧤" },
];
/** ずかん全体の合言葉 */
const KEYWORDS: Record<Keyword, { label: string; icon: string }> = {
  look: { label: "見る", icon: "👀" },
  move: { label: "動いて受ける", icon: "🏃" },
  goal: { label: "ゴールへ向かう", icon: "🥅" },
  switch: { label: "すぐ切りかえる", icon: "🔄" },
  protect: { label: "ゴールを守る", icon: "🛡️" },
};
/** おすすめの順番の区切り(courseOrder の範囲) */
const COURSE_STAGES = [
  { upTo: 9, label: "ステップ1 まずはここから", lead: "見る・もらう・ドリブルとパス・2人で守る" },
  { upTo: 18, label: "ステップ2 切りかえとゴール前", lead: "取られた時・取った時・ゴール前のせめと守り" },
  { upTo: 99, label: "ステップ3 場面ごとの動き", lead: "サイドチェンジ・キーパー・スローイン・コーナー・ポジションごとの動き" },
];
const LIST_VIEW_KEY = "soccer-theory:list-view";
const POSITION_KEY = "soccer-theory:position";
type ListView = "course" | "category" | "position";
const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const saveStored = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    // 保存できない環境(プライベートモードなど)では毎回「おすすめの順番」から
  }
};
const readListView = (): ListView => {
  const v = readStored(LIST_VIEW_KEY);
  return v === "category" || v === "position" ? v : "course";
};
const positionOf = (key: string | null | undefined) => POSITIONS.find((p) => p.key === key);
const readPosition = (): PositionGuide => positionOf(readStored(POSITION_KEY)) ?? POSITIONS[0];
/** 子どもに見せるテーマ名(答えが書いていない疑問形) */
const childTitle = (s: Scenario) => s.questionTitle ?? s.title;
const keywordChip = (s: Scenario) => {
  if (!s.keyword) return null;
  const k = KEYWORDS[s.keyword];
  return h("span", `kw-chip kw-${s.keyword}`, `${k.icon} ${k.label}`);
};

/** 同じテーマの別パターン(自分を含む) */
const siblingsOf = (s: Scenario) => scenarios.filter((x) => x.group === s.group);

const STEP_LABELS = ["はじまり", "動き出し", "パス・ドリブル", "その後", "結果"];
const READ_PAUSE_MS = 2200; // 自動再生でステップ間に文章を読む時間(ふつうの速さ)
const SPEEDS = [
  { value: 1, label: "🐇 ふつう" },
  { value: 0.5, label: "🐢 ゆっくり" },
  { value: 0.25, label: "🐌 もっとゆっくり" },
];
const app = document.querySelector<HTMLDivElement>("#app")!;

type Mode = VariantKey | "compare";

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function button(label: string, className: string, onClick: () => void, aria?: string) {
  const b = h("button", className, label);
  b.type = "button";
  if (aria) b.setAttribute("aria-label", aria);
  b.addEventListener("click", onClick);
  return b;
}

// ---------- 読み上げ(Web Speech API。端末内で完結し外部通信しない) ----------
const speech = {
  supported: "speechSynthesis" in window,
  enabled: false,
  speak(text: string) {
    if (!this.supported || !this.enabled) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.9;
    speechSynthesis.speak(u);
  },
  stop() {
    if (this.supported) speechSynthesis.cancel();
  },
  get speaking() {
    return this.supported && this.enabled && (speechSynthesis.speaking || speechSynthesis.pending);
  },
};

// ---------- 一覧 ----------
function groupBlock(items: Scenario[], numbered: boolean) {
  const first = items[0];
  const block = h("div", "group-block");
  const head = h("div", "group-head");
  if (numbered && first.courseOrder) head.append(h("span", "course-no", String(first.courseOrder)));
  head.append(h("h3", "group-title", childTitle(first)));
  const chip = keywordChip(first);
  if (chip) head.append(chip);
  block.append(head);
  const grid = h("div", "card-grid");
  for (const s of items) grid.append(scenarioCard(s));
  block.append(grid);
  return block;
}

/** パターンのカード(pos を渡すと、そのポジションの目で見る再生画面へ) */
function scenarioCard(s: Scenario, pos?: PositionKey) {
  const a = h("a", "card");
  a.href = `#/s/${s.id}${pos ? `?pos=${pos}` : ""}`;
  const thumb = new Stage(s, "good", { mini: true });
  thumb.render(0, 1); // はじまりの場面だけ(動きを見せると答えが分かってしまう)
  a.append(thumb.el, h("span", "card-pattern", s.pattern));
  return a;
}

/** ミニピッチに、そのポジションがおもに動く所をぬる(味方は上へせめる) */
function positionPitch(p: PositionGuide) {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag: string, attrs: Record<string, string | number>, parent: Element) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    parent.append(e);
    return e;
  };
  const svgEl = document.createElementNS(NS, "svg");
  svgEl.setAttribute("viewBox", "-2 -5 54 75");
  svgEl.setAttribute("class", "pos-pitch");
  svgEl.setAttribute("role", "img");
  svgEl.setAttribute("aria-label", `${p.label}がおもに動く所`);
  el("rect", { x: 0, y: 0, width: 50, height: 68, class: "pp-field" }, svgEl);
  for (const a of p.area) el("rect", { x: a.x, y: a.y, width: a.w, height: a.h, rx: 2, class: "pp-area" }, svgEl);
  el("line", { x1: 0, y1: 34, x2: 50, y2: 34, class: "pp-line" }, svgEl);
  el("circle", { cx: 25, cy: 34, r: 6, class: "pp-line" }, svgEl);
  el("rect", { x: 13, y: 0, width: 24, height: 12, class: "pp-line" }, svgEl);
  el("rect", { x: 13, y: 56, width: 24, height: 12, class: "pp-line" }, svgEl);
  const label = el("text", { x: 25, y: -1.5, class: "pp-text", "text-anchor": "middle" }, svgEl);
  label.textContent = "▲ せめる方向";
  return svgEl;
}

/** 一覧の「ポジションから選ぶ」: ポジションを1つ選び、解説と場面ごとのシナリオを出す */
function positionSection(p: PositionGuide) {
  const section = h("section", "cat-section pos-section");
  const picker = h("div", "pos-picker");
  picker.setAttribute("role", "tablist");
  picker.setAttribute("aria-label", "ポジション");
  for (const x of POSITIONS) {
    const b = button(x.label, `pos-tab${x.key === p.key ? " active" : ""}`, () => {
      saveStored(POSITION_KEY, x.key);
      renderList();
    });
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(x.key === p.key));
    picker.append(b);
  }
  section.append(picker);

  const guide = h("div", "pos-guide");
  const text = h("div", "pos-guide-text");
  text.append(h("h2", "pos-name", `${p.label}(${p.numbers}番)`), h("p", "pos-one", p.one));
  const dl = h("dl", "pos-points");
  for (const [k, v] of [["🥅 せめる時", p.attack], ["🛡️ 守る時", p.defend], ["⚠️ よくあるミス", p.mistake]]) dl.append(h("dt", "", k), h("dd", "", v));
  text.append(dl, h("p", "pos-232", `指導者の方へ: ${p.note232}`));
  guide.append(positionPitch(p), text);
  section.append(guide);

  for (const scene of p.scenes) {
    const items = scene.ids.map((id) => scenarios.find((s) => s.id === id)).filter((s): s is Scenario => !!s);
    if (!items.length) continue;
    const block = h("div", "group-block");
    const head = h("div", "group-head");
    const kind = SCENE_KINDS[scene.kind];
    head.append(h("span", `scene-chip scene-${scene.kind}`, `${kind.icon} ${kind.label}`), h("h3", "group-title", scene.q));
    const grid = h("div", "card-grid");
    for (const s of items) grid.append(scenarioCard(s, p.key));
    block.append(head, grid);
    section.append(block);
  }
  return section;
}

function renderList() {
  document.title = "サッカー動き方ずかん";
  const view = readListView();
  const page = h("main", "list-page");
  const header = h("header", "list-header");
  header.append(h("h1", "app-title", "⚽ サッカー動き方ずかん"), h("p", "lead", "見たい場面を選んでね"));
  const switcher = h("div", "list-view-tabs");
  switcher.setAttribute("role", "tablist");
  for (const [v, label] of [["course", "おすすめの順番"], ["category", "種類ごと"], ["position", "ポジションから選ぶ"]] as const) {
    const b = button(label, `tab${view === v ? " active" : ""}`, () => {
      saveStored(LIST_VIEW_KEY, v);
      renderList();
    });
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(view === v));
    switcher.append(b);
  }
  const kwLegend = h("p", "kw-legend");
  kwLegend.append(h("span", "kw-legend-head", "合言葉:"), ...(Object.keys(KEYWORDS) as Keyword[]).map((k) => h("span", `kw-chip kw-${k}`, `${KEYWORDS[k].icon} ${KEYWORDS[k].label}`)));
  header.append(switcher);
  if (view !== "position") header.append(kwLegend);
  page.append(header);

  const groupsOf = (list: Scenario[]) => [...new Set(list.map((s) => s.group))].map((g) => list.filter((s) => s.group === g));
  if (view === "course") {
    // 合言葉と、U-10 の指導の順番に合わせた「おすすめの順番」
    const sorted = [...scenarios].sort((a, b) => (a.courseOrder ?? 99) - (b.courseOrder ?? 99) || a.id.localeCompare(b.id));
    let from = 0;
    for (const st of COURSE_STAGES) {
      const inStage = sorted.filter((s) => (s.courseOrder ?? 99) > from && (s.courseOrder ?? 99) <= st.upTo);
      from = st.upTo;
      if (!inStage.length) continue;
      const section = h("section", "cat-section");
      section.append(h("h2", "cat-title", st.label), h("p", "cat-lead", st.lead));
      for (const items of groupsOf(inStage)) section.append(groupBlock(items, true));
      page.append(section);
    }
  } else if (view === "position") {
    page.append(positionSection(readPosition()));
  } else {
    // 種類 → テーマ → パターン の順に並べる
    for (const cat of CATEGORIES) {
      const inCat = scenarios.filter((s) => s.category === cat.key);
      if (!inCat.length) continue;
      const section = h("section", "cat-section");
      section.append(h("h2", "cat-title", `${cat.icon} ${cat.label}`));
      for (const items of groupsOf(inCat)) section.append(groupBlock(items, false));
      page.append(section);
    }
  }
  app.replaceChildren(page);
}

// ---------- 再生画面 ----------
let disposeViewer: (() => void) | null = null;

function renderViewer(s: Scenario, me?: PositionGuide) {
  const lastStep = s.variants.good.steps.length - 1;
  const roles = roleLabels(s);

  // 時間の状態: pos は 0〜lastStep の実数。整数 k は「ステップ k の終わり」、k-1〜k の間は「ステップ k の途中」
  let mode: Mode = "good";
  let pos = 0;
  let playing = false;
  let stopAt = lastStep; // この位置に来たら止まる(「つぎへ」は1ステップ先)
  let holdUntil = 0; // ステップの終わりで文章を読むために待つ時刻
  let speedIndex = 0;
  let stages: Stage[] = [];
  let shownStep = -1;
  let rafId = 0;
  let lastTime = 0;
  // 答え(テーマ名)は、問いかけに答えてから出す。タイトルに答えが書いてあると予想にならないため
  let revealed = false;
  let chosen = -1; // 選択式の予想で選んだ番号

  const page = h("main", "viewer");
  const top = h("header", "viewer-header");
  const back = h("a", "back-link", "← もどる");
  back.href = "#/";
  const titleBox = h("div", "viewer-titlebox");
  const titleEl = h("h1", "viewer-title");
  titleBox.append(titleEl, h("span", "pattern-chip", s.pattern));
  const kw = keywordChip(s);
  if (kw) titleBox.append(kw);
  top.append(back, titleBox);
  // ポジションから選んで来た時は、どの丸が自分のポジションか分かるようにする
  const posQuery = me ? `?pos=${me.key}` : "";
  if (me) {
    page.classList.add("show-roles", ...me.roles.map((r) => `me-${r}`));
    top.append(h("p", "me-chip", `🧍 ${me.label}(${me.numbers}番)の目で見よう`));
  }
  // 同じテーマの別パターン(ボールの位置や守備の状況が違う)
  const siblings = siblingsOf(s);
  if (siblings.length > 1) {
    const nav = h("nav", "pattern-nav");
    nav.setAttribute("aria-label", "ほかのパターン");
    nav.append(h("span", "pattern-nav-label", "パターン:"));
    for (const x of siblings) {
      const a = h("a", `pattern-link${x.id === s.id ? " current" : ""}`, x.pattern);
      a.href = `#/s/${x.id}${posQuery}`;
      if (x.id === s.id) a.setAttribute("aria-current", "page");
      nav.append(a);
    }
    top.append(nav);
  }

  // 同じ場面を反対側(守る側/せめる側など)から見たシナリオ
  const other = s.counterpart && scenarios.find((x) => x.id === s.counterpart!.id);
  if (other) {
    const a = h("a", "counterpart-link");
    a.href = `#/s/${other.id}${posQuery}`;
    const text = h("span", "counterpart-text");
    // 味方はいつも上へせめるので、反対側のシナリオではピッチが 180 度回った形になる
    text.append(
      h("strong", "", s.counterpart!.label),
      h("small", "", `${childTitle(other)}(${other.pattern})`),
      h("small", "counterpart-note", "味方はいつも上へせめるので、向きが反対になるよ"),
    );
    a.append(h("span", "counterpart-icon", "⇄"), text);
    top.append(a);
  }

  const tabs = h("div", "mode-tabs");
  tabs.setAttribute("role", "tablist");
  const tabDefs: [Mode, string][] = [["good", "◎ お手本"], ["bad", "× よくあるミス"], ["compare", "ならべてくらべる"]];
  const tabButtons = tabDefs.map(([m, label]) => {
    const b = button(label, `tab tab-${m}`, () => setMode(m));
    b.setAttribute("role", "tab");
    tabs.append(b);
    return [m, b] as const;
  });

  const stageArea = h("div", "stage-area");

  // 問いかけ(Step 1)/ きょうの ポイント(最後)
  // 2 枚のパネルを同じ場所に重ね、カードの高さを大きい方に固定する。
  // 再生中もカードを消さない(問いかけを見ながら答えを確かめる)ので、下の操作ボタンの位置が変わらない
  const infoCard = h("div", "info-card");
  const panel = (cls: string, icon: string, head: string, text: string) => {
    const el = h("div", `info-panel ${cls}`);
    const body = h("div", "info-body");
    const p = h("p", "info-text");
    renderRichText(text, p, s.targetGrade, roles);
    body.append(h("p", "info-head", head), p);
    el.append(h("span", "info-icon", icon), body);
    return { el, body };
  };
  const qPanel = panel("info-q", "?", "考えてみよう", s.question);
  const pPanel = panel("info-p", "💡", "今日のポイント", s.keyPoint);
  if (s.ruleNote) qPanel.body.append(h("p", "info-rule", `※ ${s.ruleNote}`));
  // 選択式の予想: 選んでから答えを見る
  const choiceButtons = (s.choices ?? []).map((c, k) => {
    const b = button("", "choice", () => {
      chosen = k;
      updateUI();
    });
    const mark = h("span", "choice-mark", String.fromCharCode(65 + k));
    const text = h("span", "choice-text");
    renderRichText(c.text, text, s.targetGrade, roles);
    b.append(mark, text);
    return b;
  });
  const choiceHint = h("p", "choice-hint", "えらんだら、下の「▶ 答えを見る」をおそう");
  if (choiceButtons.length) {
    const choiceBox = h("div", "choices");
    choiceBox.setAttribute("role", "group");
    choiceBox.setAttribute("aria-label", "予想をえらぶ");
    choiceBox.append(...choiceButtons);
    qPanel.body.append(choiceBox, choiceHint);
  }
  // 選んだ予想への一言(答えを見た後に出す)。どれを選んでも高さが変わらないよう、全部を重ねておく
  const feedbacks = (s.choices ?? []).map((c, k) => {
    const f = h("p", `choice-feedback ${c.correct ? "ok" : "ng"}`);
    f.append(h("strong", "", c.correct ? `◎ ${String.fromCharCode(65 + k)} が正かい!` : `△ ${String.fromCharCode(65 + k)} をえらんだ人へ`), document.createTextNode(" "));
    const t = h("span");
    renderRichText(c.feedback, t, s.targetGrade, roles);
    f.append(t);
    return f;
  });
  if (feedbacks.length) {
    const fbStack = h("div", "choice-feedbacks");
    fbStack.setAttribute("aria-live", "polite");
    fbStack.append(...feedbacks);
    pPanel.body.append(fbStack);
  }
  const nextTarget = s.next && scenarios.find((x) => x.id === s.next!.id);
  const nextLink = h("a", "next-link");
  if (nextTarget) {
    nextLink.href = `#/s/${nextTarget.id}${posQuery}`;
    nextLink.append(h("strong", "", `▶ つづき: ${s.next!.label}`), h("small", "", `${childTitle(nextTarget)}(${nextTarget.pattern})`));
    pPanel.body.append(nextLink);
  }
  infoCard.append(qPanel.el, pPanel.el);

  const dots = h("ol", "step-dots");
  const dotButtons = STEP_LABELS.map((label, i) => {
    const li = h("li");
    const b = button(`${i + 1}`, "dot", () => seek(i), `ステップ${i + 1} ${label}`);
    li.append(b, h("span", "dot-label", label));
    dots.append(li);
    return b;
  });

  const scrubber = h("input", "scrubber");
  scrubber.type = "range";
  scrubber.min = "0";
  scrubber.max = String(lastStep);
  scrubber.step = "0.01";
  scrubber.value = "0";
  scrubber.setAttribute("aria-label", "時間を動かす");
  scrubber.addEventListener("input", () => seek(Number(scrubber.value)));

  const controls = h("div", "controls");
  const restartBtn = button("⏮", "ctrl", () => seek(0), "最初から");
  const prevBtn = button("◀", "ctrl", () => seek(Number.isInteger(pos) ? Math.max(0, pos - 1) : Math.floor(pos)), "もどる");
  const playBtn = button("", "ctrl ctrl-play", () => (playing ? pause() : play()));
  const nextBtn = button("▶", "ctrl", () => stepForward(), "次へ");
  const speedBtn = button("", "ctrl ctrl-speed", () => {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    updateUI();
  });
  const speakBtn = button("", "ctrl ctrl-speak", () => {
    speech.enabled = !speech.enabled;
    if (speech.enabled) speakCurrent();
    else speech.stop();
    updateUI();
  });
  // ことば(このシナリオに出てくる用語の説明)
  const terms = termsIn([s.question, s.keyPoint, ...Object.values(s.variants).flatMap((v) => v.steps.map((st) => st.explanation))]);
  const wordsPanel = h("dl", "words-panel");
  wordsPanel.hidden = true;
  for (const t of terms) wordsPanel.append(h("dt", "", t.word), h("dd", "", t.text));
  const wordsBtn = button("📖 ことば", "ctrl ctrl-words", () => {
    wordsPanel.hidden = !wordsPanel.hidden;
    wordsBtn.setAttribute("aria-expanded", String(!wordsPanel.hidden));
  });
  wordsBtn.setAttribute("aria-expanded", "false");
  controls.append(restartBtn, prevBtn, playBtn, nextBtn, speedBtn);
  if (speech.supported) controls.append(speakBtn);
  if (terms.length) controls.append(wordsBtn);

  const legend = h("div", "legend");
  legend.innerHTML = `
    <span class="chip home">味方</span><span class="chip away">相手</span>
    <span class="lg"><svg viewBox="0 0 24 8" aria-hidden="true"><line x1="1" y1="4" x2="18" y2="4" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/><path d="M17,0 L23,4 L17,8z" fill="#fff"/></svg>走る</span>
    <span class="lg"><svg viewBox="0 0 24 8" aria-hidden="true"><line x1="1" y1="4" x2="18" y2="4" stroke="#ffd400" stroke-width="2.6"/><path d="M17,0 L23,4 L17,8z" fill="#ffd400"/></svg>パス</span>
    <span class="lg"><svg viewBox="0 0 24 8" aria-hidden="true"><line x1="2" y1="4" x2="18" y2="4" stroke="#fff3b0" stroke-width="2.6" stroke-dasharray="0.1 4" stroke-linecap="round"/><path d="M17,0 L23,4 L17,8z" fill="#fff3b0"/></svg>ドリブル</span>
    <span class="lg"><svg viewBox="0 0 24 8" aria-hidden="true"><line x1="1" y1="4" x2="18" y2="4" stroke="#ff3b30" stroke-width="2" stroke-dasharray="4 3"/><path d="M17,0 L23,4 L17,8z" fill="#ff3b30"/></svg>ミスの動き</span>
    <span class="lg lg-look" hidden><svg viewBox="0 0 24 12" aria-hidden="true"><path d="M2,6 L20,0.5 A12,12 0 0 1 20,11.5 Z" fill="rgba(255,244,160,0.6)" stroke="#c9b800" stroke-width="0.8" stroke-dasharray="1.6 1"/></svg>見た方向</span>
    <span class="lg lg-ghost" hidden><svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="none" stroke="#9cc3ff" stroke-width="1.2" stroke-dasharray="2 1.4"/></svg>お手本の位置</span>`;
  const ghostLegend = legend.querySelector<HTMLElement>(".lg-ghost")!;
  // 見た方向(look)は使うシナリオのときだけ凡例に出す
  legend.querySelector<HTMLElement>(".lg-look")!.hidden = !Object.values(s.variants).some((v) => v.steps.some((st) => st.overlays.some((o) => o.type === "look")));

  // 問いかけ・ステップ表示・時間バー・操作ボタン・凡例。1パターン表示ではピッチの横、比較表示ではピッチの下に置く
  const dock = h("div", "dock");
  dock.append(infoCard, dots, scrubber, controls, wordsPanel, legend);

  const note = h("details", "coach-note");
  note.append(h("summary", "", "保護者・指導者の方へ(指導メモ)"), h("p", "note-theme", `テーマ: ${s.theme}`));
  if (s.coachNote) note.append(h("p", "", s.coachNote));
  note.append(h("p", "note-formation", s.teams.home.formation === "3-3-1"
    ? "※ 味方・相手とも 3-3-1 の形で描いています。2-3-2 や 3-2-2 など、ほかの形のチームでも、ここで見せている考え方(原則)は同じです。"
    : `※ 味方は ${s.teams.home.formation}、相手は ${s.teams.away.formation} の形で描いています。形がちがっても、考え方(原則)は同じです。`));
  // ポジション表示(背番号だけだと、自分のチームに置きかえにくい子のために)
  const roleToggle = h("label", "role-toggle");
  const roleCheck = h("input");
  roleCheck.type = "checkbox";
  roleCheck.checked = !!me;
  roleCheck.addEventListener("change", () => page.classList.toggle("show-roles", roleCheck.checked));
  roleToggle.append(roleCheck, document.createTextNode(" ピッチと説明文に、ポジション(左MF・真ん中DF など)を表示する"));
  note.append(roleToggle);
  note.append(h("p", "note-point", `今日のポイント: ${plainText(s.keyPoint, s.targetGrade)}`));
  if (s.coachCue) note.append(h("p", "note-cue", `声かけの例: 「${s.coachCue}」`));
  if (s.drills?.length) {
    const list = h("ul", "note-drills");
    for (const d of s.drills) {
      const li = h("li");
      const meta = h("dl", "drill-meta");
      for (const [k, v] of [["人数", d.players], ["広さ", d.area], ["ルール", d.rule], ["成功の目安", d.success]]) meta.append(h("dt", "", k), h("dd", "", v));
      li.append(h("strong", "", d.title), meta);
      if (d.note) li.append(h("span", "drill-note", d.note));
      list.append(li);
    }
    note.append(h("p", "note-head", "関連する練習"), list);
  }

  page.append(top, tabs, stageArea, dock, note);
  app.replaceChildren(page);

  // ---------- 時間の進め方 ----------
  const speed = () => SPEEDS[speedIndex].value;
  /** pos から「表示するステップ i と進捗 t」 */
  const frameOf = (p: number) => {
    const i = Math.ceil(p - 1e-9);
    return { i, t: i === 0 ? 1 : 1 - (i - p) };
  };

  function renderAll() {
    const { i, t } = frameOf(pos);
    stages.forEach((st) => st.render(i, t));
    if (i !== shownStep) {
      shownStep = i;
      updateUI();
      speakCurrent();
    }
    scrubber.value = String(pos);
    if (pos > 0 && !revealed) {
      revealed = true;
      updateUI();
    }
  }

  function tick(now: number) {
    const dt = lastTime ? now - lastTime : 0;
    lastTime = now;
    // ステップの終わりでは、読む時間と読み上げの終わりを待つ(アニメーション中は読み上げと並行して動かす)
    const waiting = Number.isInteger(pos) && (now < holdUntil || speech.speaking);
    if (playing && !waiting) {
      const k = Math.floor(pos + 1e-9) + 1; // 次に向かうステップ
      // 比較表示では長い方の時間に合わせ、2つのピッチが同じタイミングで動くようにする
      const dur = Math.max(...stages.map((st) => st.durationOf(k))) / speed();
      pos = prefersReducedMotion() || dur === 0 ? k : Math.min(k, pos + dt / dur);
      if (pos >= k - 1e-9) {
        pos = k;
        if (k >= stopAt) {
          playing = false;
          updateUI();
        } else {
          holdUntil = now + READ_PAUSE_MS / speed();
        }
      }
      renderAll();
    }
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    speech.stop();
    if (s.choices?.length && chosen < 0 && pos === 0 && !revealed) return; // 選んでから答えを見る
    revealed = true;
    if (pos === 0 || pos >= lastStep) revealPitch();
    if (pos >= lastStep) {
      pos = 0;
      holdUntil = performance.now() + READ_PAUSE_MS / speed();
    } else {
      holdUntil = 0; // 「こたえを みる」・再開はすぐに動かす
    }
    stopAt = lastStep;
    playing = true;
    renderAll();
    updateUI();
  }

  function pause() {
    playing = false; // 途中のコマのまま止める(指導者が「この瞬間」を見せられる)
    updateUI();
  }

  function stepForward() {
    if (pos >= lastStep) return;
    speech.stop();
    stopAt = Math.floor(pos + 1e-9) + 1;
    holdUntil = 0;
    playing = true;
    updateUI();
  }

  function seek(p: number) {
    playing = false;
    speech.stop();
    pos = Math.min(lastStep, Math.max(0, p));
    renderAll();
    updateUI();
  }

  // 問いかけカードの置き場所: PC 幅の 1 パターン表示ではピッチの右(操作ボタンの上)。
  // 狭い画面・比較表示では操作エリアが画面下に固定されるので、そこに入れるとピッチを隠してしまう。ピッチの上に置く
  const wide = window.matchMedia("(min-width: 900px)");
  // 操作エリアも同じ。狭い画面ではピッチの枠の外に置く(枠の中だと、開いた直後に画面下へ固定されず見えない)
  function placeDock() {
    const side = mode !== "compare" && wide.matches;
    if (side) {
      stages[0].el.append(dock);
      dock.prepend(infoCard);
    } else {
      stageArea.after(dock);
      stageArea.before(infoCard);
    }
  }
  wide.addEventListener("change", placeDock);

  // 狭い画面で答えを見始めたら、ピッチが操作エリアに隠れない位置まで画面を送る(ボタンは画面下に固定されたまま)
  function revealPitch() {
    if (mode !== "compare" && wide.matches) return;
    const r = stages[0].el.querySelector(".pitch")!.getBoundingClientRect();
    const dockTop = dock.getBoundingClientRect().top;
    // ピッチの下が見えるだけ送る。ただしピッチの上が画面から出ない範囲、かつ操作エリアの固定が外れない範囲まで
    // (送りすぎると操作エリアが本来の位置にもどり、ボタンが上へ動いてしまう)
    const after = dock.nextElementSibling?.getBoundingClientRect().top ?? Infinity;
    const delta = Math.min(r.bottom - dockTop + 8, r.top - 8, after - window.innerHeight - 1);
    if (delta <= 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
  }

  function setMode(m: Mode) {
    mode = m;
    // お手本・ミス・比較を切りかえたら、必ず「1. はじまり」から見直す(途中のステップのまま切りかわると流れが分からなくなる)
    playing = false;
    speech.stop();
    pos = 0;
    const keys: VariantKey[] = m === "compare" ? ["good", "bad"] : [m];
    stages = keys.map((k, idx) => new Stage(s, k, {
      live: idx === 0,
      ghost: m === "compare" && k === "bad" ? s.variants.good : undefined,
    }));
    stageArea.className = `stage-area mode-${m}`;
    stageArea.replaceChildren(...stages.map((st) => st.el));
    placeDock();
    ghostLegend.hidden = m !== "compare";
    shownStep = -1;
    renderAll();
    updateUI();
  }

  function speakCurrent() {
    if (!speech.enabled) return;
    const { i } = frameOf(pos);
    const parts = stages.map((st) => (stages.length > 1 ? `${st.variant.label}。` : "") + st.spokenText(i));
    if (i === 0) parts.push(plainText(s.question, s.targetGrade));
    if (i === 0 && pos === 0 && s.choices?.length) parts.push(...s.choices.map((c, k) => `${String.fromCharCode(65 + k)}、${plainText(c.text, s.targetGrade)}`));
    if (i === lastStep && Number.isInteger(pos)) parts.push(`今日のポイント。${plainText(s.keyPoint, s.targetGrade)}`);
    speech.speak(parts.join("。"));
  }

  function updateUI() {
    const { i } = frameOf(pos);
    const atEnd = pos >= lastStep;
    titleEl.textContent = revealed ? s.title : `? ${childTitle(s)}`;
    titleEl.classList.toggle("asking", !revealed);
    document.title = `${revealed ? s.title : childTitle(s)} | サッカー動き方ずかん`;
    for (const [m, b] of tabButtons) {
      b.classList.toggle("active", m === mode);
      b.setAttribute("aria-selected", String(m === mode));
    }
    dotButtons.forEach((b, k) => {
      b.classList.toggle("done", k < i);
      b.classList.toggle("current", k === i);
      if (k === i) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });

    // 問いかけ(はじまりで止まっているとき・再生中)/ ポイント(最後)。カードは消さず、中身だけ切りかえる
    const asking = pos === 0 && !playing;
    const showPoint = atEnd;
    infoCard.className = `info-card ${showPoint ? "point" : "question"}${!asking && !showPoint ? " watching" : ""}${mode === "compare" ? " compact" : ""}`;
    qPanel.el.classList.toggle("off", showPoint);
    pPanel.el.classList.toggle("off", !showPoint);
    qPanel.el.setAttribute("aria-hidden", String(showPoint));
    pPanel.el.setAttribute("aria-hidden", String(!showPoint));
    choiceButtons.forEach((b, k) => {
      b.classList.toggle("selected", k === chosen);
      b.setAttribute("aria-pressed", String(k === chosen));
      b.disabled = !asking; // 再生が始まったら予想は変えられない(最初にもどれば選び直せる)
    });
    choiceHint.classList.toggle("off", !asking || chosen >= 0);
    // 選んだ予想への一言は、答えを見た後(最後)に出す
    feedbacks.forEach((f, k) => f.classList.toggle("off", !(showPoint && k === chosen)));
    const needChoice = asking && !!choiceButtons.length && chosen < 0;
    playBtn.disabled = needChoice;

    playBtn.textContent = playing ? "⏸ 止める" : atEnd ? "↻ もう一度" : pos === 0 ? "▶ 答えを見る" : "▶ スタート";
    playBtn.classList.toggle("playing", playing);
    prevBtn.disabled = pos === 0;
    nextBtn.disabled = atEnd;
    restartBtn.disabled = pos === 0;
    speedBtn.textContent = SPEEDS[speedIndex].label;
    speedBtn.setAttribute("aria-label", `速さ: ${SPEEDS[speedIndex].label.slice(2)}`);
    speakBtn.textContent = speech.enabled ? "🔊 読み上げ オン" : "🔈 読み上げ オフ";
    speakBtn.classList.toggle("on", speech.enabled);
  }

  const onKey = (e: KeyboardEvent) => {
    // ボタンや時間バーにフォーカスがあるときは、その部品の操作に任せる(二重操作防止)
    if (e.target instanceof HTMLElement && e.target.closest("button, summary, a, input")) return;
    if (e.key === " ") {
      e.preventDefault();
      if (playing) pause();
      else play();
    } else if (e.key === "ArrowRight") stepForward();
    else if (e.key === "ArrowLeft") seek(Number.isInteger(pos) ? Math.max(0, pos - 1) : Math.floor(pos));
  };
  window.addEventListener("keydown", onKey);
  disposeViewer = () => {
    cancelAnimationFrame(rafId);
    speech.stop();
    window.removeEventListener("keydown", onKey);
    wide.removeEventListener("change", placeDock);
  };

  setMode("good");
  rafId = requestAnimationFrame(tick);
}

// ---------- ルーティング(ハッシュ方式: GitHub Pages でもそのまま動く) ----------
function route() {
  disposeViewer?.();
  disposeViewer = null;
  const m = location.hash.match(/^#\/s\/([a-z0-9-]+)(?:\?pos=([a-z]+))?$/);
  const s = m && scenarios.find((x) => x.id === m[1]);
  if (s) renderViewer(s, positionOf(m[2]));
  else renderList();
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
