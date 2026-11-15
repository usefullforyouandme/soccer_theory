import "./style.css";
import { termsIn } from "./glossary";
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
  { upTo: 99, label: "ステップ3 場面ごとの動き", lead: "サイドチェンジ・キーパー・スローイン・コーナー" },
];
const LIST_VIEW_KEY = "soccer-theory:list-view";
const readListView = (): "course" | "category" => {
  try {
    return localStorage.getItem(LIST_VIEW_KEY) === "category" ? "category" : "course";
  } catch {
    return "course";
  }
};
const saveListView = (v: string) => {
  try {
    localStorage.setItem(LIST_VIEW_KEY, v);
  } catch {
    // 保存できない環境(プライベートモードなど)では毎回「おすすめの順番」から
  }
};
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
  for (const s of items) {
    const a = h("a", "card");
    a.href = `#/s/${s.id}`;
    const thumb = new Stage(s, "good", { mini: true });
    thumb.render(0, 1); // はじまりの場面だけ(動きを見せると答えが分かってしまう)
    a.append(thumb.el, h("span", "card-pattern", s.pattern));
    grid.append(a);
  }
  block.append(grid);
  return block;
}

function renderList() {
  document.title = "サッカー動き方ずかん";
  const view = readListView();
  const page = h("main", "list-page");
  const header = h("header", "list-header");
  header.append(h("h1", "app-title", "⚽ サッカー動き方ずかん"), h("p", "lead", "見たい場面を選んでね"));
  const switcher = h("div", "list-view-tabs");
  switcher.setAttribute("role", "tablist");
  for (const [v, label] of [["course", "おすすめの順番"], ["category", "種類ごと"]] as const) {
    const b = button(label, `tab${view === v ? " active" : ""}`, () => {
      saveListView(v);
      renderList();
    });
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(view === v));
    switcher.append(b);
  }
  const kwLegend = h("p", "kw-legend");
  kwLegend.append(h("span", "kw-legend-head", "合言葉:"), ...(Object.keys(KEYWORDS) as Keyword[]).map((k) => h("span", `kw-chip kw-${k}`, `${KEYWORDS[k].icon} ${KEYWORDS[k].label}`)));
  header.append(switcher, kwLegend);
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

function renderViewer(s: Scenario) {
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
  // 同じテーマの別パターン(ボールの位置や守備の状況が違う)
  const siblings = siblingsOf(s);
  if (siblings.length > 1) {
    const nav = h("nav", "pattern-nav");
    nav.setAttribute("aria-label", "ほかのパターン");
    nav.append(h("span", "pattern-nav-label", "パターン:"));
    for (const x of siblings) {
      const a = h("a", `pattern-link${x.id === s.id ? " current" : ""}`, x.pattern);
      a.href = `#/s/${x.id}`;
      if (x.id === s.id) a.setAttribute("aria-current", "page");
      nav.append(a);
    }
    top.append(nav);
  }

  // 同じ場面を反対側(守る側/せめる側など)から見たシナリオ
  const other = s.counterpart && scenarios.find((x) => x.id === s.counterpart!.id);
  if (other) {
    const a = h("a", "counterpart-link");
    a.href = `#/s/${other.id}`;
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
  const infoCard = h("div", "info-card");
  const infoIcon = h("span", "info-icon");
  const infoBody = h("div", "info-body");
  const infoHead = h("p", "info-head");
  const infoText = h("p", "info-text");
  infoBody.append(infoHead, infoText);
  const ruleNote = h("p", "info-rule");
  if (s.ruleNote) ruleNote.textContent = `※ ${s.ruleNote}`;
  // 選択式の予想: 選んでから答えを見る
  const choiceBox = h("div", "choices");
  choiceBox.setAttribute("role", "group");
  choiceBox.setAttribute("aria-label", "予想をえらぶ");
  const choiceButtons = (s.choices ?? []).map((c, k) => {
    const b = button("", "choice", () => {
      chosen = k;
      updateUI();
    });
    const mark = h("span", "choice-mark", String.fromCharCode(65 + k));
    const text = h("span", "choice-text");
    renderRichText(c.text, text, s.targetGrade, roles);
    b.append(mark, text);
    choiceBox.append(b);
    return b;
  });
  const feedback = h("p", "choice-feedback");
  feedback.setAttribute("aria-live", "polite");
  const nextTarget = s.next && scenarios.find((x) => x.id === s.next!.id);
  const nextLink = h("a", "next-link");
  if (nextTarget) {
    nextLink.href = `#/s/${nextTarget.id}`;
    nextLink.append(h("strong", "", `▶ つづき: ${s.next!.label}`), h("small", "", `${childTitle(nextTarget)}(${nextTarget.pattern})`));
  }
  infoBody.append(ruleNote, choiceBox, feedback, nextLink);
  const answerBtn = button("▶ 答えを見る", "answer-btn", () => play());
  infoCard.append(infoIcon, infoBody, answerBtn);

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
    if (m === "compare") stageArea.after(dock);
    else stages[0].el.append(dock);
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

    // 問いかけ(はじまりで止まっているとき)/ ポイント(最後)
    const asking = pos === 0 && !playing;
    infoCard.hidden = !(asking || atEnd);
    infoCard.className = `info-card ${asking ? "question" : "point"}`;
    infoIcon.textContent = asking ? "?" : "💡";
    infoHead.textContent = asking ? "考えてみよう" : "今日のポイント";
    renderRichText(asking ? s.question : s.keyPoint, infoText, s.targetGrade, roles);
    ruleNote.hidden = !asking || !s.ruleNote;
    choiceBox.hidden = !asking || !choiceButtons.length;
    choiceButtons.forEach((b, k) => {
      b.classList.toggle("selected", k === chosen);
      b.setAttribute("aria-pressed", String(k === chosen));
    });
    // 選んだ予想への一言は、答えを見た後(最後)に出す
    const c = chosen >= 0 ? s.choices![chosen] : null;
    feedback.hidden = !(atEnd && c);
    if (c && atEnd) {
      feedback.className = `choice-feedback ${c.correct ? "ok" : "ng"}`;
      feedback.replaceChildren(h("strong", "", c.correct ? `◎ ${String.fromCharCode(65 + chosen)} が正かい!` : `△ ${String.fromCharCode(65 + chosen)} をえらんだ人へ`), document.createTextNode(" "));
      const t = h("span");
      renderRichText(c.feedback, t, s.targetGrade, roles);
      feedback.append(t);
    }
    nextLink.hidden = !(atEnd && nextTarget);
    answerBtn.hidden = !asking;
    const needChoice = asking && !!choiceButtons.length && chosen < 0;
    answerBtn.disabled = needChoice;
    answerBtn.textContent = needChoice ? "えらんでから答えを見よう" : "▶ 答えを見る";
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
  };

  setMode("good");
  rafId = requestAnimationFrame(tick);
}

// ---------- ルーティング(ハッシュ方式: GitHub Pages でもそのまま動く) ----------
function route() {
  disposeViewer?.();
  disposeViewer = null;
  const m = location.hash.match(/^#\/s\/([a-z0-9-]+)$/);
  const s = m && scenarios.find((x) => x.id === m[1]);
  if (s) renderViewer(s);
  else renderList();
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
