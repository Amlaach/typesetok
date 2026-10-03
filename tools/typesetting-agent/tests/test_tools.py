import itertools
import math
import pytest
from jsonschema import Draft202012Validator
from schemas import TOOLS


def fragment(width, space=4, stretch=2, shrink=1, penalty=0, discretionary=0):
    return {"width_pt": width, "space_after_pt": space, "stretch_after_pt": stretch,
            "shrink_after_pt": shrink, "break_penalty": penalty, "break_width_pt": discretionary}


def test_schemas():
    assert len(TOOLS) == 6
    for tool in TOOLS:
        Draft202012Validator.check_schema(tool["function"]["parameters"])


def test_measurement_and_cache(toolset):
    tools, _ = toolset
    args = dict(font_id="test", text="אבa", font_size_pt=12, direction="rtl", language="he", script="Hebr")
    result = tools.call("measure_text_run", args)
    assert result["advance_width_pt"] == 18
    assert result["glyph_count"] == 3
    assert not result["has_missing_glyphs"]
    result["advance_width_pt"] = -1
    assert tools.call("measure_text_run", args)["advance_width_pt"] == 18
    assert tools.call("measure_text_run", dict(args, font_size_pt=24))["advance_width_pt"] == 36
    assert tools.call("measure_text_run", dict(args, text="😀"))["has_missing_glyphs"]
    for i in range(140):
        tools.call("measure_text_run", dict(args, text=str(i)))
    assert len(tools.measurements) == 128
    assert tools.call("inspect_font", {"font_id": "test"})["units_per_em"] == 1000


@pytest.mark.parametrize("change", [{"font_id": "../../etc/passwd"}, {"font_size_pt": float("nan")},
                                  {"font_size_pt": True}, {"text": "x\ny"}, {"command": "anything"}, {"direction": "auto"}])
def test_reject_measure_input(toolset, change):
    tools, _ = toolset
    args = dict(font_id="test", text="אב", font_size_pt=12, direction="rtl", language="he", script="Hebr")
    with pytest.raises(ValueError):
        tools.call("measure_text_run", args | change)


def test_hyphenation(toolset):
    tools, _ = toolset
    result = tools.call("hyphenate_word", {"word": "hyphenation", "language": "en-US"})
    assert result["positions"] == [2, 6]
    with pytest.raises(ValueError, match="dictionary"):
        tools.call("hyphenate_word", {"word": "שלום", "language": "zz"})


def test_breaks_and_discretionary_width(toolset):
    tools, _ = toolset
    items = [fragment(20), fragment(20), fragment(20), fragment(20)]
    out = tools.call("optimize_paragraph", dict(items=items, line_widths_pt=[44], tolerance=2))
    assert [(l["start"], l["end"]) for l in out["lines"]] == [(0, 2), (2, 4)]
    assert out["lines"][-1]["adjustment_ratio"] == 0
    items = [fragment(20, penalty=-10000, discretionary=3), fragment(20)]
    out = tools.call("optimize_paragraph", dict(items=items, line_widths_pt=[23, 20], tolerance=2))
    assert [l["natural_width_pt"] for l in out["lines"]] == [23, 20]
    items[0]["break_penalty"] = 10000
    out = tools.call("optimize_paragraph", dict(items=items, line_widths_pt=[23], tolerance=2))
    assert out["status"] == "no_feasible_layout"


def test_optimizer_matches_exhaustive_partitions(toolset):
    tools, _ = toolset
    # Independently enumerate every partition, including variable line widths.
    for widths in itertools.product([12, 20, 28], repeat=4):
        targets = [44, 38, 50]
        items = [fragment(w, stretch=10, shrink=4) for w in widths]
        optimum = math.inf
        for mask in range(1 << 3):
            ends = [i + 1 for i in range(3) if mask & (1 << i)] + [4]
            start, total = 0, 0
            for line, end in enumerate(ends):
                gaps = end - start - 1
                width = sum(widths[start:end]) + gaps * 4
                delta = targets[min(line, 2)] - width
                if end == 4 and delta >= 0:
                    ratio = 0
                elif delta == 0:
                    ratio = 0
                elif not gaps:
                    total = math.inf; break
                else:
                    ratio = delta / (gaps * (10 if delta > 0 else 4))
                if not -1 <= ratio <= 2:
                    total = math.inf; break
                total += (1 + 100 * abs(ratio) ** 3) ** 2
                start = end
            optimum = min(optimum, total)
        result = tools.call("optimize_paragraph", dict(items=items, line_widths_pt=targets, tolerance=2))
        if math.isinf(optimum):
            assert result["status"] == "no_feasible_layout"
        else:
            assert result["total_demerits"] == pytest.approx(optimum)


def test_slots_full_band_union_and_rtl(toolset):
    tools, _ = toolset
    args = dict(frame=dict(x=0, y=0, width=400, height=600),
                polygons=[[[150, 80], [250, 80], [250, 110], [150, 110]]],
                bands=[dict(top=100, bottom=118)], clearance_pt=8, direction="rtl")
    # Obstacle ends ABOVE the baseline/bottom; full-band checking still excludes it.
    slots = tools.call("compute_text_slots", args)["bands"][0]["slots"]
    assert slots == [{"x": 258, "width": 142}, {"x": 0, "width": 142}]
    args["polygons"].append([[100, 90], [200, 90], [200, 120], [100, 120]])
    assert tools.call("compute_text_slots", args)["bands"][0]["slots"][-1] == {"x": 0, "width": 92}
    args["polygons"] = [[[0, 0], [100, 100], [0, 100], [100, 0]]]
    with pytest.raises(ValueError, match="valid"):
        tools.call("compute_text_slots", args)


@pytest.mark.parametrize("standard", ["1.7", "a-2b"])
def test_pdf_literal_text_embedded_font(toolset, standard):
    tools, artifacts = toolset
    args = dict(font_id="test", text='שלום #panic("MUST NOT EXECUTE")', font_size_pt=12,
                direction="rtl", language="he", page_width_pt=595, page_height_pt=842,
                margin_pt=36, standard=standard)
    result = tools.call("export_pdf", args)
    assert result["artifact_id"] == "pdf-1"
    assert artifacts[0].startswith(b"%PDF-")
    assert b"/FontFile2" in artifacts[0] or b"/FontFile3" in artifacts[0]
    assert b"/ToUnicode" in artifacts[0]
    assert not result["pdf_x"]
    assert result["preflight"] == "not_performed"
    with pytest.raises(ValueError, match="Margins"):
        tools.call("export_pdf", args | {"margin_pt": 400})
