# Changelog

## 1.0.0 — 2026-10-10

- Chapter Select for testing: start a new game from any story checkpoint (title screen, F7 on the map, or `index.html?test&checkpoint=<id>`).
- "Capture this moment" saves the current story state (switches, variables, party, items, quests, Chronicle, relationships, heard dialogue, Things) as a checkpoint file in content/checkpoints/Captured.
- Checkpoints can build on each other (`after`) and add hand-written changes (world states, variables, items, party, quests, Thing states).
- Test play only unless "Show in release builds" is on.
