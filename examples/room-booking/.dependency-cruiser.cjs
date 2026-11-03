/**
 * DDD layer and context rules for a workspace laid out as packages/<context>/src/{domain,application,infrastructure,interfaces}.
 * Shared packages: packages/shared-kernel (modeling building blocks) and packages/contracts (published language).
 * Adjust SHARED_KERNEL / CONTRACTS if your names differ. Every rule is an error: a layering rule that does not fail the build does not exist.
 */
const SHARED_KERNEL = "^packages/shared-kernel/src/";
const CONTRACTS = "^packages/contracts/src/";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-allowlist",
      comment: "Domain imports only its own context's domain and the shared kernel (strong rule 1).",
      severity: "error",
      from: { path: "^packages/([^/]+)/src/domain/" },
      to: { pathNot: [`^packages/$1/src/domain/`, SHARED_KERNEL] },
    },
    {
      name: "application-allowlist",
      comment: "Application imports its own domain and application, the shared kernel, and published contracts.",
      severity: "error",
      from: { path: "^packages/([^/]+)/src/application/" },
      to: { pathNot: [`^packages/$1/src/(domain|application)/`, SHARED_KERNEL, CONTRACTS] },
    },
    {
      name: "core-no-runtime-modules",
      comment: "No node:/bun: modules in domain or application (runtime portability).",
      severity: "error",
      from: { path: "^packages/[^/]+/src/(domain|application)/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "core-no-unresolvable",
      comment: "bun:* modules are not resolvable by the cruiser; forbid anything unresolved from the core.",
      severity: "error",
      from: { path: "^packages/[^/]+/src/(domain|application)/" },
      to: { couldNotResolve: true },
    },
    {
      name: "no-unresolvable",
      comment: "An import that cannot be resolved is a deep import blocked by package exports, or a typo. bun:* builtins are exempt here.",
      severity: "error",
      from: {},
      to: { couldNotResolve: true, pathNot: "^bun:" },
    },
    {
      name: "interfaces-not-infrastructure",
      comment: "The interfaces layer talks to application (and domain value objects), never to infrastructure.",
      severity: "error",
      from: { path: "^packages/([^/]+)/src/interfaces/" },
      to: { path: "^packages/$1/src/infrastructure/" },
    },
    {
      name: "no-deep-imports-across-packages",
      comment: "Another package is reached only through its public entry point src/index.ts (strong rule 8).",
      severity: "error",
      from: { path: "^packages/([^/]+)/" },
      to: { path: "^packages/([^/]+)/src/", pathNot: ["^packages/$1/", "^packages/[^/]+/src/index\\.ts$"] },
    },
    {
      name: "shared-kernel-is-standalone",
      comment: "The shared kernel depends on nothing outside itself.",
      severity: "error",
      from: { path: SHARED_KERNEL },
      to: { pathNot: SHARED_KERNEL },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)test/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "default"] },
  },
};
