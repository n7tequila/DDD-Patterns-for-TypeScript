# Eval Results · Iteration 2

- Date: 2026-11-03
- Skill version: same as iteration 1 (commit `8e4b26a`), no skill changes between iterations.
- Change from iteration 1: subagents run on **Haiku** (a smaller model) instead of the author's own model, to test whether the skill's effect is larger on a weaker base model. Two subtler planted-violation samples were added (14, 15), each mostly correct with one real bug hidden in otherwise-compliant code. The one eval that differed in iteration 1 (13, the coding task) was run 3 times per condition instead of 1, to see if the difference holds up.
- Runs: 20 (8 evals compared with/without the skill: 1, 2, 4, 5, 10, 14, 15 once each, plus 13 three times each).
- Grading: by the skill author, from each answer's findings, severity tags, and code, cross-checked against the expectations; not blind. Same caveat as iteration 1.

## Scores

| # | Eval | With skill | Without skill |
|---|---|---|---|
| 1 | r00 clean control | 3/3 | 3/3 |
| 2 | r01 structural identifiers | 4/4 | 4/4 |
| 4 | r03 async transaction | 4/4 | 4/4 |
| 5 | r04 leaked transaction | 3/3 | 3/3 |
| 10 | r09 enumeration trusted on read | 3/3 | 3/3 |
| 13 | code: cancel reservation (3 trials) | 15/15 | 12/15 |
| 14 | r11 cross-aggregate write (new, subtle) | 4/4 | 4/4 |
| 15 | r12 partial outbox skip (new, subtle) | 3/3 | 3/3 |
| | **Total** | **39/39** | **36/39** |

The only expectation missed without the skill, in all three trials of eval 13, is the same one as iteration 1: branded identifiers. The generated code used plain `string` for every identifier in all three baseline trials; with the skill, all three trials used a branded type (`Brand<...>` or an equivalent nominal form).

## Findings

1. **A weaker model does not widen the gap on review tasks.** Haiku without the skill still caught every planted violation at the right severity, including both new, subtler ones (a direct cross-aggregate table write hidden among otherwise-correct code, and a business branch that silently drops an outbox event). General DDD review knowledge transfers to Haiku about as well as it did to the stronger model in iteration 1.
2. **The branded-identifier gap in code generation is now confirmed, not a fluke.** 3/3 trials with the skill produced branded types; 0/3 without. This is the most reproducible result across both iterations.
3. **A genuine extra finding, not in the expectations.** On eval 14, the skill-equipped answer also flagged that the command carries no acting member, so any caller can move any booking — a real CRITICAL authorization gap the baseline answer missed entirely. This was not something the expectations asked for; it surfaced because the skill's review workflow checks authorization as a distinct step.
4. **Explanations are more confident and better grounded with the skill, even when both reach the same conclusion.** On eval 4, the skill answer quoted the project's own binding documentation almost verbatim ("commits as soon as it returns a promise and never rolls back") and cited a strong-rule number. The baseline answer reasoned from general knowledge and hedged ("I believe... if that is correct... should be confirmed with a quick test"). Both were right; only one was certain and traceable to a source.
5. **Consistency, again.** Every skill-equipped answer used the same severity-catalog format, cited strong-rule numbers, and included a Positive Observations section. Baseline answers varied in structure and terminology between runs.

## Revised View Of Acceptance Standard 6

Combined with iteration 1, two iterations and 40 total runs support a narrower but more defensible claim than "the skill makes reviews better": **general DDD knowledge, even on a small model, already covers most of the TypeScript-specific traps this skill documents, for straightforward review tasks.** The skill's demonstrated, reproducible value is in:

- **Code generation**, where it reliably produces branded identifiers that an unguided model does not (3/3 vs 0/3, both iterations' coding tasks).
- **Catching issues outside the planted scope** (the eval 14 authorization gap), because the skill's workflow runs a fixed sequence of checks.
- **Grounded, citable explanations** rather than hedged guesses, which matters for trusting a review enough to act on it without separately verifying it.
- **Consistent, structured output**, which matters for a review habit over time more than for any single review.

## Limits Of This Iteration

- Still one trial per condition except eval 13; a difference of one finding on a single-trial eval is not strong evidence either way.
- Grading was not blind.
- Both iterations use the same ten planted violations (plus two new ones here); a model that has memorized the pattern "look for async transactions and interchangeable IDs" from training data would score well without this skill regardless of real understanding. The coding-task gap is the result least exposed to that concern, because it requires producing the pattern, not recognizing a name for it.
