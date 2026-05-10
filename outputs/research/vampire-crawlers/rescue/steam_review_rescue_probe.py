#!/usr/bin/env python3
import csv
import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode


APP_ID = "3265700"
BASE = Path("outputs/research/vampire-crawlers")
RESCUE = BASE / "rescue"
RAW_OUT = RESCUE / "steam_review_rescue_raw.json"
STATUS_OUT = RESCUE / "steam_review_rescue_status.md"
QUALITY_OUT = RESCUE / "steam_review_quality_check.md"

LANGUAGES = [
    "spanish",
    "german",
    "french",
    "brazilian",
    "polish",
    "latam",
    "thai",
    "turkish",
    "italian",
]


def curl_json(url: str, tries: int = 4) -> tuple[dict | None, str | None]:
    last_error = None
    for attempt in range(1, tries + 1):
        result = subprocess.run(
            [
                "curl",
                "--http1.1",
                "-L",
                "--compressed",
                "--retry",
                "1",
                "--retry-all-errors",
                "--retry-delay",
                "1",
                "--connect-timeout",
                "15",
                "--max-time",
                "45",
                "-A",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "-sS",
                url,
            ],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if result.returncode == 0 and result.stdout.strip():
            try:
                return json.loads(result.stdout), None
            except json.JSONDecodeError:
                last_error = f"json decode failed: {result.stdout[:180]}"
        else:
            last_error = result.stderr.strip() or f"curl returncode={result.returncode}"
        time.sleep(min(12, attempt * 3))
    return None, last_error


def fetch_language(language: str) -> dict:
    cursor = "*"
    reviews = []
    seen = set()
    pages = []
    query_summary = {}
    blocked = None

    for page in range(1, 80):
        params = {
            "json": "1",
            "filter": "recent",
            "language": language,
            "purchase_type": "all",
            "num_per_page": "100",
            "cursor": cursor,
        }
        url = f"https://store.steampowered.com/appreviews/{APP_ID}?{urlencode(params)}"
        data, error = curl_json(url)
        if error or not data:
            blocked = f"page {page}: {error}"
            break
        if data.get("success") != 1:
            blocked = f"page {page}: success={data.get('success')}"
            break

        page_reviews = data.get("reviews") or []
        if not query_summary:
            query_summary = data.get("query_summary") or {}
        new_count = 0
        for review in page_reviews:
            rid = review.get("recommendationid")
            if rid and rid not in seen:
                seen.add(rid)
                reviews.append(review)
                new_count += 1

        next_cursor = data.get("cursor")
        pages.append(
            {
                "page": page,
                "cursor_in": cursor,
                "cursor_out": next_cursor,
                "reviews": len(page_reviews),
                "new_reviews": new_count,
            }
        )
        if not page_reviews or not next_cursor or next_cursor == cursor or new_count == 0:
            break
        cursor = next_cursor
        time.sleep(0.7)

    total = query_summary.get("total_reviews")
    diff = None if total is None else total - len(reviews)
    return {
        "language": language,
        "query_summary": query_summary,
        "reviews": reviews,
        "pages": pages,
        "blocked": blocked,
        "query_total_minus_captured": diff,
    }


def write_status(blocks: list[dict]) -> None:
    generated = datetime.now(timezone.utc).isoformat()
    lines = [
        "# Steam Review Rescue Status",
        "",
        f"- Generated UTC: `{generated}`",
        f"- AppID: `{APP_ID}`",
        "- Endpoint: `https://store.steampowered.com/appreviews/3265700`",
        "- Scope: rescue-only probe for remaining non-English/non-Chinese language buckets; no third-party sites used.",
        "",
        "| language | captured_unique | query_summary total_reviews | total-captured | pages | blocked |",
        "|---|---:|---:|---:|---:|---|",
    ]
    total_captured = 0
    total_query = 0
    for block in blocks:
        total = block.get("query_summary", {}).get("total_reviews")
        captured = len(block.get("reviews") or [])
        total_captured += captured
        if isinstance(total, int):
            total_query += total
        diff = "" if total is None else total - captured
        lines.append(
            "| {language} | {captured} | {total} | {diff} | {pages} | {blocked} |".format(
                language=block["language"],
                captured=captured,
                total="" if total is None else total,
                diff=diff,
                pages=len(block.get("pages") or []),
                blocked=block.get("blocked") or "no",
            )
        )
    lines.extend(
        [
            "",
            f"- Rescue captured unique reviews across probed languages: `{total_captured}`",
            f"- Sum of query_summary total_reviews across probed languages: `{total_query}`",
            f"- Aggregate query_summary minus captured: `{total_query - total_captured}`",
        ]
    )
    STATUS_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_csv_rows(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_quality_check() -> None:
    csv_path = BASE / "steam_reviews_merged_flat.csv"
    if not csv_path.exists():
        QUALITY_OUT.write_text(
            "# Steam Review Quality Check\n\n"
            f"- Checked: `{datetime.now(timezone.utc).isoformat()}`\n"
            "- Result: `steam_reviews_merged_flat.csv` was not present when this rescue probe ran, so final CSV quality checks were skipped.\n",
            encoding="utf-8",
        )
        return

    rows = read_csv_rows(csv_path)
    ids = [row.get("recommendationid") for row in rows if row.get("recommendationid")]
    dup_ids = sorted({rid for rid in ids if ids.count(rid) > 1})
    lang_counts: dict[str, int] = {}
    vote_counts: dict[str, int] = {}
    timestamps = []
    for row in rows:
        lang_counts[row.get("language") or ""] = lang_counts.get(row.get("language") or "", 0) + 1
        vote_counts[row.get("voted_up") or ""] = vote_counts.get(row.get("voted_up") or "", 0) + 1
        ts = row.get("timestamp_created")
        if ts and ts.isdigit():
            timestamps.append(int(ts))

    def fmt_ts(ts: int) -> str:
        return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    lines = [
        "# Steam Review Quality Check",
        "",
        f"- Checked: `{datetime.now(timezone.utc).isoformat()}`",
        f"- Source CSV: `{csv_path}`",
        f"- Rows: `{len(rows)}`",
        f"- Unique recommendationid: `{len(set(ids))}`",
        f"- Duplicate recommendationid count: `{len(dup_ids)}`",
        f"- Duplicate recommendationid sample: `{', '.join(dup_ids[:20]) if dup_ids else 'none'}`",
        f"- Time range UTC: `{fmt_ts(min(timestamps)) if timestamps else 'n/a'}` to `{fmt_ts(max(timestamps)) if timestamps else 'n/a'}`",
        "",
        "## Language Distribution",
        "",
        "| language | rows |",
        "|---|---:|",
    ]
    for lang, count in sorted(lang_counts.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| {lang or '(blank)'} | {count} |")
    lines.extend(["", "## voted_up Distribution", "", "| voted_up | rows |", "|---|---:|"])
    for vote, count in sorted(vote_counts.items(), key=lambda item: (item[0])):
        lines.append(f"| {vote or '(blank)'} | {count} |")
    QUALITY_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    RESCUE.mkdir(parents=True, exist_ok=True)
    blocks = [fetch_language(language) for language in LANGUAGES]
    RAW_OUT.write_text(
        json.dumps(
            {
                "app_id": APP_ID,
                "generated_utc": datetime.now(timezone.utc).isoformat(),
                "languages": blocks,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    write_status(blocks)
    write_quality_check()
    print(json.dumps({"languages": len(blocks), "raw": str(RAW_OUT), "status": str(STATUS_OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
