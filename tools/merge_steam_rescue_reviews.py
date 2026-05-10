#!/usr/bin/env python3
import csv
import json
from pathlib import Path


BASE = Path("outputs/research/vampire-crawlers")
MAIN_CSV = BASE / "steam_reviews_merged_flat.csv"
RESCUE_RAW_FILES = [
    BASE / "rescue/steam_review_rescue_raw.json",
    BASE / "rescue/steam_review_remaining_language_raw.json",
]
OUT_CSV = BASE / "steam_reviews_merged_flat.csv"
OUT_REPORT = BASE / "rescue/steam_review_rescue_merge_report.md"


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
    with MAIN_CSV.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    fieldnames = list(rows[0].keys())
    by_id = {row["recommendationid"]: row for row in rows if row.get("recommendationid")}

    added = []
    sources = []
    for raw_path in RESCUE_RAW_FILES:
        if not raw_path.exists():
            continue
        rescue = json.loads(raw_path.read_text(encoding="utf-8"))
        before_source = len(added)
        for block in rescue.get("languages") or []:
            for review in block.get("reviews") or []:
                rid = review.get("recommendationid")
                if not rid or rid in by_id:
                    continue
                row = flatten(review)
                by_id[rid] = {key: row.get(key, "") for key in fieldnames}
                added.append(by_id[rid])
        sources.append((raw_path, len(added) - before_source))

    merged = list(by_id.values())
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(merged)

    by_lang = {}
    for row in added:
        by_lang[row.get("language") or "unknown"] = by_lang.get(row.get("language") or "unknown", 0) + 1

    OUT_REPORT.write_text(
        "\n".join(
            [
                "# Steam Rescue Merge Report",
                "",
                f"- Source CSV before merge: `{len(rows)}` rows",
                f"- Added from rescue: `{len(added)}` rows",
                f"- Output CSV after merge: `{len(merged)}` rows",
                "- Added by source:",
                "",
                "| source | added |",
                "|---|---:|",
                *[f"| `{path}` | {count} |" for path, count in sources],
                "",
                "- Added by language:",
                "",
                "| language | added |",
                "|---|---:|",
                *[f"| {language} | {count} |" for language, count in sorted(by_lang.items())],
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(json.dumps({"before": len(rows), "added": len(added), "after": len(merged), "report": str(OUT_REPORT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
