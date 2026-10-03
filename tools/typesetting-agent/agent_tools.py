"""Optional headless AI tool adapter. No UI, server, model credentials or shell access."""
from collections import OrderedDict
from copy import deepcopy
from io import BytesIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from fontTools.ttLib import TTFont
from jsonschema import Draft202012Validator
import pyphen
from shapely.geometry import Polygon, box
import typst
import uharfbuzz as hb

from linebreak import optimize
from schemas import DEFINITIONS, TOOLS


class TypesettingTools:
    """Fonts and artifact storage are trusted host configuration, never LLM arguments.

    Instantiate per worker; the bounded measurement/dictionary caches are not shared.
    Font bytes are loaded once, so cache contents cannot become stale after file edits.
    """
    def __init__(self, fonts, save_pdf=None):
        if len(fonts) > 32:
            raise ValueError("At most 32 registered fonts per worker")
        self.fonts = {}
        for font_id, path in fonts.items():
            with Path(path).open("rb") as source:
                data = source.read(16 * 1024 * 1024 + 1)
            if len(data) > 16 * 1024 * 1024:
                raise ValueError("Font exceeds 16 MiB")
            with TTFont(BytesIO(data), lazy=False) as font:
                if font.flavor is not None:
                    raise ValueError("Register a desktop TTF/OTF, not WOFF")
                family = font["name"].getBestFamilyName()
                metrics = {"font_id": font_id, "family": family, "units_per_em": font["head"].unitsPerEm,
                           "glyph_count": font["maxp"].numGlyphs,
                           "ascender_units": font["hhea"].ascent, "descender_units": font["hhea"].descent,
                           "unicode_codepoint_count": len(font.getBestCmap() or {}),
                           "variable_axes": [{"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue, "max": a.maxValue}
                                             for a in font["fvar"].axes] if "fvar" in font else []}
                embedding = font["OS/2"].fsType if "OS/2" in font else 0
            self.fonts[font_id] = (data, metrics, embedding)
        self.save_pdf = save_pdf
        self.measurements = OrderedDict()
        self.dictionaries = OrderedDict()
        self.validators = {name: Draft202012Validator(schema) for name, (_, schema) in DEFINITIONS.items()}

    def call(self, name, arguments):
        """Validate one JSON-compatible call; returns JSON-compatible data or ValueError."""
        if name not in self.validators:
            raise ValueError("Unknown tool")
        try:
            encoded = json.dumps(arguments, allow_nan=False)
        except (ValueError, TypeError) as error:
            raise ValueError("Arguments must be finite JSON data") from error
        if len(encoded.encode()) > 1_000_000:
            raise ValueError("Tool arguments exceed 1 MB")
        errors = list(self.validators[name].iter_errors(arguments))
        if errors:
            raise ValueError(errors[0].message)
        if "font_id" in arguments and arguments["font_id"] not in self.fonts:
            raise ValueError("Unknown registered font_id")
        return getattr(self, "_" + name)(**arguments)

    def _inspect_font(self, font_id):
        return deepcopy(self.fonts[font_id][1])

    def _measure_text_run(self, font_id, text, font_size_pt, direction, language, script):
        if any(c in text for c in "\r\n\t"):
            raise ValueError("Measure one run without tabs or line separators")
        key = (font_id, text, font_size_pt, direction, language, script)
        if key not in self.measurements:
            font = hb.Font(hb.Face(self.fonts[font_id][0]))
            font.scale = (font.face.upem, font.face.upem)
            buffer = hb.Buffer()
            buffer.add_str(text)
            buffer.direction, buffer.language, buffer.script = direction, language, script
            hb.shape(font, buffer, {"kern": True, "liga": True, "mark": True, "mkmk": True, "ccmp": True})
            advance = abs(sum(p.x_advance for p in buffer.glyph_positions)) * font_size_pt / font.face.upem
            self.measurements[key] = {"advance_width_pt": advance, "advance_width_mm": advance * 25.4 / 72,
                                      "glyph_count": len(buffer.glyph_infos), "has_missing_glyphs": any(g.codepoint == 0 for g in buffer.glyph_infos)}
            if len(self.measurements) > 128:
                self.measurements.popitem(last=False)
        self.measurements.move_to_end(key)
        return deepcopy(self.measurements[key])

    def _hyphenate_word(self, word, language):
        if any(c.isspace() for c in word):
            raise ValueError("Expected a single word")
        language = pyphen.language_fallback(language.replace("-", "_"))
        if language is None:
            raise ValueError("No installed hyphenation dictionary for this language")
        if language not in self.dictionaries:
            self.dictionaries[language] = pyphen.Pyphen(lang=language)
            if len(self.dictionaries) > 8:
                self.dictionaries.popitem(last=False)
        self.dictionaries.move_to_end(language)
        dictionary = self.dictionaries[language]
        # Pyphen also caches queried words internally; bound that cache per dictionary.
        if len(dictionary.hd.cache) >= 128:
            dictionary.hd.cache.clear()
        positions = dictionary.positions(word)
        if any(p.data is not None for p in positions):
            raise ValueError("This word requires nonstandard spelling changes at a hyphen; positions alone are insufficient")
        if len(word.lower()) != len(word):
            raise ValueError("Case folding changes character offsets for this word")
        return {"language": language, "positions": [int(p) for p in positions]}

    def _optimize_paragraph(self, items, line_widths_pt, tolerance):
        if any(i["shrink_after_pt"] > i["space_after_pt"] for i in items):
            raise ValueError("Glue cannot shrink below zero")
        return optimize(items, line_widths_pt, tolerance)

    def _compute_text_slots(self, frame, polygons, bands, clearance_pt, direction):
        x, y, w, h = (frame[k] for k in ("x", "y", "width", "height"))
        obstacles = []
        for coordinates in polygons:
            polygon = Polygon(coordinates)
            if not polygon.is_valid or polygon.area <= 0:
                raise ValueError("Obstacles must be valid nonzero-area polygons")
            # Square expansion encloses a circular clearance, so no chord approximation
            # can under-clear corners. Slightly conservative around acute corners.
            obstacles.append(polygon.buffer(clearance_pt, join_style="mitre") if clearance_pt else polygon)
        result = []
        for band in bands:
            top, bottom = band["top"], band["bottom"]
            if not y <= top < bottom <= y + h:
                raise ValueError("Full line band must lie inside the frame")
            strip = box(x, top, x + w, bottom)
            blocked = []
            for obstacle in obstacles:
                intersection = obstacle.intersection(strip)
                if intersection.is_empty:
                    continue
                parts = intersection.geoms if hasattr(intersection, "geoms") else [intersection]
                for part in parts:
                    if not part.is_empty:
                        blocked.append((max(x, part.bounds[0]), min(x + w, part.bounds[2])))
            slots, cursor = [], x
            for left, right in sorted(blocked):
                if left > cursor:
                    slots.append({"x": cursor, "width": left - cursor})
                cursor = max(cursor, right)
            if cursor < x + w:
                slots.append({"x": cursor, "width": x + w - cursor})
            if direction == "rtl":
                slots.reverse()
            result.append({"top": top, "bottom": bottom, "slots": slots})
        return {"bands": result}

    def _export_pdf(self, font_id, text, font_size_pt, direction, language,
                    page_width_pt, page_height_pt, margin_pt, standard):
        if self.save_pdf is None:
            raise ValueError("Host must configure a new-artifact PDF sink")
        if 2 * margin_pt >= min(page_width_pt, page_height_pt):
            raise ValueError("Margins leave no content area")
        data, metadata, embedding = self.fonts[font_id]
        if embedding & (0x2 | 0x100 | 0x200):
            raise ValueError("Font embedding/subsetting restrictions prevent this export")
        if not metadata["family"]:
            raise ValueError("Font has no usable family name")
        # Text travels as JSON data, never executable Typst markup or a filename.
        template = b'''#let data = json(bytes(sys.inputs.at("data")))
#set page(width: data.width * 1pt, height: data.height * 1pt, margin: data.margin * 1pt)
#set text(font: data.font, size: data.size * 1pt, lang: data.lang, dir: if data.rtl { rtl } else { ltr }, fallback: false)
#data.text
'''
        payload = json.dumps({"text": text, "font": metadata["family"], "size": font_size_pt,
                              "lang": language.replace("_", "-"), "rtl": direction == "rtl",
                              "width": page_width_pt, "height": page_height_pt, "margin": margin_pt})
        with TemporaryDirectory(prefix="tok-pdf-") as folder:
            font_path = Path(folder) / "registered.ttf"
            font_path.write_bytes(data)
            pdf, warnings = typst.compile_with_warnings(template, root=folder, font_paths=[folder],
                                ignore_system_fonts=True, sys_inputs={"data": payload},
                                pdf_standards=[standard], timestamp=0)
        if warnings:
            raise ValueError(f"PDF compiler reported warnings: {warnings}")
        if len(pdf) > 16 * 1024 * 1024:
            raise ValueError("PDF exceeds output limit")
        artifact_id = self.save_pdf(pdf)
        return {"artifact_id": artifact_id, "bytes": len(pdf), "standard": standard,
                "preflight": "not_performed", "pdf_x": False}
