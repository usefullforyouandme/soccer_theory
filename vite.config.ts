import { defineConfig } from "vite";

// GitHub Pages(/soccer_theory/ 配下)でもローカルでも動くよう相対パスで出力する
export default defineConfig({
  base: "./",
  server: { host: true },
});
