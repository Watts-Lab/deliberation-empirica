import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    watchExclude: ["**/node_modules/**", "**/dist/**"],
  },
});
