# Frontend Architecture

This frontend uses a pragmatic three-layer, feature-first structure:

- `app/`: application composition, routing/view selection, global app shell styles.
- `features/`: domain pages and feature flows. Each feature owns its component, local styles, and feature-only helpers.
- `widgets/`: reusable composed UI blocks that are not tied to one feature, such as the navbar.
- `shared/`: cross-feature infrastructure and primitives, such as API clients and reusable UI utilities.

Import direction should stay one-way:

`app -> features/widgets -> shared`

Feature modules should not import from `app` or from unrelated feature internals. If code is needed by more than one feature, move it to `shared`.
