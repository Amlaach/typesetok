"""Bounded global Box/Glue-style optimization over premeasured fragments.

This intentionally does not claim full TeX fitness classes or flagged penalties.
The caller shapes fragments and supplies discretionary break widths/penalties.
"""
from dataclasses import dataclass
import math


@dataclass(frozen=True)
class Node:
    end: int
    line: int
    cost: float
    previous: object
    start: int
    width: float
    target: float
    ratio: float


def optimize(items, line_widths_pt, tolerance):
    n = len(items)
    if not n:
        return {"status": "ok", "lines": [], "total_demerits": 0.0}
    # End-exclusive prefix arrays: each fragment followed by its unbroken glue.
    width, stretch, shrink, forced = [0.0], [0.0], [0.0], [0]
    for item in items:
        width.append(width[-1] + item["width_pt"] + item["space_after_pt"])
        stretch.append(stretch[-1] + item["stretch_after_pt"])
        shrink.append(shrink[-1] + item["shrink_after_pt"])
        forced.append(forced[-1] + (item["break_penalty"] <= -10000))
    states = [{0: Node(0, 0, 0.0, None, 0, 0.0, 0.0, 0.0)}] + [{} for _ in items]
    constant_width = len(set(line_widths_pt)) == 1
    evaluations = 0
    for end in range(1, n + 1):
        last = items[end - 1]
        penalty = last["break_penalty"]
        if end != n and penalty >= 10000:
            continue
        for start in range(end):
            # A forced break strictly inside this range must not be crossed.
            if forced[end - 1] != forced[start]:
                continue
            natural = width[end] - width[start] - last["space_after_pt"]
            natural += last["break_width_pt"] if end != n else 0.0
            plus = stretch[end] - stretch[start] - last["stretch_after_pt"]
            minus = shrink[end] - shrink[start] - last["shrink_after_pt"]
            for prev in states[start].values():
                evaluations += 1
                if evaluations > 300_000:
                    raise ValueError("Paragraph optimization budget exceeded; split the paragraph")
                target = line_widths_pt[min(prev.line, len(line_widths_pt) - 1)]
                delta = target - natural
                if end == n and delta >= 0:
                    ratio = 0.0  # Ragged last line, never artificial stretch.
                elif delta == 0:
                    ratio = 0.0
                elif delta > 0 and plus > 1e-9:
                    ratio = delta / plus
                elif delta < 0 and minus > 1e-9:
                    ratio = delta / minus
                else:
                    continue
                if not -1 <= ratio <= tolerance:
                    continue
                badness = 100 * abs(ratio) ** 3
                cost = (1 + badness) ** 2
                if end != n and -10000 < penalty < 10000:
                    cost += math.copysign(penalty ** 2, penalty)
                node = Node(end, prev.line + 1, prev.cost + cost, prev, start, natural, target, ratio)
                key = 0 if constant_width else node.line
                if key not in states[end] or node.cost < states[end][key].cost:
                    states[end][key] = node
    if not states[n]:
        return {"status": "no_feasible_layout", "lines": [], "total_demerits": None}
    best = min(states[n].values(), key=lambda node: node.cost)
    lines, cursor = [], best
    while cursor.previous is not None:
        lines.append({"start": cursor.start, "end": cursor.end,
                      "natural_width_pt": cursor.width, "target_width_pt": cursor.target,
                      "adjustment_ratio": cursor.ratio,
                      "break_width_pt": items[cursor.end - 1]["break_width_pt"] if cursor.end != n else 0.0})
        cursor = cursor.previous
    return {"status": "ok", "lines": list(reversed(lines)), "total_demerits": best.cost}
