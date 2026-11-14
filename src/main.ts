import "./style.css";
import { Stage } from "./stage";
import type { Scenario, VariantKey } from "./types";

// scenarios/*.json をビルド時に同梱する(実行時の外部通信なし)
const modules = import.meta.glob<Scenario>("../scenarios/*.json", { eager: true, import: "default" });
const scenarios = Object.values(modules).sort((a, b) => a.id.localeCompare(b.id));

const STEP_LABELS = ["はじまり", "うごきだし", "1プレーめ", "つぎの プレー", "けっか"];
const READ_PAUSE_MS = 2200; // 自動再生でステップ間に文章を読む時間(ふつうの速さ)
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

// ---------- 一覧 ----------
function renderList() {
  document.title = "サッカー うごきかた ずかん";
  const page = h("main", "list-page");
  const header = h("header", "list-header");
  header.append(h("h1", "app-title", "⚽ サッカー うごきかた ずかん"), h("p", "lead", "みたい シーンを えらんでね"));
  const grid = h("div", "card-grid");
  for (const s of scenarios) {
    const a = h("a", "card");
    a.href = `#/s/${s.id}`;
    const thumb = new Stage(s, "good", { mini: true });
    thumb.show(1);
    a.append(thumb.el, h("span", "card-title", s.title), h("span", "card-theme", s.theme));
    grid.append(a);
  }
  page.append(header, grid);
  app.replaceChildren(page);
}

// ---------- 再生画面 ----------
let disposeViewer: (() => void) | null = null;

function renderViewer(s: Scenario) {
  document.title = `${s.title} | サッカー うごきかた ずかん`;
  const lastStep = s.variants.good.steps.length - 1;
  let mode: Mode = "good";
  let step = 0;
  let speed = 1;
  let playing = false;
  let gen = 0; // 操作のたびに増やし、古いアニメーションや待機を打ち切る
  let stages: Stage[] = [];

  const page = h("main", "viewer");
  const top = h("header", "viewer-header");
  const back = h("a", "back-link", "← もどる");
  back.href = "#/";
  top.append(back, h("h1", "viewer-title", s.title));

  const tabs = h("div", "mode-tabs");
  tabs.setAttribute("role", "tablist");
  const tabDefs: [Mode, string][] = [["good", "◎ おてほん"], ["bad", "× よくある ミス"], ["compare", "ならべて くらべる"]];
  const tabButtons = tabDefs.map(([m, label]) => {
    const b = button(label, `tab tab-${m}`, () => setMode(m));
    b.setAttribute("role", "tab");
    tabs.append(b);
    return [m, b] as const;
  });

  const stageArea = h("div", "stage-area");

  const dots = h("ol", "step-dots");
  const dotButtons = STEP_LABELS.map((label, i) => {
    const li = h("li");
    const b = button(`${i + 1}`, "dot", () => goTo(i), `${i + 1}ばんめ ${label}`);
    li.append(b, h("span", "dot-label", label));
    dots.append(li);
    return b;
  });

  const controls = h("div", "controls");
  const restartBtn = button("⏮", "ctrl", () => goTo(0), "はじめから");
  const prevBtn = button("◀", "ctrl", () => goTo(Math.max(0, step - 1)), "もどる");
  const playBtn = button("▶ さいせい", "ctrl ctrl-play", () => (playing ? pause() : play()));
  const nextBtn = button("▶", "ctrl", () => void next(), "つぎへ");
  const speedBtn = button("", "ctrl ctrl-speed", () => {
    speed = speed === 1 ? 0.5 : 1;
    updateUI();
  });
  controls.append(restartBtn, prevBtn, playBtn, nextBtn, speedBtn);

  const legend = h("div", "legend");
  legend.innerHTML =
    '<span class="chip home">みかた</span><span class="chip away">あいて</span><span class="legend-dir">みかたは ↑ に せめるよ</span>';

  // ステップ表示・操作ボタン・凡例。1パターン表示ではピッチの横、比較表示ではピッチの下に置く
  const dock = h("div", "dock");
  dock.append(dots, controls, legend);

  const note = h("details", "coach-note");
  note.append(h("summary", "", "おとなの かたへ(しどう メモ)"), h("p", "note-theme", `テーマ: ${s.theme}`));
  if (s.coachNote) note.append(h("p", "", s.coachNote));

  page.append(top, tabs, stageArea, dock, note);
  app.replaceChildren(page);

  function setMode(m: Mode) {
    gen++;
    playing = false;
    mode = m;
    const keys: VariantKey[] = m === "compare" ? ["good", "bad"] : [m];
    stages = keys.map((k) => new Stage(s, k));
    stageArea.className = `stage-area mode-${m}`;
    stageArea.replaceChildren(...stages.map((st) => st.el));
    if (m === "compare") stageArea.after(dock);
    else stages[0].el.append(dock);
    stages.forEach((st) => st.show(step));
    updateUI();
  }

  function goTo(i: number) {
    gen++;
    playing = false;
    step = i;
    stages.forEach((st) => st.show(i));
    updateUI();
  }

  /** 1ステップ進める。途中で別の操作が入ったら false */
  async function next(fromPlay = false): Promise<boolean> {
    if (step >= lastStep) return false;
    if (!fromPlay) {
      gen++;
      playing = false;
    }
    const g = gen;
    step += 1;
    updateUI();
    await Promise.all(stages.map((st) => st.animate(step, speed, () => g !== gen)));
    return g === gen;
  }

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function play() {
    gen++;
    const g = gen;
    playing = true;
    if (step >= lastStep) {
      step = 0;
      stages.forEach((st) => st.show(0));
    }
    updateUI();
    while (g === gen && step < lastStep) {
      await wait(READ_PAUSE_MS / speed);
      if (g !== gen) return;
      if (!(await next(true))) return;
    }
    if (g === gen) {
      playing = false;
      updateUI();
    }
  }

  function pause() {
    gen++;
    playing = false;
    stages.forEach((st) => st.show(step)); // 途中のコマで止めず、そのステップの終わりの状態を表示
    updateUI();
  }

  function updateUI() {
    for (const [m, b] of tabButtons) {
      b.classList.toggle("active", m === mode);
      b.setAttribute("aria-selected", String(m === mode));
    }
    dotButtons.forEach((b, i) => {
      b.classList.toggle("done", i < step);
      b.classList.toggle("current", i === step);
      if (i === step) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    playBtn.textContent = playing ? "⏸ とめる" : step >= lastStep ? "↻ もういちど" : "▶ さいせい";
    playBtn.classList.toggle("playing", playing);
    prevBtn.disabled = step === 0;
    nextBtn.disabled = step >= lastStep;
    restartBtn.disabled = step === 0;
    speedBtn.textContent = speed === 1 ? "🐇 ふつう" : "🐢 ゆっくり";
    speedBtn.setAttribute("aria-label", `はやさ: ${speed === 1 ? "ふつう" : "ゆっくり"}`);
  }

  const onKey = (e: KeyboardEvent) => {
    // ボタンにフォーカスがあるときのスペースは、ボタン自体のクリックに任せる(二重操作防止)
    if (e.target instanceof HTMLElement && e.target.closest("button, summary, a")) return;
    if (e.key === " ") {
      e.preventDefault();
      if (playing) pause();
      else void play();
    } else if (e.key === "ArrowRight") void next();
    else if (e.key === "ArrowLeft") goTo(Math.max(0, step - 1));
  };
  window.addEventListener("keydown", onKey);
  disposeViewer = () => {
    gen++;
    window.removeEventListener("keydown", onKey);
  };

  setMode("good");
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
