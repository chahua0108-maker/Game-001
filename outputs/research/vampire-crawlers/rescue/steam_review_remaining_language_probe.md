# Steam Remaining Language Probe

- Generated UTC: `2026-05-10T11:53:26.907409+00:00`
- AppID: `3265700`
- Endpoint: `https://store.steampowered.com/appreviews/3265700`
- Scope: public Steam appreviews language buckets only; no third-party sites used.
- `language=all` query_summary total_reviews: `14348`
- Main CSV unique recommendationid at probe time: `14205`
- `language=all` minus main CSV unique: `143`

| language | query_summary total_reviews | captured_unique | total-captured | blocked/error |
|---|---:|---:|---:|---|
| portuguese | 11 | 11 | 0 | no |
| dutch | 11 | 11 | 0 | no |
| swedish | 14 | 14 | 0 | no |
| czech | 22 | 22 | 0 | no |
| danish | 5 | 5 | 0 | no |
| finnish | 6 | 6 | 0 | no |
| norwegian | 2 | 2 | 0 | no |
| ukrainian | 32 | 32 | 0 | no |
| romanian | 0 | 0 | 0 | no |
| hungarian | 20 | 20 | 0 | no |
| bulgarian | 0 | 0 | 0 | no |
| greek | 1 | 1 | 0 | no |
| vietnamese | 7 | 7 | 0 | no |
| indonesian | 0 | 0 | 0 | no |
| arabic | 0 | 0 | 0 | no |

## Fill Potential

- Nonzero remaining-language buckets: `11`
- Captured unique reviews across probed remaining codes: `131`
- Sum of query_summary total_reviews across probed remaining codes: `131`
- Enough to explain `language=all` minus main CSV unique gap: `no`
- Current endpoint gap: `14348 - 14205 = 143`; probed remaining buckets explain `131`, leaving `12`.
- User-referenced gap: `14333 - 14205 = 128`; probed remaining buckets explain `131`, enough by `3`.
- Nonzero captured buckets: `portuguese 11, dutch 11, swedish 14, czech 22, danish 5, finnish 6, norwegian 2, ukrainian 32, hungarian 20, greek 1, vietnamese 7`
