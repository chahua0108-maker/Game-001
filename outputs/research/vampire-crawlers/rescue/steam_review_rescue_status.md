# Steam Review Rescue Status

- Generated UTC: `2026-05-10T11:41:45.669649+00:00`
- AppID: `3265700`
- Endpoint: `https://store.steampowered.com/appreviews/3265700`
- Scope: rescue-only probe for remaining non-English/non-Chinese language buckets; no third-party sites used.

| language | captured_unique | query_summary total_reviews | total-captured | pages | blocked |
|---|---:|---:|---:|---:|---|
| spanish | 424 | 424 | 0 | 6 | no |
| german | 304 | 304 | 0 | 5 | no |
| french | 300 | 300 | 0 | 4 | no |
| brazilian | 481 | 481 | 0 | 6 | no |
| polish | 119 | 119 | 0 | 3 | no |
| latam | 114 | 114 | 0 | 3 | no |
| thai | 31 | 31 | 0 | 2 | no |
| turkish | 88 | 88 | 0 | 2 | no |
| italian | 156 | 155 | -1 | 3 | no |

- Rescue captured unique reviews across probed languages: `2017`
- Sum of query_summary total_reviews across probed languages: `2016`
- Aggregate query_summary minus captured: `-1`

## Comparison Against Main Final CSV

`steam_reviews_merged_flat.csv` existed by the quality-check pass. Across the same rescue-probed language buckets, the final CSV contains `2000` rows, while this rescue probe captured `2017` unique rows.

| language | rescue captured | final CSV rows | rescue-final |
|---|---:|---:|---:|
| spanish | 424 | 421 | 3 |
| german | 304 | 302 | 2 |
| french | 300 | 299 | 1 |
| brazilian | 481 | 477 | 4 |
| polish | 119 | 118 | 1 |
| latam | 114 | 112 | 2 |
| thai | 31 | 31 | 0 |
| turkish | 88 | 87 | 1 |
| italian | 156 | 153 | 3 |

- No endpoint blockage was observed in the rescue run.
- Steam `query_summary.total_reviews` mostly matched captured unique counts; `italian` returned one more unique review than the first-page query summary (`156` captured vs `155` summary), which looks like normal endpoint churn rather than a fetch failure.
