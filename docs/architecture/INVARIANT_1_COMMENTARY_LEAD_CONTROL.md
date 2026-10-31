# Invariant 1: Commentary Lead Control

A commentary paragraph cannot appear on a page prior to the page containing its anchored primary paragraph.

## Formal Invariant
$$\forall c \in C, \quad \text{page}(c) \ge \text{page}(\text{anchor}(c))$$

Violation of this invariant leads to Talmudic layout incoherence where commentary precedes the text it illuminates.
