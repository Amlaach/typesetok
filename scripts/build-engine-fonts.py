"""Builds the TTFs embedded by tok-typeset from the UI's WOFF2 fonts.

The engine measures text with exactly the glyphs the UI draws: each font's
Hebrew and Latin WOFF2 subsets in assets/fonts/ui are merged into one TTF in
assets/fonts. Requires fontTools and brotli:  pip install fonttools brotli
Run from the repo root:  python scripts/build-engine-fonts.py
"""

import os
import tempfile

from fontTools.merge import Merger
from fontTools.ttLib import TTFont

UI = os.path.join("assets", "fonts", "ui")
OUT = os.path.join("assets", "fonts")

FONTS = {
    "FrankRuhlLibre-Regular.ttf": ("frank-ruhl-libre-hebrew-400-normal", "frank-ruhl-libre-latin-400-normal"),
    "NotoRashiHebrew-Regular.ttf": ("noto-rashi-hebrew-hebrew-400-normal", "noto-rashi-hebrew-latin-400-normal"),
}


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        for out_name, subsets in FONTS.items():
            parts = []
            for name in subsets:
                font = TTFont(os.path.join(UI, name + ".woff2"))
                font.flavor = None
                path = os.path.join(tmp, name + ".ttf")
                font.save(path)
                parts.append(path)
            merged_path = os.path.join(tmp, out_name)
            Merger().merge(parts).save(merged_path)
            # Deterministic output: keep the source font's timestamps.
            source_head = TTFont(os.path.join(UI, subsets[0] + ".woff2"))["head"]
            font = TTFont(merged_path, recalcTimestamp=False)
            font["head"].created = source_head.created
            font["head"].modified = source_head.modified
            font.save(os.path.join(OUT, out_name))
            print(f"{out_name}: {font['maxp'].numGlyphs} glyphs")


if __name__ == "__main__":
    main()
