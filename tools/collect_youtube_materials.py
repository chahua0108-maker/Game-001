#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path


OUT_DIR = Path("outputs/research/vampire-crawlers/youtube")
COOKIE_PROFILE = "chrome:Profile 3"

VIDEOS = [
    {
        "id": "JbDVqLlLarY",
        "url": "https://www.youtube.com/watch?v=JbDVqLlLarY",
        "label": "official_announcement",
        "segments": [("first_person_and_cards", "00:00:10", "00:00:45")],
    },
    {
        "id": "SARs48njusw",
        "url": "https://www.youtube.com/watch?v=SARs48njusw",
        "label": "official_gameplay_preview",
        "segments": [("dungeon_hand_cards_combo", "00:00:05", "00:00:55")],
    },
    {
        "id": "jaAEKYGnxrA",
        "url": "https://www.youtube.com/watch?v=jaAEKYGnxrA",
        "label": "official_release_date",
        "segments": [("montage_price_platform", "00:00:05", "00:00:45")],
    },
    {
        "id": "2uBGewEqOVg",
        "url": "https://www.youtube.com/watch?v=2uBGewEqOVg",
        "label": "official_launch",
        "segments": [("explore_combat_reward", "00:00:10", "00:00:58")],
    },
    {
        "id": "N-2fBC8HQGg",
        "url": "https://www.youtube.com/watch?v=N-2fBC8HQGg",
        "label": "ign_gameplay_trailer",
        "segments": [("gameplay_ui_reward", "00:00:08", "00:00:55")],
    },
    {
        "id": "mIWM2X7hGTY",
        "url": "https://www.youtube.com/watch?v=mIWM2X7hGTY",
        "label": "gamespot_review",
        "segments": [
            ("movement_rooms", "00:01:00", "00:01:18"),
            ("combat_ui", "00:02:00", "00:02:22"),
            ("progression_build", "00:04:00", "00:04:24"),
        ],
    },
    {
        "id": "VnCBHQE8QEk",
        "url": "https://www.youtube.com/watch?v=VnCBHQE8QEk",
        "label": "nintendolife_review",
        "segments": [
            ("switch_readability", "00:00:30", "00:00:50"),
            ("card_combat", "00:03:00", "00:03:24"),
            ("progression", "00:05:00", "00:05:24"),
        ],
    },
    {
        "id": "W0oLVRffmiQ",
        "url": "https://www.youtube.com/watch?v=W0oLVRffmiQ",
        "label": "switchup_review",
        "segments": [
            ("performance_ui", "00:00:30", "00:00:55"),
            ("combat_progression", "00:02:00", "00:02:28"),
            ("shop_upgrade", "00:04:30", "00:04:55"),
        ],
    },
    {
        "id": "7p5sDTjkug4",
        "url": "https://www.youtube.com/watch?v=7p5sDTjkug4",
        "label": "spiffing_brit_longplay",
        "segments": [
            ("early_loop", "00:05:00", "00:05:28"),
            ("build_breakpoint", "00:10:00", "00:10:30"),
            ("late_pressure", "00:20:00", "00:20:30"),
        ],
    },
]


def run(cmd: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def ffmpeg_contact_sheet(clip_path: Path, sheet_path: Path) -> bool:
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(clip_path),
        "-vf",
        "fps=2,scale=320:-1,tile=6x4",
        "-frames:v",
        "1",
        str(sheet_path),
    ]
    result = run(cmd)
    return result.returncode == 0 and sheet_path.exists()


def collect_metadata(video: dict) -> dict:
    video_dir = OUT_DIR / video["label"]
    video_dir.mkdir(parents=True, exist_ok=True)
    info_path = video_dir / f"{video['id']}.info.json"

    cmd = [
        "yt-dlp",
        "--cookies-from-browser",
        COOKIE_PROFILE,
        "--skip-download",
        "--write-info-json",
        "--write-comments",
        "--extractor-args",
        "youtube:max_comments=300",
        "--write-auto-subs",
        "--sub-langs",
        "en.*,zh.*,ja.*,-live_chat",
        "--sub-format",
        "vtt",
        "-o",
        str(video_dir / "%(id)s.%(ext)s"),
        video["url"],
    ]
    result = run(cmd)
    status = {
        "label": video["label"],
        "id": video["id"],
        "url": video["url"],
        "metadata_dir": str(video_dir.resolve()),
        "info_json": str(info_path.resolve()) if info_path.exists() else None,
        "metadata_returncode": result.returncode,
        "metadata_stderr_tail": result.stderr[-2000:],
    }

    if info_path.exists():
        data = json.loads(info_path.read_text(encoding="utf-8"))
        status.update(
            {
                "title": data.get("title"),
                "channel": data.get("channel") or data.get("uploader"),
                "duration": data.get("duration"),
                "duration_string": data.get("duration_string"),
                "upload_date": data.get("upload_date"),
                "view_count": data.get("view_count"),
                "like_count": data.get("like_count"),
                "comment_count_reported": data.get("comment_count"),
                "comments_collected": len(data.get("comments") or []),
                "subtitle_files": [str(p.resolve()) for p in video_dir.glob("*.vtt")],
            }
        )
    return status


def collect_segments(video: dict) -> list[dict]:
    segment_results = []
    video_dir = OUT_DIR / video["label"]
    clips_dir = video_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    for name, start, end in video.get("segments", []):
        output_template = clips_dir / f"{video['id']}_{name}.%(ext)s"
        cmd = [
            "yt-dlp",
            "--cookies-from-browser",
            COOKIE_PROFILE,
            "-f",
            "bv*[height<=720]+ba/b[height<=720]/b",
            "--download-sections",
            f"*{start}-{end}",
            "--force-keyframes-at-cuts",
            "-o",
            str(output_template),
            video["url"],
        ]
        result = run(cmd)
        clip_candidates = sorted(clips_dir.glob(f"{video['id']}_{name}.*"))
        clip_candidates = [p for p in clip_candidates if p.suffix.lower() in {".mp4", ".mkv", ".webm"}]
        clip_path = clip_candidates[0] if clip_candidates else None
        sheet_path = clips_dir / f"{video['id']}_{name}_contact_sheet.jpg"
        sheet_ok = ffmpeg_contact_sheet(clip_path, sheet_path) if clip_path else False
        segment_results.append(
            {
                "video_id": video["id"],
                "label": video["label"],
                "segment": name,
                "start": start,
                "end": end,
                "clip_path": str(clip_path.resolve()) if clip_path else None,
                "contact_sheet": str(sheet_path.resolve()) if sheet_ok else None,
                "download_returncode": result.returncode,
                "download_stderr_tail": result.stderr[-2000:],
            }
        )
    return segment_results


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    metadata = []
    segments = []
    for video in VIDEOS:
        metadata.append(collect_metadata(video))
        segments.extend(collect_segments(video))

    summary = {
        "cookie_profile_used": COOKIE_PROFILE,
        "videos": metadata,
        "segments": segments,
    }
    summary_path = OUT_DIR / "youtube_collection_summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
