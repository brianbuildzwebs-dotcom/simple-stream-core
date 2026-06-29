"""Copy the provided logo image as-is into public assets (no reprocessing)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets' / 'logo-source.jpg'
LOGO = ROOT / 'public' / 'simple-streamz-logo.png'
ICON = ROOT / 'public' / 'simple-streamz-icon.png'

FALLBACK = Path(
    r'C:\Users\Brian\.grok\sessions\C%3A%5CUsers%5CBrian%5C.grok%5Cworktrees%5Cdownloads-simple-stream-core%5C2026-06-10-4864cf57\019eb34b-0fd8-7cb2-a10e-f72e268dc319\assets\image-1813df87-5f2d-4d02-bc86-7545c3c572d5.jpg'
)


def main() -> None:
    src = SOURCE if SOURCE.exists() else FALLBACK
    if not src.exists():
        raise SystemExit(f'Logo source not found: {src}')

    logo = Image.open(src)
    logo.save(LOGO, 'PNG', optimize=True)

    icon = logo.copy()
    icon.thumbnail((180, 180), Image.Resampling.LANCZOS)
    icon.save(ICON, 'PNG', optimize=True)
    print(f'Wrote {LOGO} ({logo.size}) and {ICON} ({icon.size}) from {src.name}')


if __name__ == '__main__':
    main()