import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the built app runs from any path: a domain root, or a
  // GitHub Pages project subpath like /<repo>/. There is no client-side router,
  // so relative asset URLs are always correct.
  base: "./",
  plugins: [react(), tailwindcss()],
});
