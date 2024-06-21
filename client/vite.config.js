/* eslint-disable import/no-extraneous-dependencies */
import reactRefresh from "@vitejs/plugin-react-refresh";
import { resolve } from "path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import restart from "vite-plugin-restart";
import windi from "vite-plugin-windicss";
import { sentryVitePlugin } from "@sentry/vite-plugin";

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
    target: "esnext",
    sourcemap: true,
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
    sentryVitePlugin({
      org: "watts-lab",
      project: "deliberation-empirica",
      reactComponentAnnotation: { enabled: true },
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: process.env.BUNDLE_DATE,
      },
    }),
  ],
  define: {
    // this is executed during build time, not run time
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development"
    ),
    "process.env.TEST_CONTROLS": JSON.stringify(
      process.env.TEST_CONTROLS || "notSetByVite"
    ),
    "process.env.BUNDLE_DATE": JSON.stringify(
      process.env.BUNDLE_DATE || "unavailable"
    ),
  },
});
