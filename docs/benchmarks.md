# Benchmarks

We publish a small **live benchmark** to visualize selector-driven rendering vs context baselines.

- **Open Bench:** <https://acoolhq.github.io/rts-bench/>

It compares:

- **RTS (standalone store + selector)**
- **Context + useState**
- **Context + useReducer**
- **RTS + Context(createContextSync)**

---

## Scenarios

### Unrelated updates
Increment a `tick` field many times.  
**Expectation:** leaves that only select `items` should **not** re-render in selector modes.

### Single index updates
Bump `items[123]` repeatedly.  
**Expectation:** only leaf 123 re-renders in selector modes; context baselines re-render many leaves.

### Random churn
Bump random indices repeatedly.  
**Expectation:** selector modes re-render just the touched leaves; context baselines re-render broadly.

> Tip: run in production build for realistic numbers.
