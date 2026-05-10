#!/usr/bin/env python3
import csv
import json
import subprocess
import time
from pathlib import Path
from urllib.parse import urlencode


APP_ID = "3265700"
BASE = Path("outputs/research/vampire-crawlers")
OUT_RAW = BASE / "steam_reviews_by_language_raw.json"
OUT_CSV = BASE / "steam_reviews_merged_flat.csv"
LANGUAGES = [
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
]


def curl_json(url: str, tries: int = 8) -> dict:
    last = ""
    for attempt in range(1, tries + 1):
        result = subprocess.run(
            [
                "curl",
                "--http1.1",
                "-L",
                "--compressed",
                "--retry",
                "2",
                "--retry-all-errors",
                "--retry-delay",
                "2",
                "--connect-timeout",
                "20",
                "--max-time",
                "70",
                "-A",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "-sS",
                url,
            ],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        last = result.stderr or result.stdout[:200]
        if result.returncode == 0 and result.stdout.strip():
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                last = result.stdout[:200]
        time.sleep(min(45, attempt * 5))
    raise RuntimeError(f"failed after {tries} tries: {last}")


def fetch_language(language: str) -> dict:
    cursor = "*"
    reviews = []
    pages = []
    seen = set()
    query_summary = None
    for page in range(300):
        params = {
            "json": "1",
            "filter": "recent",
            "language": language,
            "purchase_type": "all",
            "num_per_page": "100",
            "cursor": cursor,
        }
        url = f"https://store.steampowered.com/appreviews/{APP_ID}?{urlencode(params)}"
        data = curl_json(url)
        if data.get("success") != 1:
            raise RuntimeError(f"{language} unsuccessful page {page + 1}: {data!r}")
        page_reviews = data.get("reviews") or []
        query_summary = query_summary or data.get("query_summary") or {}
        pages.append(
            {
                "page": page + 1,
                "cursor_in": cursor,
                "cursor_out": data.get("cursor"),
                "reviews": len(page_reviews),
            }
        )
        new_count = 0
        for review in page_reviews:
            rid = review.get("recommendationid")
            if rid and rid not in seen:
                seen.add(rid)
                reviews.append(review)
                new_count += 1
        next_cursor = data.get("cursor")
        if not page_reviews or not next_cursor or next_cursor == cursor or new_count == 0:
            break
        cursor = next_cursor
        if (page + 1) % 10 == 0:
            print(f"{language}: pages={page + 1} reviews={len(reviews)}", flush=True)
        time.sleep(0.8)
    return {"language": language, "query_summary": query_summary, "pages": pages, "reviews": reviews}


def flatten(review: dict) -> dict:
    author = review.get("author") or {}
    return {
        "recommendationid": review.get("recommendationid"),
        "language": review.get("language"),
        "review": review.get("review"),
        "voted_up": review.get("voted_up"),
        "timestamp_created": review.get("timestamp_created"),
        "timestamp_updated": review.get("timestamp_updated"),
        "author.playtime_forever": author.get("playtime_forever"),
        "author.playtime_at_review": author.get("playtime_at_review"),
        "steam_purchase": review.get("steam_purchase"),
        "received_for_free": review.get("received_for_free"),
        "votes_up": review.get("votes_up"),
        "votes_funny": review.get("votes_funny"),
        "weighted_vote_score": review.get("weighted_vote_score"),
        "comment_count": review.get("comment_count"),
        "primarily_steam_deck": review.get("primarily_steam_deck"),
    }


def main() -> None:
    BASE.mkdir(parents=True, exist_ok=True)
    all_blocks = []
    all_reviews = {}

    existing = BASE / "steam_reviews_raw.json"
    if existing.exists():
        data = json.loads(existing.read_text(encoding="utf-8"))
        for review in data.get("reviews") or []:
            rid = review.get("recommendationid")
            if rid:
                all_reviews[rid] = review

    for language in LANGUAGES:
        block = fetch_language(language)
        all_blocks.append(block)
        for review in block["reviews"]:
            rid = review.get("recommendationid")
            if rid:
                all_reviews[rid] = review
        OUT_RAW.write_text(
            json.dumps(
                {
                    "app_id": APP_ID,
                    "languages": all_blocks,
                    "merged_count_so_far": len(all_reviews),
                    "crawl_status": "partial_in_progress",
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    rows = [flatten(review) for review in all_reviews.values()]
    fields = list(rows[0].keys()) if rows else []
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    OUT_RAW.write_text(
        json.dumps(
            {
                "app_id": APP_ID,
                "languages": all_blocks,
                "merged_count": len(rows),
                "crawl_status": "partial_language_bucketed",
                "merged_csv": str(OUT_CSV.resolve()),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps({"merged_count": len(rows), "csv": str(OUT_CSV.resolve())}, ensure_ascii=False))


if __name__ == "__main__":
    main()
