import { defineConfig, type Plugin } from "vite";

/**
 * 本番ビルドの CSP から style-src 'unsafe-inline' を外す。
 * 開発サーバーは CSS を <style> で差し込むため index.html には残しておき、ビルド時だけ差し替える
 * (JS からの element.style 操作は CSSOM なので 'unsafe-inline' がなくても動く)。
 */
function strictCsp(): Plugin {
  return {
    name: "strict-csp",
    apply: "build",
    transformIndexHtml(html) {
      const out = html.replace("style-src 'self' 'unsafe-inline'", "style-src 'self'");
      if (out === html) throw new Error("index.html の CSP に style-src 'self' 'unsafe-inline' が見つかりません");
      return out;
    },
  };
}

// GitHub Pages(/soccer_theory/ 配下)でもローカルでも動くよう相対パスで出力する
export default defineConfig({
  base: "./",
  server: { host: true },
  plugins: [strictCsp()],
});
