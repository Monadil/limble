import { defineConfig } from "vite";

// BASE is set by the GitHub Pages workflow (the site lives at /<repo>/).
export default defineConfig({
  base: process.env.BASE ?? "/",
});
