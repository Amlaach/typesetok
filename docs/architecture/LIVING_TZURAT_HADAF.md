# Living Tzurat HaDaf: Dynamic Multi-Stream Layout Architecture

## 1. Overview
Living Tzurat HaDaf is the next-generation multi-stream Hebrew document layout mechanism for TypesetOK. It dynamically coordinates central primary texts (Gemara, Torah) with peripheral commentary flows (Rashi, Tosafot, Ramban, Targum).

## 2. Mathematical Formalization
Each page $k$ contains a partition of physical height $H_{\text{page}}$ into content frames:
$$\sum_{f \in F_k} \text{height}(f) \le H_{\text{page}}$$
