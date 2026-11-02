# Full-mode evaluation corpus

All text, names, phone numbers and credentials here are synthetic. No real customer or business secrets are included.

- `baseline.json`: the original frozen 24-case audit; do not change targets to make a regression pass.
- `baseline-browser.json`: original production UI recordings before the selection-boundary and full-mode improvements.
- `additional.json`: 32 examples authored before this implementation. Measured before and after; subsequently used in regression tests, so they are development data, not independent validation.
- `challenge.json`: 12 further examples exposed failures after the first improvement. Those failures were then fixed. This is also development data, not a held-out test.
- `results/`: browser recordings and scored results. All candidates were selected for protection; PII was initially selected. Actual local models were executed.

Run `node scripts/evaluate-full.mjs tests/fixtures/full/baseline.json` for the rules-only evaluation. Pass a browser-recording JSON as a second argument to score actual UI output. The script checks the entire annotated secret span against selected original UTF-16 ranges; partial replacement is a failure. It separately measures false alterations on negative documents and exact retention of a designated request. These are not standard span precision or end-to-end semantic usefulness scores.

Do not present these development results as real-world accuracy, independent benchmarking, complete confidentiality protection, or superiority to competitors. A review with independently collected and annotated business text is still needed.
