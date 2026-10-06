import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);
const pkg = _require("./package.json") as { version: string };

export default defineConfig({
  plugins: [
    // TanStack Start (SSR + TanStack Router code generation + server entry)
    // Redirects the bundled server entry to src/server.ts (our SSR error wrapper).
    tanstackStart({
      server: { entry: "server" },
    }),
    // React with Fast Refresh
    react(),
    // Tailwind CSS v4
    tailwindcss(),
    // Resolve @/* imports from tsconfig.json paths
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
  ],
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: {
    // Development proxy: forwards /api requests to the FastAPI backend.
    // Flow: Browser -> /api/v1/... -> Vite -> http://127.0.0.1:8000/api/v1/...
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  define: {
    // Injected at build time so the telemetry logger can report app_version.
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
  },
});
