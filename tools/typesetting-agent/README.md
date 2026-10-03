# Optional headless typesetting tools

Six validated Function Calling tools for an AI host. They are callable Python code,
not prompts, and do not change or load the Electron UI. The Rust application does
not automatically invoke them. No model API key, external AI service, network server,
or additional desktop runtime dependency is introduced.

Requires Python 3.11+. From this directory:

```sh
python -m venv .venv
# Activate the environment, then:
python -m pip install -r requirements.txt
python -m pip install pytest
python -m pytest tests -q
```

```python
from agent_tools import TypesettingTools
from schemas import TOOLS

# Host-owned font IDs and artifact storage. The model cannot supply file paths.
# store_new_artifact(bytes) must create a NEW artifact and return its identifier.
engine = TypesettingTools({"body": "/trusted/fonts/body.ttf"}, save_pdf=store_new_artifact)
# Supply TOOLS to the model's Function Calling API using its provider's wrapper.
result = engine.call("measure_text_run", {
    "font_id": "body", "text": "שלום", "font_size_pt": 12,
    "direction": "rtl", "language": "he", "script": "Hebr"
})
```

| Tool | Implementation | Result |
| --- | --- | --- |
| `inspect_font` | fontTools | Family, em units, glyph count, Unicode coverage count, variable axes |
| `measure_text_run` | HarfBuzz through uharfbuzz | Advance in pt/mm, glyph count, missing-glyph flag |
| `hyphenate_word` | Pyphen | Supported dictionary and character-index break positions |
| `optimize_paragraph` | Bounded dynamic programming with prefix sums | Minimum-cost feasible fragment ranges, widths, ratios, or explicit failure |
| `compute_text_slots` | Shapely/GEOS | Free intervals across full line bands, in reading order |
| `export_pdf` | Typst Python binding | Newly stored PDF artifact ID, byte count, requested standard |

`schemas.py` is the source of both exported JSON Schema and runtime validation.
All units are DTP points (72 pt/inch). Measurements are advances, not painted-ink
bounds. Shape a single resolved direction/script run; mixed-direction paragraphs
must first be split by the host's BiDi implementation. Measurement uses the font's
default variation coordinates. Avoid promising identical layouts between Rust,
HarfBuzz and Typst until their shaping features, font choices and break policies are aligned.

## Paragraph optimization

Each item is a premeasured word or fragment, with `width_pt`, `space_after_pt`,
`stretch_after_pt`, `shrink_after_pt`, `break_penalty`, and `break_width_pt`.
Trailing space/stretch/shrink are discarded at a break. A discretionary break
adds `break_width_pt` only when selected, and only before the paragraph end.
For hyphenated word fragments, set unbroken space/stretch/shrink to zero and
supply the hyphen width and penalty. The caller inserts the displayed hyphen and
reshapes around the selected break if required by the script/font.

The final entry of `line_widths_pt` repeats. Separate DP states preserve line count
for variable widths; constant widths keep one best state per endpoint. The last
line is ragged. Penalties +10000 forbid and -10000 force a break (paragraph end
is always allowed). Finite penalties affect squared demerits. This is a reduced
Box/Glue optimization model, not full TeX: no fitness classes or consecutive-flagged
penalty handling. `no_feasible_layout` is explicit; there is no silent greedy fallback.
Limit: 256 fragments and 300,000 candidate evaluations per call.

## Geometry and flow

Frame/polygon coordinates use top-left origin, y down. Clearance uses mitered
polygon expansion. Each obstacle is intersected with the WHOLE line band; each
connected intersection is conservatively projected to an x interval, then blocked
intervals are unioned and subtracted. This can leave usable space unused in complex
concave shapes, but avoids placing text on an obstacle. Holes are not accepted.

The host chooses whether multiple intervals on the same baseline are allowed,
passes their widths to `optimize_paragraph`, and maps returned fragment ranges
back to slots. `compute_text_slots` itself does not mutate a document or produce a
new text path. Invalid/self-intersecting polygons are rejected. Geometry is bounded
to 64 polygons, 256 vertices each, and 512 bands per call.

## PDF and limits

`export_pdf` accepts literal text, not Typst source, imports or file paths. It uses
an isolated temporary directory and a host-registered font snapshot, with system
font fallback disabled. Compiler warnings fail the call. Font embedding restrictions
are checked; hosts must still have the font's applicable license. The artifact sink
is invoked only after successful compilation and output-size checking.

PDF 1.7 and PDF/A-2b are supported; neither constitutes PDF/X or printer-specific
preflight. No CMYK/ICC proofing, bleed/crop workflow or professional print certification
is claimed. Typst performs its own paragraph layout: the PDF tool does not yet render
the slot/line plan produced by the other tools. There is no connection to `.tok` or
Electron IPC in this optional adapter.

Unsupported hyphenation languages fail explicitly (do not assume a Hebrew dictionary).
Words requiring dictionary-specific spelling substitutions also fail; positions alone
cannot describe them safely. PDF input is capped at 20,000 characters and output at
16 MiB. Measurement cache holds 128 entries. Native font parsers and geometry/PDF
compilers should be isolated in a resource-limited worker if the host accepts untrusted
font files or serves multiple tenants; this adapter is not a process sandbox.

Dependencies are optional and declared separately from desktop/Cargo dependencies.
HarfBuzz/uharfbuzz, fontTools, Pyphen, Shapely and Typst retain their upstream licenses;
Pyphen dictionary licenses vary and must be reviewed for redistribution.
