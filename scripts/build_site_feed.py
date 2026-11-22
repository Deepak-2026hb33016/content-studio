import json
from pathlib import Path

QUEUE_PATH = Path("queue/posts.json")
OUT_DIR = Path("site-data/insights")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    posts = json.loads(QUEUE_PATH.read_text(encoding="utf-8"))
    published_index = []

    for post in posts:
        if post.get("status") not in {"approved", "published"}:
            continue
        slug = post.get("website_slug", "").strip("/")
        key = slug.split("/")[-1] if slug else post["id"]
        article = post.get("companion_article", {})

        payload = {
            "id": post["id"],
            "slug": f"/{slug}" if slug else f"/insights/{post['id']}",
            "scheduled_date": post.get("scheduled_date", ""),
            "pillar": post.get("pillar", ""),
            "title": article.get("title") or post["id"],
            "summary": article.get("summary", ""),
            "sections": article.get("sections", []),
            "source_hook": post.get("raw_note", ""),
        }
        (OUT_DIR / f"{key}.json").write_text(
            json.dumps(payload, indent=2), encoding="utf-8"
        )
        published_index.append(
            {
                "id": payload["id"],
                "slug": payload["slug"],
                "scheduled_date": payload["scheduled_date"],
                "pillar": payload["pillar"],
                "title": payload["title"],
                "summary": payload["summary"],
            }
        )

    (OUT_DIR / "index.json").write_text(
        json.dumps(published_index, indent=2), encoding="utf-8"
    )
    print(f"Built {len(published_index)} companion insight feed(s).")


if __name__ == "__main__":
    main()
