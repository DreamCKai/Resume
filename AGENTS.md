# Document Guide

## docs entry
- `project/docs`

## Layer Model
- `components`: each component owns view generation, local data interpretation, and DOM event handling.
- `messager`: decouples components and services using topic-based publish/subscribe.
- `store/reducer`: immutable state updates.
- `render`: applies view patches to DOM.
- `file_manager`: persistence and file I/O.
- `utils`: shared typed helpers and pure logic.

## docs list
- CODEX_ENTRY
  - description: Guide codex how to code in this project
  - details: contain Flow/Directory Guide/Debug Entry Points/Typical Change Map
  - path: `project/docs/CODEX_ENTRY.md`
- ARCHITECTURE
  - description: show the architecture of this project
  - details: contain Layer Model/Data Flow/State Ownership/Boundary Rules/Compatibility
  - path: `project/docs/ARCHITECTURE.md`
- MESSAGE_TOPICS
  - description: list topics and Command Types of the messager
  - details: contain Core Topics/Command Types (Current)
  - path: `project/docs/MESSAGE_TOPICS.md`
- MODULE_MAP
  - description: info about each Layer Model
  - details: contain Bootstrap/Components/Render/MessagingFile & Persistence/Utils
  - path: `project/docs/MODULE_MAP.md`

## notice
- use ES Module, @ts-check and JSDoc
- when ever you run Get-content cmd or something alike, remeber use UTF-8 encoding to ensure you do not ruin the file with Chinese content