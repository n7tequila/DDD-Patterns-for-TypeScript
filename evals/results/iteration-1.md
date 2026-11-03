# Eval Results · Iteration 1

- Date: 2026-11-03
- Skill version: commit `a4bdea9` plus the B5 references (ddd-code-review, ddd-checklist, output-template)
- Runs: 20 (all 13 evals with the skill; 7 of them also without the skill). One trial per condition.
- Executor: general-purpose subagents on the same model as the author (Claude Opus 5.5). Baseline runs were told not to read any file except the review input; their tool-use counts (1–2: reading the input, writing the answer) are consistent with that.
- Grading: by the skill author, from each answer's severity-tagged findings plus targeted searches for each expectation; not blind. Treat the numbers as indicative.

## Scores

| # | Eval | With skill | Without skill |
|---|---|---|---|
| 1 | r00 clean control | 3/3 | 3/3 |
| 2 | r01 structural identifiers | 4/4 | 4/4 |
| 3 | r02 publish after save | 4/4 | — |
| 4 | r03 async transaction | 4/4 | 4/4 |
| 5 | r04 leaked transaction | 3/3 | 3/3 |
| 6 | r05 handler logic | 5/5 | — |
| 7 | r06 unparsed cast | 4/4 | — |
| 8 | r07 domain imports | 4/4 | — |
| 9 | r08 role-only authorization | 3/3 | — |
| 10 | r09 enumeration trusted on read | 3/3 | 3/3 |
| 11 | r10 anemic model | 3/3 | — |
| 12 | design: library lending | 8/8 | 8/8 |
| 13 | code: cancel reservation | 5/5 | 4/5 |
| | **Total** | **53/53** | **29/30** (skill on the same 7: 30/30) |

## Findings

1. **Coverage holds.** With the skill, every planted violation was found at the expected severity, and the clean control produced no CRITICAL or HIGH finding (one LOW).
2. **The measured gain over the baseline is small.** The baseline also caught the TypeScript-specific traps, including the asynchronous transaction callback on `bun:sqlite` (with the correct explanation), the leaked transaction handle, structurally interchangeable identifier classes, and the unchecked enumeration column. The only expectation the baseline missed was branded identifiers in the coding task (it used plain `string` IDs).
3. **What the skill visibly changed** is consistency rather than knowledge: with the skill, answers used `#private` state, the `NotPromise` unit-of-work port, zod at the edges, module factories, and the strong-rule severity mapping; findings cited strong-rule numbers. These are not all captured by the expectations.
4. **Cost.** Runs with the skill used roughly 90–185k subagent tokens and 2–13 minutes; baseline runs used 70–105k tokens and 1.5–8 minutes.

## Limits Of This Iteration

- One trial per condition; small differences are not significant.
- The baseline model is the strongest available; the skill's effect may be larger on smaller models, on larger codebases, or on subtler violations.
- Grading was not blind and partly keyword-based.

## Candidates For Iteration 2

- Run the baseline and skill conditions on a smaller model.
- Add subtler review cases (violations spread across several files, partially correct patterns) and expectations for the house conventions the skill introduces.
- Blind grading by a separate grader, with 3 trials per condition for the evals that differed.
