// ESLint flat config for a DDD workspace (ESLint 10, typescript-eslint 8).
// typescript-eslint 8.72 supports TypeScript < 6.1: keep the workspace on TypeScript 6.0.x.
import tseslint from "typescript-eslint";

const CORE = ["packages/*/src/domain/**/*.ts", "packages/*/src/application/**/*.ts"];

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**"] },
  {
    files: ["packages/*/src/**/*.ts", "packages/*/test/**/*.ts"],
    extends: [tseslint.configs.base],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // Strong rule 14: no floating promises.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/only-throw-error": "error",
    },
  },
  {
    // Runtime portability: the core uses ECMAScript built-ins only.
    files: CORE,
    rules: {
      "no-restricted-globals": [
        "error",
        ...["fetch", "crypto", "setTimeout", "setInterval", "setImmediate", "queueMicrotask", "performance", "process", "Bun"].map((name) => ({
          name,
          message: "Infrastructure only: reach this capability through a port.",
        })),
      ],
      "no-restricted-properties": ["error", { object: "Date", property: "now", message: "Inject a Clock." }],
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: "Inject a Clock." },
        { selector: "TSEnumDeclaration", message: "Use a string literal union instead of enum." },
      ],
    },
  },
);
