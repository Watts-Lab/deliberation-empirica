/* eslint-disable import/no-extraneous-dependencies */
import reactRefresh from "@vitejs/plugin-react-refresh";
import { resolve } from "path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import restart from "vite-plugin-restart";
import tailwindcss from "@tailwindcss/vite";
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
      // Force npm-linked packages (SCORE) to use the app's React instance.
      // Without this, SCORE resolves its own node_modules/react, causing
      // dual-React issues ("Objects are not valid as a React child").
      // Remove once SCORE is published to npm and installed normally.
      react: resolve("node_modules/react"),
      "react-dom": resolve("node_modules/react-dom"),
      "react/jsx-runtime": resolve("node_modules/react/jsx-runtime"),
    },
  },
  // logLevel: "warn",
  plugins: [
    restart({
      restart: [
        "./node_modules/@empirica/core/dist/**/*.{js,ts,jsx,tsx}",
        "./node_modules/@empirica/core/assets/**/*.css",
      ],
    }),
    tailwindcss(),
    reactRefresh(),
    sentryVitePlugin({
      org: "watts-lab",
      project: "deliberation-empirica",
      reactComponentAnnotation: { enabled: false }, // reenable when this is resolved: https://github.com/getsentry/sentry-javascript-bundler-plugins/issues/622
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
