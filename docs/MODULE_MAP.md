# Module Map

## Bootstrap
- `project/index.js`
  - App assembly
  - Lifecycle hooks (`pointermove`, `pointerup`, `resize`, `visibilitychange`, `Esc`)
  - Global view sync (theme vars + stage flags)

## Components
- `project/components/dock/dock.js`
  - Dock shell html
  - Dock icon toggles
  - Popover open/focus/close/minimize
  - Window z-index stacking
  - Popover drag behavior
- `project/components/dock_card/dock_card.js`
  - Panel cards for content/style/view/file
  - Form rendering and form-event command mapping
- `project/components/resume_module/resume_module.js`
  - Canvas module html rendering
  - Editable write-back
  - Module selection
  - Module drag/resize interaction

## Render
- `project/render/render.js`
  - Receives `view:update/view:remove/theme:apply`
  - RAF batching and DOM patch apply

## Messaging
- `project/messager/messager.js`
  - `createMessager()`
  - `publish/subscribe/once`

## File & Persistence
- `project/file_manager/file_manager.js`
  - Initial state load
  - Import JSON
  - Export JSON/HTML
  - Print
  - localStorage autosave

## Utils
- `project/utils/constants.js`: static config + module library factory.
- `project/utils/helpers.js`: DOM/string/number helpers.
- `project/utils/layout.js`: layout metrics and conversions.
- `project/utils/normalize.js`: schema normalize/migrate/export payload.
- `project/utils/state_factory.js`: default state and module factories.
- `project/utils/reducer.js`: immutable transitions.
- `project/utils/store.js`: state container + `state:changed`.
- `project/utils/appearance.js`: theme/module visual resolution.
- `project/utils/command_router.js`: command -> reducer dispatch orchestration.
- `project/utils/types.js`: shared JSDoc typedef index.
