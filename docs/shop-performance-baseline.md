# Shop Performance Baseline

Date: 2026-07-02

## Current bottlenecks identified

1. Interaction model is mostly navigation-driven (`Link` based category/sort/filter/pagination), which causes full route transitions for each click.
2. Catalog data path performs multiple read steps in sequence when category is present (category lookup -> mapping lookup -> medicines query), increasing latency under rapid filter changes.
3. Category name hydration for mixed lists adds additional post-query lookups (`medication_category_medicines` then `medication_categories`) per request.
4. No pending/transition UI for chips and cards, so interactions can feel frozen while the route re-renders.
5. Search currently submits the form and navigates, which is slower and less responsive than debounced query updates.

## Optimization target

- Move frequent catalog interactions to client query updates with URL synchronization.
- Keep initial server render for session guard and first paint.
- Reduce sequential backend lookups in `getShopMedicines`.
