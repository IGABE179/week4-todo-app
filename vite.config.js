@'
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // "./" makes the built files use relative paths, so the app works
  // inside the /week4-todo-app/ folder on GitHub Pages.
  base: "./",
  plugins: [tailwindcss()],
});
'@ | Set-Content -Encoding utf8 vite.config.js