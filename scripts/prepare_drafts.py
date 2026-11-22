import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from google import genai
from google.genai import types

QUEUE_PATH = Path("queue/posts.json")
DRAFTS_DIR = Path("drafts")
DRAFTS_DIR.mkdir(exist_ok=True)

SYSTEM_PROMPT = """
You are a sharp practitioner writing for Deepak Kondappa's personal brand ecosystem
(AEM architecture, workflow automation, content supply chains, MarTech systems, and
digital transformation).

Rules:
- Direct, grounded, and practical. No corporate buzzwords or filler ("delve", "game-changer", "unlock").
- Lead with concrete operational friction and explicit trade-offs.
- LinkedIn post: crisp short paragraphs, clear contrast, one natural closing question, and a link
  to https://deepakkondappa.codes<website_slug> for deeper reading.
- Companion article: practical structure (Problem / AS-IS vs. TO-BE / Trade-offs / Checklist)
  that can be rendered onto deepakkondappa.codes.
"""

def main():
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    posts = json.loads(QUEUE_PATH.read_text(encoding="utf-8"))
    horizon = datetime.utcnow().date() + timedelta(days=10)
    updated = False

    for post in posts:
        if post.get("status") != "idea":
            continue
        sched = datetime.strptime(post["scheduled_date"], "%Y-%m-%d").date()
        if sched <= horizon:
            prompt = f"""
            Pillar: {post.get('pillar', 'Systems & Operations')}
            Scheduled Date: {post['scheduled_date']}
            Website URL: https://deepakkondappa.codes{post['website_slug']}
            Raw Note: {post['raw_note']}
            """
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "linkedin_post": {"type": "STRING"},
                            "first_comment": {"type": "STRING"},
                            "carousel_slides": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"}
                            },
                            "companion_title": {"type": "STRING"},
                            "companion_summary": {"type": "STRING"},
                            "companion_sections": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"}
                            }
                        },
                        "required": [
                            "linkedin_post",
                            "first_comment",
                            "carousel_slides",
                            "companion_title",
                            "companion_summary",
                            "companion_sections"
                        ]
                    }
                )
            )
            data = json.loads(response.text)
            post["linkedin_post"] = data["linkedin_post"]
            post["first_comment"] = data["first_comment"]
            post["carousel_outline"] = data["carousel_slides"]
            post["companion_article"] = {
                "title": data["companion_title"],
                "summary": data["companion_summary"],
                "sections": data["companion_sections"]
            }
            post["status"] = "draft_ready"
            updated = True

            md = (
                f"# {data['companion_title']}\n\n"
                f"**Scheduled:** {post['scheduled_date']} | **URL:** https://deepakkondappa.codes{post['website_slug']}\n\n"
                f"## LinkedIn Post\n\n{data['linkedin_post']}\n\n"
                f"## First Comment\n\n{data['first_comment']}\n\n"
                f"## Carousel Outline\n" + "\n".join(f"- {s}" for s in data["carousel_slides"]) + "\n\n"
                f"## Website Companion Draft\n\n{data['companion_summary']}\n\n"
                + "\n\n".join(data["companion_sections"]) + "\n"
            )
            (DRAFTS_DIR / f"{post['id']}.md").write_text(md, encoding="utf-8")

    if updated:
        QUEUE_PATH.write_text(json.dumps(posts, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
