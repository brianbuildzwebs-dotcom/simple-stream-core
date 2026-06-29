"""Generate a 1200x630 Open Graph preview image (local dev only).

Run manually when the logo changes: npm run og:image
og-image.png is committed to public/ — Cloudflare Workers Builds has no Python/Pillow.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "public" / "simple-streamz-logo.png"
OUT = ROOT / "public" / "og-image.png"

W, H = 1200, 630
BG = (10, 10, 15)
ACCENT = (59, 130, 246)


def main():
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)

    draw.rectangle([(0, H - 6), (W, H)], fill=ACCENT)

    if LOGO.exists():
        logo = Image.open(LOGO).convert("RGBA")
        max_w, max_h = 520, 220
        logo.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
        x = (W - logo.width) // 2
        y = 120
        canvas.paste(logo, (x, y), logo)

    try:
        title_font = ImageFont.truetype("arial.ttf", 42)
        sub_font = ImageFont.truetype("arial.ttf", 26)
    except OSError:
        title_font = ImageFont.load_default()
        sub_font = ImageFont.load_default()

    title = "Church live streaming on your website"
    subtitle = "One embed · OBS-ready · Family-safe chat · 10-day free trial"

    draw.text((W // 2, 380), title, fill=(245, 245, 250), font=title_font, anchor="mm")
    draw.text((W // 2, 440), subtitle, fill=(148, 163, 184), font=sub_font, anchor="mm")
    draw.text((W // 2, 560), "simplestreamz.io", fill=ACCENT, font=sub_font, anchor="mm")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()