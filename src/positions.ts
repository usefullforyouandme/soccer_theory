// ポジション別の入口(一覧の「ポジションから選ぶ」)。設計は docs/POSITION_PLAN.md
// シナリオの JSON は変えず、そのポジションの子が主役(判断する人)になっているシナリオを場面ごとに並べる
import type { Role } from "./types";

export type PositionKey = "gk" | "cb" | "sb" | "cm" | "wm" | "fw";
export type SceneKind = "attack" | "defend" | "switch" | "restart";

export interface PositionScene {
  kind: SceneKind;
  /** 子ども向けの問いかけ(答えを書かない) */
  q: string;
  ids: string[];
}

export interface PositionGuide {
  key: PositionKey;
  label: string;
  /** 3-3-1 の背番号 */
  numbers: string;
  roles: Role[];
  /** ひとことで言うと */
  one: string;
  attack: string;
  defend: string;
  mistake: string;
  /** 2-3-2 の時のちがい(指導者向け) */
  note232: string;
  /** ミニピッチでぬる範囲(座標は docs/SPEC.md 3 章。味方は上へせめる) */
  area: { x: number; y: number; w: number; h: number }[];
  scenes: PositionScene[];
}

export const SCENE_KINDS: Record<SceneKind, { label: string; icon: string }> = {
  attack: { label: "せめる", icon: "🥅" },
  defend: { label: "守る", icon: "🛡️" },
  switch: { label: "切りかえ", icon: "🔄" },
  restart: { label: "リスタート", icon: "🚩" },
};

export const POSITIONS: PositionGuide[] = [
  {
    key: "gk", label: "キーパー", numbers: "1", roles: ["GK"],
    one: "さいごの守りで、せめのスタート",
    attack: "ボールを取ったら、相手がいない方の味方へすぐ出す。",
    defend: "ボールとゴールの真ん中に立つ。正面から来たら少し前へ出る。",
    mistake: "ゴールの線にはりついたまま。取ったら、相手がいる方へけってしまう。",
    note232: "2-3-2 でも同じ。DF が 2 人なので、DF の後ろのスペースへ出たボールに気をつける。",
    area: [{ x: 13, y: 55, w: 24, h: 13 }],
    scenes: [
      { kind: "defend", q: "シュートを打たれそう!どこに立つ?", ids: ["keeper-position-right", "keeper-position-front"] },
      { kind: "defend", q: "DFの後ろへ長いボールが来た!", ids: ["keeper-rush-long"] },
      { kind: "defend", q: "相手と1対1になった!", ids: ["keeper-one-v-one-front"] },
      { kind: "attack", q: "ボールを取った!どこへ出す?", ids: ["build-from-keeper-fw", "build-from-keeper-catch"] },
    ],
  },
  {
    key: "cb", label: "真ん中DF", numbers: "4", roles: ["CB"],
    one: "ゴールの前の、まんなかのカベ",
    attack: "キーパーや味方がボールを持ったら、パスをもらえる所に動く。追われたら無理をしない。",
    defend: "ゴールにいちばん近い所を守る。味方がボールに行ったら、ななめ後ろでカバー。",
    mistake: "ボールに飛びこんでぬかれる。ボールだけを見て、後ろの相手を見ていない。",
    note232: "2-3-2 には真ん中DF がいない。左右の DF の 2 人で真ん中も守る(1人が行き、1人がカバー)。",
    area: [{ x: 13, y: 42, w: 24, h: 22 }],
    scenes: [
      { kind: "defend", q: "前の味方がボールに行った。自分はどこ?", ids: ["press-and-cover-center", "press-and-cover-wing"] },
      { kind: "defend", q: "ゴール前。ボールと相手、どっちを見る?", ids: ["mark-and-ball-through", "mark-and-ball-cross"] },
      { kind: "defend", q: "1人で2人を守ることになった!", ids: ["delay-outnumbered-counter"] },
      { kind: "defend", q: "相手のFWへパスが来そう!", ids: ["intercept-or-hold-front"] },
      { kind: "defend", q: "ゴール前で取った!どこへける?", ids: ["clear-wide-box"] },
      { kind: "attack", q: "キーパーがボールを持った。どこでもらう?", ids: ["support-angle-keeper", "restart-shape-low"] },
    ],
  },
  {
    key: "sb", label: "サイドDF", numbers: "2・3", roles: ["LB", "RB"],
    one: "サイドを守り、反対の時は中へ",
    attack: "キーパーや真ん中DF がボールを持ったら、サイドに広がってもらう。",
    defend: "ボールがこちらのサイドなら外へ追い出す。反対のサイドなら、ゴール前の方へよる。",
    mistake: "ボールが反対のサイドなのに、外に立って見ている。前に上がったまま、もどらない。",
    note232: "2-3-2 では DF が 2 人だけ。少し真ん中よりに立ち、1人が行ったらもう1人がカバー。",
    area: [{ x: 0, y: 36, w: 16, h: 28 }, { x: 34, y: 36, w: 16, h: 28 }],
    scenes: [
      { kind: "defend", q: "相手がこちらのサイドをドリブルしてきた!", ids: ["show-outside-wing", "press-and-cover-wing"] },
      { kind: "defend", q: "サイドで相手と1対1!", ids: ["defend-stance-wing"] },
      { kind: "defend", q: "ボールが反対のサイドにある時は?", ids: ["tuck-in-wing", "tuck-in-center"] },
      { kind: "defend", q: "ゴール前で、1人で2人を守る!", ids: ["delay-outnumbered-box"] },
      { kind: "switch", q: "前に上がっていたら、取られた!", ids: ["recovery-run-near"] },
      { kind: "restart", q: "キーパーからのボール。どこでもらう?", ids: ["build-from-keeper-catch", "restart-shape-press"] },
    ],
  },
  {
    key: "cm", label: "真ん中MF", numbers: "6", roles: ["CM"],
    one: "チームのまんなかで、つなぐ人",
    attack: "ボールを持つ味方から見える所に顔を出す。もらう前に、前と後ろを見ておく。",
    defend: "真ん中を通らせない。取られたら、近くならすぐ取り返しに行く。",
    mistake: "ボールによりすぎて、味方と同じ所に立つ。見ないで受けて、後ろから取られる。",
    note232: "2-3-2 でも同じ。後ろの DF が 2 人なので、守る時は DF の前のスペースをうめる。",
    area: [{ x: 13, y: 20, w: 24, h: 34 }],
    scenes: [
      { kind: "attack", q: "パスが来る前に、何をする?", ids: ["scan-before-center"] },
      { kind: "attack", q: "後ろの味方が追われた!どこでもらう?", ids: ["support-angle-center"] },
      { kind: "attack", q: "前に相手がならんでいる。どこでもらう?", ids: ["receive-between-center"] },
      { kind: "attack", q: "パスを出した!そのあとは?", ids: ["one-two-center"] },
      { kind: "attack", q: "ゴールの前が空いている!", ids: ["shoot-when-open-outside"] },
      { kind: "attack", q: "シュートがはね返された!どこに立つ?", ids: ["second-ball-edge"] },
      { kind: "switch", q: "真ん中でボールを取った!", ids: ["counter-attack-center"] },
      { kind: "switch", q: "ゴールの近くで取られた!", ids: ["delay-outnumbered-own-half"] },
      { kind: "restart", q: "相手のコーナーキック。どこを守る?", ids: ["corner-defense-right"] },
      { kind: "restart", q: "自分のゴールに近い所のスローイン", ids: ["throw-in-defend"] },
    ],
  },
  {
    key: "wm", label: "サイドMF", numbers: "7・8", roles: ["LM", "RM"],
    one: "サイドを広く使い、ゴール前へも入る",
    attack: "タッチラインの近くに広がって待つ。ボールが反対のサイドなら、ゴール前へ入る。",
    defend: "自分の前の相手を見る。取られたら、自分のゴールの方へもどる。",
    mistake: "ボールによってきて、サイドが空っぽになる。反対のサイドのせめを見ているだけ。",
    note232: "2-3-2 では後ろの DF が 2 人なので、取られた時はより早くもどる。",
    area: [{ x: 0, y: 12, w: 16, h: 38 }, { x: 34, y: 12, w: 16, h: 38 }],
    scenes: [
      { kind: "attack", q: "サイドでパスが来る前に、何をする?", ids: ["scan-before-wing"] },
      { kind: "attack", q: "味方が真ん中でボールを持った。どこで待つ?", ids: ["stay-wide-center"] },
      { kind: "attack", q: "サイドで相手と向き合った!", ids: ["take-on-wing", "two-v-one-wing"] },
      { kind: "attack", q: "ドリブル?それともパス?", ids: ["dribble-or-pass-open", "dribble-or-pass-press"] },
      { kind: "attack", q: "反対のサイドからボールが来る!", ids: ["side-attack-box-entry", "side-attack-box-entry-right"] },
      { kind: "attack", q: "サイドのおくまで来た!上げる?運ぶ?", ids: ["cross-or-cut-in-empty"] },
      { kind: "attack", q: "こちらのサイドがせまくなった", ids: ["switch-play-right"] },
      { kind: "switch", q: "遠いサイドにいた時に、取られた!", ids: ["recovery-run-far"] },
      { kind: "defend", q: "相手のサイドDFが上がってきた!", ids: ["track-back-overlap"] },
      { kind: "restart", q: "相手のゴールに近い所のスローイン", ids: ["throw-in-attack"] },
      { kind: "restart", q: "味方のコーナーキック。どこに入る?", ids: ["corner-attack-right", "corner-attack-short"] },
    ],
  },
  {
    key: "fw", label: "FW", numbers: "9", roles: ["FW"],
    one: "いちばん前で、ゴールをねらい、さいしょに守る",
    attack: "相手の DF とならんで待ち、パスが出たら後ろへ走る。打てる時は打つ。",
    defend: "取られたら、近くの相手にすぐよせる。",
    mistake: "早く走り出してオフサイド。シュートの後に止まって見ている。",
    note232: "2-3-2 では FW が 2 人。1人が後ろへ走ったら、もう1人は少し下がってもらう。",
    area: [{ x: 12, y: 0, w: 26, h: 34 }],
    scenes: [
      { kind: "attack", q: "味方がパスを出しそう。いつ走る?", ids: ["run-behind-center", "run-behind-wing", "run-behind-long"] },
      { kind: "attack", q: "ゴール前で DF と 1対1!", ids: ["take-on-box"] },
      { kind: "attack", q: "味方がシュート!その時、自分は?", ids: ["follow-the-shot-front"] },
      { kind: "defend", q: "相手のDFがボールを持った!", ids: ["press-from-front-cb"] },
      { kind: "switch", q: "前で取られた!", ids: ["counter-press-center"] },
    ],
  },
];
