"""Vendor-neutral Function Calling declarations; runtime validates the same schema."""

def obj(properties):
    return {"type": "object", "properties": properties,
            "required": list(properties), "additionalProperties": False}


def number(low=0, high=1_000_000):
    return {"type": "number", "minimum": low, "maximum": high}


def array(items, limit, minimum=0):
    return {"type": "array", "items": items, "minItems": minimum, "maxItems": limit}


FONT = {"type": "string", "minLength": 1, "maxLength": 128}
TEXT = {"type": "string", "minLength": 1, "maxLength": 20_000}
DIRECTION = {"type": "string", "enum": ["rtl", "ltr"]}
LANGUAGE = {"type": "string", "pattern": "^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8})*$", "maxLength": 35}
POINT = array(number(-1_000_000), 2, 2)
RECT = obj({"x": number(-1_000_000), "y": number(-1_000_000),
            "width": number(0.01), "height": number(0.01)})
FRAGMENT = obj({"width_pt": number(), "space_after_pt": number(),
                "stretch_after_pt": number(), "shrink_after_pt": number(),
                "break_penalty": number(-10000, 10000), "break_width_pt": number()})
DEFINITIONS = {
    "inspect_font": ("Inspect a host-registered font: family, metrics, glyph count, Unicode coverage and variable axes.",
                     obj({"font_id": FONT})),
    "measure_text_run": ("Measure advance width in pt/mm after OpenType shaping. Input must be a single resolved directional/script run; this is not paragraph BiDi or an ink bounding box.",
                         obj({"font_id": FONT, "text": TEXT, "font_size_pt": number(1, 300),
                              "direction": DIRECTION, "language": LANGUAGE,
                              "script": {"type": "string", "pattern": "^[A-Z][a-z]{3}$"}})),
    "hyphenate_word": ("Return dictionary-supported hyphenation positions as Unicode character offsets. Unsupported languages fail explicitly. Does not modify the word.",
                       obj({"word": {"type": "string", "minLength": 1, "maxLength": 256}, "language": LANGUAGE})),
    "optimize_paragraph": ("Find globally minimum-cost feasible breaks over premeasured fragments and stretch/shrink glue. Widths repeat the final entry. Returned ranges are end-exclusive. Last line is ragged. Not full TeX fitness-class handling.",
                           obj({"items": array(FRAGMENT, 256), "line_widths_pt": array(number(0.01), 256, 1), "tolerance": number(0, 10)})),
    "compute_text_slots": ("Return horizontal free slots for each full line band around buffered polygons, in reading order. Units pt, origin top-left, y downward. Conservative within each connected obstacle fragment; text is not reflowed by this call.",
                           obj({"frame": RECT, "polygons": array(array(POINT, 256, 3), 64),
                                "bands": array(obj({"top": number(-1_000_000), "bottom": number(-1_000_000)}), 512),
                                "clearance_pt": number(0, 1000), "direction": DIRECTION})),
    "export_pdf": ("Create a new PDF artifact from literal plain text using Typst and a registered font. Returns an artifact ID from the host. Supports PDF 1.7 or PDF/A-2b; does not promise PDF/X or printer-specific preflight. Does not accept markup or paths.",
                   obj({"font_id": FONT, "text": TEXT, "font_size_pt": number(1, 300),
                        "direction": DIRECTION, "language": LANGUAGE,
                        "page_width_pt": number(72, 3000), "page_height_pt": number(72, 3000),
                        "margin_pt": number(0, 1000), "standard": {"type": "string", "enum": ["1.7", "a-2b"]}})),
}
TOOLS = [{"type": "function", "function": {"name": name, "description": description, "parameters": schema}}
         for name, (description, schema) in DEFINITIONS.items()]
