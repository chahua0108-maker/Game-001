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
RAW_OUT = RESCUE / "steam_review_remaining_language_raw.json"
REPORT_OUT = RESCUE / "steam_review_remaining_language_probe.md"

MAIN_LANGUAGE_CODES = {
    "english",
    "schinese",
    "tchinese",
    "japanese",
    "koreana",
    "russian",
    "spanish",
    "german",
    "french",
    "brazilian",
    "polish",
    "latam",
    "thai",
    "turkish",
    "italian",
}

LANGUAGES = [
    "portuguese",
    "dutch",
    "swedish",
    "czech",
    "danish",
    "finnish",
    "norwegian",
    "ukrainian",
    "romanian",
    "hungarian",
    "bulgarian",
    "greek",
    "vietnamese",
    "indonesian",
    "arabic",
]


def curl_json(params: dict[str, str], tries: int = 2) -> tuple[dict | None, str | None]:
    url = f"https://store.steampowered.com/appreviews/{APP_ID}?{urlencode(params)}"
    last_error = None
    for attempt in range(1, tries + 1):
        result = subprocess.run(
            [
                "curl",
                "-4",
                "--http1.1",
                "-L",
                "--compressed",
                "--retry",
                "1",
                "--retry-all-errors",
                "--retry-delay",
                "1",
                "--connect-timeout",
                "10",
                "--max-time",
                "25",
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
        time.sleep(min(10, attempt * 2))
    return None, last_error


def fetch_query_summary(language: str) -> tuple[dict, str | None]:
    params = {
        "json": "1",
        "filter": "recent",
        "language": language,
        "purchase_type": "all",
        "num_per_page": "1",
        "cursor": "*",
    }
    data, error = curl_json(params)
    if error or not data:
        return {}, error
    if data.get("success") != 1:
        return data.get("query_summary") or {}, f"success={data.get('success')}"
    return data.get("query_summary") or {}, None


def fetch_language(language: str) -> dict:
    cursor = "*"
    reviews = []
    seen = set()
    pages = []
    query_summary = {}
    blocked = None

    for page in range(1, 40):
        params = {
            "json": "1",
            "filter": "recent",
            "language": language,
            "purchase_type": "all",
            "num_per_page": "100",
            "cursor": cursor,
        }
        data, error = curl_json(params)
        if error or not data:
            blocked = f"page {page}: {error}"
            break
        if data.get("success") != 1:
            query_summary = query_summary or data.get("query_summary") or {}
            blocked = f"page {page}: success={data.get('success')}"
            break

        query_summary = query_summary or data.get("query_summary") or {}
        page_reviews = data.get("reviews") or []
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
        time.sleep(0.55)

    total = query_summary.get("total_reviews")
    return {
        "language": language,
        "query_summary": query_summary,
        "captured_unique": len(reviews),
        "query_total_minus_captured": None if total is None else total - len(reviews),
        "pages": pages,
        "blocked": blocked,
        "reviews": reviews,
    }


def count_main_csv() -> dict:
    path = BASE / "steam_reviews_merged_flat.csv"
    if not path.exists():
        return {"exists": False}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    ids = [row.get("recommendationid") for row in rows if row.get("recommendationid")]
    return {
        "exists": True,
        "path": str(path),
        "rows": len(rows),
        "unique_recommendationid": len(set(ids)),
    }


def write_report(payload: dict) -> None:
    blocks = payload["languages"]
    nonzero = [b for b in blocks if b["captured_unique"] > 0]
    total_captured = sum(b["captured_unique"] for b in blocks)
    total_query = sum(
        b["query_summary"].get("total_reviews", 0)
        for b in blocks
        if isinstance(b.get("query_summary", {}).get("total_reviews"), int)
    )
    all_total = payload["language_all_query_summary"].get("total_reviews")
    main_unique = payload["main_csv"].get("unique_recommendationid")
    remaining_gap = None
    if isinstance(all_total, int) and isinstance(main_unique, int):
        remaining_gap = all_total - main_unique

    lines = [
        "# Steam Remaining Language Probe",
        "",
        f"- Generated UTC: `{payload['generated_utc']}`",
        f"- AppID: `{APP_ID}`",
        "- Endpoint: `https://store.steampowered.com/appreviews/3265700`",
        "- Scope: public Steam appreviews language buckets only; no third-party sites used.",
        f"- `language=all` query_summary total_reviews: `{all_total if all_total is not None else 'n/a'}`",
        f"- Main CSV unique recommendationid at probe time: `{main_unique if main_unique is not None else 'n/a'}`",
        f"- `language=all` minus main CSV unique: `{remaining_gap if remaining_gap is not None else 'n/a'}`",
        "",
        "| language | query_summary total_reviews | captured_unique | total-captured | blocked/error |",
        "|---|---:|---:|---:|---|",
    ]
    for block in blocks:
        total = block.get("query_summary", {}).get("total_reviews")
        diff = block.get("query_total_minus_captured")
        lines.append(
            "| {language} | {total} | {captured} | {diff} | {blocked} |".format(
                language=block["language"],
                total="" if total is None else total,
                captured=block["captured_unique"],
                diff="" if diff is None else diff,
                blocked=block.get("blocked") or "no",
            )
        )

    lines.extend(
        [
            "",
            "## Fill Potential",
            "",
            f"- Nonzero remaining-language buckets: `{len(nonzero)}`",
            f"- Captured unique reviews across probed remaining codes: `{total_captured}`",
            f"- Sum of query_summary total_reviews across probed remaining codes: `{total_query}`",
        ]
    )
    if remaining_gap is not None:
        enough = total_captured >= remaining_gap
        lines.append(
            f"- Enough to explain `language=all` minus main CSV unique gap: `{'yes' if enough else 'no'}`"
        )
    if nonzero:
        fill_bits = ", ".join(f"{b['language']} {b['captured_unique']}" for b in nonzero)
        lines.append(f"- Nonzero captured buckets: `{fill_bits}`")
    REPORT_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    RESCUE.mkdir(parents=True, exist_ok=True)
    all_summary, all_error = fetch_query_summary("all")
    blocks = [fetch_language(language) for language in LANGUAGES if language not in MAIN_LANGUAGE_CODES]
    payload = {
        "app_id": APP_ID,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "language_all_query_summary": all_summary,
        "language_all_error": all_error,
        "main_csv": count_main_csv(),
        "languages": blocks,
    }
    RAW_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(payload)
    print(
        json.dumps(
            {
                "languages": len(blocks),
                "captured_unique": sum(block["captured_unique"] for block in blocks),
                "raw": str(RAW_OUT),
                "report": str(REPORT_OUT),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
