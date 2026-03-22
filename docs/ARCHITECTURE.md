# Architecture

## Layer Model
- `components`: each component owns view generation, local data interpretation, and DOM event handling.
- `messager`: decouples components and services using topic-based publish/subscribe.
- `store/reducer`: immutable state updates.
- `render`: applies view patches to DOM.
- `file_manager`: persistence and file I/O.
- `utils`: shared typed helpers and pure logic.

## Data Flow
1. User triggers a DOM event in `dock`, `dock_card`, or `resume_module`.
2. Component publishes `command:request`.
3. `command_router` translates command to reducer actions and dispatches.
4. Store updates state and publishes `state:changed`.
5. Components react to `state:changed` and publish `view:update`.
6. `render` batches DOM updates in `requestAnimationFrame`.

## State Ownership
- Persistent state: store (`meta/theme/view/modules/runtime`).
- Runtime-only ephemeral UI:
  - Dock window stack and drag state in `components/dock`.
  - Active pointer interaction in `components/resume_module`.

## Boundary Rules
- Components do not call each other directly for business updates.
- Shared business transitions happen through `command:request` + reducer actions.
- `render` never mutates state and never executes business logic.
- `index.js` only composes modules and lifecycle hooks.

## Compatibility
- `utils/normalize.js` supports:
  - current schema (`modules + absolute layout`)
  - legacy schema (migrated to current structure).
- `file_manager` keeps legacy localStorage key fallback.
