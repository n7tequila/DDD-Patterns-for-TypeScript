# Evals

`evals.json` follows the skill-creator schema.

- Evals 1–11 are review tasks. Each points at one file in `files/review/`. Evals 2–11 plant specific violations (from the strong rules and from defects found in a public TypeScript DDD skill); eval 1 is a compliant control that must not produce CRITICAL or HIGH findings.
- Evals 12–13 are design and coding tasks graded on whether TypeScript-specific rules are applied.

Run each eval with and without the skill (skill-creator workflow) and grade the expectations. Run artifacts go to `evals/runs/` (git-ignored); summaries are recorded in `docs/dev-log/`.
