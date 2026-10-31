# Synchronized Pagination Cascading

When live text edits, font size modifications, or margin adjustments push a primary text paragraph across a page break boundary, all anchored commentaries are automatically cascaded.

## Cascade Detection Algorithm
$$\Delta P_{\text{overflow}} \implies \bigcup_{c \in \text{links}(P)} c \to \text{Page}_{k+1}$$
