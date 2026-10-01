import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

const pagesBase =
  process.env.GITHUB_PAGES === "true" ? "/Developer-Portfolio-Vedant/" : "/";
const routerBasepath = pagesBase.replace(/\/$/, "") || "/";

export default defineConfig({
  base: pagesBase,
  server: {
    port: 8080,
    host: "127.0.0.1",
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
      prerender: { enabled: true, crawlLinks: true, concurrency: 1 },
      router: { basepath: routerBasepath },
    }),
    viteReact(),
  ],
});
