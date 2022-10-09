/* eslint-disable import/no-extraneous-dependencies */
import reactRefresh from "@vitejs/plugin-react-refresh";
import { resolve } from "path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import restart from "vite-plugin-restart";
import windi from "vite-plugin-windicss";

// https://vitejs.dev/config/
// eslint-disable-next-line import/no-default-export
export default defineConfig({
  optimizeDeps: {
    exclude: ["@empirica/core"],
  },
  server: {
    port: 8844,
    open: false,
    strictPort: true,
    host: "0.0.0.0",
    fs: {
      allow: [
        // search up for workspace root
        searchForWorkspaceRoot(process.cwd()),
        // @empirica/core lookup for windi
        "./node_modules/@empirica/core/dist/**/*.{js,ts,jsx,tsx}",
        "./node_modules/@empirica/core/assets/**/*.css",
      ],
    },
  },
  build: { 
    minify: false,
    target: 'esnext'
   },
  clearScreen: false,
  resolve: {
    alias: {
      $components: resolve("src/components"),
      $assets: resolve("src/assets"),
    },
  },
  // logLevel: "warn",
  plugins: [
    restart({
      restart: [
        "./windi.config.cjs",
        "./node_modules/@empirica/core/dist/**/*.{js,ts,jsx,tsx}",
        "./node_modules/@empirica/core/assets/**/*.css",
      ],
    }),
    windi(),
    reactRefresh(),
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development"
    ),
  },
});
