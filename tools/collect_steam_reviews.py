#!/usr/bin/env python3
import csv
import http.client
import json
import socket
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path


APP_ID = "3265700"
OUT_DIR = Path("outputs/research/vampire-crawlers")
BASE_URL = f"https://store.steampowered.com/appreviews/{APP_ID}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch_page(cursor: str, num_per_page: int = 100, retries: int = 10) -> dict:
    params = {
        "json": "1",
        "filter": "recent",
        "language": "all",
        "purchase_type": "all",
        "num_per_page": str(num_per_page),
        "cursor": cursor,
    }
    url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers=HEADERS)
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            curl = subprocess.run(
                [
                    "curl",
                    "-L",
                    "--compressed",
                    "--retry",
                    "3",
                    "--retry-delay",
                    "2",
                    "--connect-timeout",
                    "20",
                    "--max-time",
                    "60",
                    "-A",
                    HEADERS["User-Agent"],
                    "-H",
                    "Accept: application/json,text/plain,*/*",
                    "-H",
                    "Accept-Language: en-US,en;q=0.9",
                    "-sS",
                    url,
                ],
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=75,
            )
            if curl.returncode != 0:
                raise RuntimeError(curl.stderr.strip() or f"curl exited {curl.returncode}")
            if not curl.stdout.strip():
                raise RuntimeError("empty response")
            return json.loads(curl.stdout)
        except (
            TimeoutError,
            socket.timeout,
            urllib.error.URLError,
            http.client.RemoteDisconnected,
            subprocess.TimeoutExpired,
            json.JSONDecodeError,
            RuntimeError,
        ) as error:
            last_error = error
            time.sleep(min(30, attempt * 3))
    raise RuntimeError(f"Failed to fetch cursor after {retries} attempts: {cursor}") from last_error


def flatten_review(item: dict) -> dict:
    author = item.get("author") or {}
    return {
        "recommendationid": item.get("recommendationid"),
        "language": item.get("language"),
        "review": item.get("review"),
        "voted_up": item.get("voted_up"),
        "timestamp_created": item.get("timestamp_created"),
        "timestamp_updated": item.get("timestamp_updated"),
        "steam_purchase": item.get("steam_purchase"),
        "received_for_free": item.get("received_for_free"),
        "written_during_early_access": item.get("written_during_early_access"),
        "votes_up": item.get("votes_up"),
        "votes_funny": item.get("votes_funny"),
        "weighted_vote_score": item.get("weighted_vote_score"),
        "comment_count": item.get("comment_count"),
        "playtime_forever": author.get("playtime_forever"),
        "playtime_at_review": author.get("playtime_at_review"),
        "playtime_last_two_weeks": author.get("playtime_last_two_weeks"),
        "last_played": author.get("last_played"),
        "num_games_owned": author.get("num_games_owned"),
        "num_reviews": author.get("num_reviews"),
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_path = OUT_DIR / "steam_reviews_raw.json"
    flat_path = OUT_DIR / "steam_reviews_flat.csv"
    summary_path = OUT_DIR / "steam_reviews_summary.json"
    progress_path = OUT_DIR / "steam_reviews_pages.jsonl"
    checkpoint_path = OUT_DIR / "steam_reviews_checkpoint.json"

    cursor = "*"
    seen = set()
    reviews = []
    pages = []
    query_summary = None

    if checkpoint_path.exists():
        checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8"))
        cursor = checkpoint.get("next_cursor") or "*"
        reviews = checkpoint.get("reviews") or []
        pages = checkpoint.get("pages") or []
        query_summary = checkpoint.get("query_summary") or None
        seen = {review.get("recommendationid") for review in reviews if review.get("recommendationid")}
        print(f"resuming pages={len(pages)} reviews={len(reviews)}", flush=True)

    with progress_path.open("a", encoding="utf-8") as progress:
        for page_index in range(len(pages), 500):
            payload = fetch_page(cursor)
            if payload.get("success") != 1:
                raise RuntimeError(f"Steam returned unsuccessful payload on page {page_index}: {payload!r}")

            page_reviews = payload.get("reviews") or []
            if query_summary is None:
                query_summary = payload.get("query_summary") or {}

            page_record = {
                "page": page_index + 1,
                "cursor_in": cursor,
                "cursor_out": payload.get("cursor"),
                "reviews": len(page_reviews),
            }
            pages.append(page_record)
            progress.write(json.dumps(page_record, ensure_ascii=False) + "\n")
            progress.flush()

            new_count = 0
            for review in page_reviews:
                review_id = review.get("recommendationid")
                if review_id and review_id not in seen:
                    seen.add(review_id)
                    reviews.append(review)
                    new_count += 1

            next_cursor = payload.get("cursor")
            if not page_reviews or not next_cursor or next_cursor == cursor or new_count == 0:
                break
            cursor = next_cursor
            checkpoint_path.write_text(
                json.dumps(
                    {
                        "app_id": APP_ID,
                        "query_summary": query_summary,
                        "pages": pages,
                        "reviews": reviews,
                        "next_cursor": cursor,
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            if (page_index + 1) % 10 == 0:
                checkpoint_path.write_text(
                    json.dumps(
                        {
                            "app_id": APP_ID,
                            "query_summary": query_summary,
                            "pages": pages,
                            "reviews": reviews,
                            "next_cursor": cursor,
                        },
                        ensure_ascii=False,
                    ),
                    encoding="utf-8",
                )
                print(f"pages={page_index + 1} reviews={len(reviews)}", flush=True)
            time.sleep(0.28)

    flat_reviews = [flatten_review(review) for review in reviews]
    fields = list(flat_reviews[0].keys()) if flat_reviews else []

    raw_path.write_text(
        json.dumps(
            {
                "app_id": APP_ID,
                "query_summary": query_summary,
                "pages": pages,
                "reviews": reviews,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    with flat_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(flat_reviews)

    positives = sum(1 for row in flat_reviews if row["voted_up"] is True)
    negatives = sum(1 for row in flat_reviews if row["voted_up"] is False)
    languages = {}
    for row in flat_reviews:
        lang = row["language"] or "unknown"
        languages[lang] = languages.get(lang, 0) + 1

    timestamps = [row["timestamp_created"] for row in flat_reviews if row.get("timestamp_created")]
    summary = {
        "app_id": APP_ID,
        "records_collected": len(flat_reviews),
        "query_summary": query_summary,
        "positive_collected": positives,
        "negative_collected": negatives,
        "language_distribution": dict(sorted(languages.items(), key=lambda kv: kv[1], reverse=True)),
        "created_min": min(timestamps) if timestamps else None,
        "created_max": max(timestamps) if timestamps else None,
        "raw_path": str(raw_path.resolve()),
        "flat_csv_path": str(flat_path.resolve()),
        "pages": pages,
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
