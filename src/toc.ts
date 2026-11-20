// 一覧ページの「もくじ」: 右はしに、ステップ・種類とテーマへのリンクを置く。
// - PC 幅(1100px 以上): ページの右に追従するもくじ(今見ている所を強調し、その区分だけ開く)
// - それより狭い時: 右はしの細い帯(区分のボタン+もくじを開くボタン)。帯を指でなぞると区分を次々に移れる
// リンクはボタンにする(ハッシュ方式のルーティングなので、#id のリンクは使えない)
import { prefersReducedMotion } from "./stage";

type Item = { el: HTMLElement; focusEl: HTMLElement; label: string; badge: string; sec: number };
type Sec = { el: HTMLElement; focusEl: HTMLElement; label: string; short: string; items: number[] };
type RailEntry = { label: string; short: string; target: Item | Sec; first: number; last: number };

const WIDE = "(min-width: 1100px)";
/** 見出しがこの高さ(画面の上からの割合)より上に来たら、その項目を「今見ている所」にする */
const SPY_LINE = 0.3;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function btn(className: string, onClick: () => void, aria?: string) {
  const b = el("button", className);
  b.type = "button";
  if (aria) b.setAttribute("aria-label", aria);
  b.addEventListener("click", onClick);
  return b;
}

/** 一覧ページ(.cat-section と .group-block)から、もくじを作ってページに付ける。戻り値で後始末する */
export function attachToc(page: HTMLElement): () => void {
  const secs: Sec[] = [];
  const items: Item[] = [];
  for (const s of page.querySelectorAll<HTMLElement>(".cat-section")) {
    const head = s.querySelector<HTMLElement>(".cat-title, .pos-name");
    const sec: Sec = { el: s, focusEl: head ?? s, label: s.dataset.tocLabel ?? head?.textContent ?? "", short: s.dataset.tocShort ?? "", items: [] };
    for (const b of s.querySelectorAll<HTMLElement>(".group-block")) {
      const title = b.querySelector<HTMLElement>(".group-title");
      sec.items.push(items.length);
      items.push({ el: b, focusEl: title ?? b, label: title?.textContent ?? "", badge: b.dataset.tocBadge ?? "", sec: secs.length });
    }
    if (sec.items.length) secs.push(sec);
  }
  if (items.length < 2) return () => {};
  for (const x of [...secs, ...items]) x.focusEl.tabIndex = -1;

  // 帯のボタン: 区分が 2 つ以上なら区分ごと。1 つだけ(ポジション)なら、項目のしるし(場面の種類)ごとに最初の項目へ
  const rail: RailEntry[] = [];
  if (secs.length > 1) {
    for (const s of secs) rail.push({ label: s.label, short: s.short || String(rail.length + 1), target: s, first: s.items[0], last: s.items[s.items.length - 1] });
  } else {
    items.forEach((it, i) => {
      const prev = rail[rail.length - 1];
      if (prev && prev.short === it.badge) prev.last = i;
      else rail.push({ label: it.label, short: it.badge || String(rail.length + 1), target: it, first: i, last: i });
    });
  }

  const nav = el("nav", "toc");
  nav.setAttribute("aria-label", "もくじ");

  // ---------- 右に追従するもくじ(PC 幅)とシート(狭い幅)の中身 ----------
  const itemBtns: HTMLButtonElement[][] = [[], []];
  const secLis: HTMLLIElement[][] = [[], []];
  const buildList = (k: 0 | 1, onPick: () => void) => {
    const ol = el("ol", "toc-list");
    secs.forEach((s, si) => {
      const li = el("li", "toc-sec");
      const head = btn("toc-sec-btn", () => {
        onPick();
        jump(s.el, s.focusEl, s.items[0]);
      });
      if (s.short) head.append(el("span", "toc-short", s.short));
      head.append(el("span", "toc-sec-label", s.label), el("span", "toc-n", `${s.items.length}`));
      head.querySelector(".toc-n")?.setAttribute("aria-label", `${s.items.length} テーマ`);
      const wrap = el("div", "toc-items-wrap");
      const sub = el("ol", "toc-items");
      for (const i of s.items) {
        const it = items[i];
        const b = btn("toc-item", () => {
          onPick();
          jump(it.el, it.focusEl, i);
        });
        if (it.badge) b.append(el("span", "toc-badge", it.badge));
        b.append(el("span", "toc-text", it.label));
        const ili = el("li");
        ili.append(b);
        sub.append(ili);
        itemBtns[k][i] = b;
      }
      wrap.append(sub);
      li.append(head, wrap);
      ol.append(li);
      secLis[k][si] = li;
    });
    return ol;
  };

  const panel = el("div", "toc-panel");
  const panelHead = el("div", "toc-head");
  const count = el("span", "toc-count");
  panelHead.append(el("span", "toc-title", "もくじ"), count);
  const progress = el("div", "toc-progress");
  const bar = el("span");
  progress.append(bar);
  const panelList = buildList(0, () => {});
  const toTop = btn("toc-top", () => jumpTop());
  toTop.textContent = "↑ いちばん上へ";
  panel.append(panelHead, progress, panelList, toTop);

  // ---------- 狭い幅: 右はしの帯 + もくじのシート ----------
  const railEl = el("div", "toc-rail");
  const railBtns = rail.map((r) => {
    const b = btn("toc-rail-btn", () => {
      if (suppressClick) return;
      jumpTo(r);
    }, r.label);
    b.textContent = r.short;
    b.title = r.label;
    return b;
  });
  const openBtn = btn("toc-rail-btn toc-open", () => openSheet(), "もくじを開く");
  openBtn.textContent = "☰";
  openBtn.setAttribute("aria-haspopup", "dialog");
  const topBtn = btn("toc-rail-btn toc-up", () => jumpTop(), "いちばん上へ");
  topBtn.textContent = "↑";
  railEl.append(openBtn, ...railBtns, topBtn);
  const bubble = el("div", "toc-bubble");
  bubble.setAttribute("aria-hidden", "true");

  const sheet = el("dialog", "toc-sheet");
  sheet.setAttribute("aria-label", "もくじ");
  const sheetHead = el("div", "toc-sheet-head");
  const sheetCount = el("span", "toc-count");
  const close = btn("toc-close", () => sheet.close(), "とじる");
  close.textContent = "✕";
  sheetHead.append(el("span", "toc-title", "もくじ"), sheetCount, close);
  const sheetBody = el("div", "toc-sheet-body");
  sheetBody.append(buildList(1, () => sheet.close()));
  sheet.append(sheetHead, sheetBody);
  // 外側(うす暗い所)をタップしたら閉じる
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) sheet.close();
  });

  nav.append(panel, railEl, bubble, sheet);

  // ページ本体を左の列に入れ、もくじを右の列に置く
  const main = el("div", "list-main");
  main.append(...page.childNodes);
  page.append(main, nav);
  page.classList.add("has-toc");

  // ---------- 今見ている所(スクロールに合わせて強調) ----------
  let cur = -2;
  let lockUntil = 0;
  let lockedTo = -1;
  const scrollParentIntoView = (box: HTMLElement, target: HTMLElement, center = false) => {
    const b = box.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const pad = 12;
    if (center) box.scrollTop += t.top - b.top - (b.height - t.height) / 2;
    else if (t.top < b.top + pad) box.scrollTop += t.top - b.top - pad;
    else if (t.bottom > b.bottom - pad) box.scrollTop += t.bottom - b.bottom + pad;
  };
  const setActive = (i: number) => {
    if (i === cur) return;
    cur = i;
    const si = i >= 0 ? items[i].sec : -1;
    for (const k of [0, 1] as const) {
      itemBtns[k].forEach((b, j) => {
        b.classList.toggle("is-active", j === i);
        if (j === i) b.setAttribute("aria-current", "location");
        else b.removeAttribute("aria-current");
      });
      secLis[k].forEach((li, j) => li.classList.toggle("is-active", j === si));
    }
    railBtns.forEach((b, j) => {
      const on = i >= rail[j].first && i <= rail[j].last;
      b.classList.toggle("is-active", on);
      if (on) b.setAttribute("aria-current", "location");
      else b.removeAttribute("aria-current");
    });
    const text = `${Math.max(i + 1, 0)} / ${items.length}`;
    count.textContent = sheetCount.textContent = text;
    bar.style.transform = `scaleX(${(i + 1) / items.length})`;
    // 区分を開くアニメーションの後に、強調した項目がもくじの中で見えるようにする
    if (i >= 0) window.setTimeout(() => scrollParentIntoView(panelList, itemBtns[0][i]), 260);
  };
  const spy = () => {
    if (performance.now() < lockUntil) return setActive(lockedTo);
    const line = window.innerHeight * SPY_LINE;
    let i = -1;
    for (let j = 0; j < items.length; j++) {
      if (items[j].el.getBoundingClientRect().top <= line) i = j;
      else break;
    }
    // いちばん下まで来たら、最後の項目(短い項目が線まで上がらないため)
    const doc = document.documentElement;
    if (i >= 0 && window.scrollY + window.innerHeight >= doc.scrollHeight - 4) i = items.length - 1;
    setActive(i);
  };
  let raf = 0;
  const onScroll = () => {
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        spy();
      });
  };
  // なめらかに送っている間は、行き先を強調したままにする(途中の項目が次々に光らないように)
  // scrollend が無いブラウザでも、指やホイールで動かしたらすぐ戻す
  const onScrollEnd = () => {
    if (!lockUntil) return;
    lockUntil = 0;
    spy();
  };

  // ---------- 移動 ----------
  const behavior = (): ScrollBehavior => (prefersReducedMotion() ? "auto" : "smooth");
  function jump(target: HTMLElement, focusEl: HTMLElement, i: number, instant = false) {
    const b = instant ? "auto" : behavior();
    lockedTo = i;
    lockUntil = b === "smooth" ? performance.now() + 3000 : 0;
    setActive(i);
    target.scrollIntoView({ behavior: b, block: "start" });
    // キーボードや読み上げで使う人のために、移動した先の見出しへフォーカスを移す
    if (!instant) focusEl.focus({ preventScroll: true });
    if (b !== "smooth") spy();
  }
  const jumpTo = (r: RailEntry, instant = false) => jump(r.target.el, r.target.focusEl, r.first, instant);
  function jumpTop() {
    lockedTo = -1;
    lockUntil = prefersReducedMotion() ? 0 : performance.now() + 3000;
    setActive(-1);
    window.scrollTo({ top: 0, behavior: behavior() });
    page.querySelector<HTMLElement>(".app-title")?.focus({ preventScroll: true });
  }
  function openSheet() {
    sheet.showModal();
    if (cur >= 0) scrollParentIntoView(sheetBody, itemBtns[1][cur], true);
  }

  // ---------- 帯を指でなぞって移る(スマホの連絡先の「あかさたな」のように) ----------
  let scrub: { id: number; y: number; moved: boolean } | null = null;
  let suppressClick = false;
  const entryAt = (x: number, y: number) => {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLButtonElement>(".toc-rail-btn");
    const j = hit ? railBtns.indexOf(hit) : -1;
    return j;
  };
  const showBubble = (j: number) => {
    const b = railBtns[j].getBoundingClientRect();
    bubble.textContent = rail[j].label;
    bubble.style.top = `${b.top + b.height / 2}px`;
    bubble.classList.add("on");
  };
  railEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    scrub = { id: e.pointerId, y: e.clientY, moved: false };
    suppressClick = false;
  });
  railEl.addEventListener("pointermove", (e) => {
    if (!scrub || e.pointerId !== scrub.id) return;
    if (!scrub.moved && Math.abs(e.clientY - scrub.y) < 8) return;
    if (!scrub.moved) {
      scrub.moved = true;
      railEl.setPointerCapture(e.pointerId);
      railEl.classList.add("scrubbing");
    }
    const j = entryAt(railEl.getBoundingClientRect().left + railEl.clientWidth / 2, e.clientY);
    if (j < 0) return;
    showBubble(j);
    if (cur < rail[j].first || cur > rail[j].last) jumpTo(rail[j], true);
  });
  const endScrub = (e: PointerEvent) => {
    if (!scrub || e.pointerId !== scrub.id) return;
    if (scrub.moved) {
      suppressClick = true;
      window.setTimeout(() => (suppressClick = false), 50);
      const j = cur >= 0 ? rail.findIndex((r) => cur >= r.first && cur <= r.last) : -1;
      if (j >= 0) rail[j].target.focusEl.focus({ preventScroll: true });
    }
    scrub = null;
    railEl.classList.remove("scrubbing");
    bubble.classList.remove("on");
  };
  railEl.addEventListener("pointerup", endScrub);
  railEl.addEventListener("pointercancel", endScrub);

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  const userInput = ["scrollend", "wheel", "touchstart", "keydown"] as const;
  for (const t of userInput) window.addEventListener(t, onScrollEnd, { passive: true });
  const wide = window.matchMedia(WIDE);
  const onWide = () => {
    if (wide.matches && sheet.open) sheet.close();
  };
  wide.addEventListener("change", onWide);
  spy();

  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    for (const t of userInput) window.removeEventListener(t, onScrollEnd);
    wide.removeEventListener("change", onWide);
    cancelAnimationFrame(raf);
    if (sheet.open) sheet.close();
  };
}
