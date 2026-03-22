# CODEX Entry

## Flow
1. web entry `project/index.html`.
2. Main bootstrap is `project/index.js`.
3. Core flow is:
   - `components/*` publish `command:request`
   - `utils/command_router.js` turns commands into reducer actions
   - `utils/store.js` publishes `state:changed`
   - components regenerate view payload
   - `render/render.js` applies DOM patches

## Directory Guide
- `project/components/`
  - `dock/`: Dock shell, popover windows, drag/stack logic.
  - `dock_card/`: Dock panel cards (content/style/view/file), form event parsing.
  - `resume_module/`: Resume module canvas render, editable write-back, drag/resize.
- `project/messager/`
  - `messager.js`: publish/subscribe bus.
- `project/render/`
  - `render.js`: view patch executor (`view:*`, `theme:apply` only).
- `project/file_manager/`
  - `file_manager.js`: import/export/print/localStorage/autosave.
- `project/utils/`
  - constants, helper functions, normalize, reducer, store, layout, appearance, command router.

## Debug Entry Points
- Command handling: `project/utils/command_router.js`
- State migration: `project/utils/normalize.js`
- Layout math: `project/utils/layout.js`
- Module rendering: `project/components/resume_module/resume_module.js`
- Dock rendering and drag: `project/components/dock/dock.js`
- Dock card rendering and form mapping: `project/components/dock_card/dock_card.js`

## Typical Change Map
- Add new module type:
  - `utils/constants.js` (`createModuleLibrary`)
  - `utils/normalize.js` (`normalizeItem`)
  - `components/resume_module/resume_module.js` (render body)
  - `components/dock_card/dock_card.js` (panel labels/options if needed)
- Add new setting in Dock:
  - `components/dock_card/dock_card.js` (view + event mapping)
  - `utils/reducer.js` (state transition)
  - `utils/appearance.js` (if affects visual tokens)
