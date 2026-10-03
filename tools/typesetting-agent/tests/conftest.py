from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from agent_tools import TypesettingTools


@pytest.fixture
def toolset(tmp_path):
    # Original synthetic font; no redistributable system-font fixture required.
    builder = FontBuilder(1000, isTTF=True)
    points = list(range(32, 127)) + list(range(0x05D0, 0x05EB))
    names = [".notdef"] + [f"uni{c:04X}" for c in points]
    builder.setupGlyphOrder(names)
    builder.setupCharacterMap({c: names[i + 1] for i, c in enumerate(points)})
    glyphs = {}
    for name in names:
        pen = TTGlyphPen(None)
        if name != "uni0020":
            pen.moveTo((50, 0)); pen.lineTo((450, 0)); pen.lineTo((450, 700)); pen.lineTo((50, 700)); pen.closePath()
        glyphs[name] = pen.glyph()
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics({name: (500, 0) for name in names})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({"familyName": "TOK Test", "styleName": "Regular", "uniqueFontIdentifier": "TOK-Test", "fullName": "TOK Test Regular", "psName": "TOKTest-Regular"})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200, fsType=0)
    builder.setupPost()
    path = tmp_path / "test.ttf"
    builder.save(path)
    artifacts = []
    def sink(data):
        artifacts.append(data)
        return f"pdf-{len(artifacts)}"
    return TypesettingTools({"test": path}, sink), artifacts
