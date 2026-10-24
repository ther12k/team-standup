import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/**", "node_modules/**", "coverage/**", "*.d.ts"]),
]);
