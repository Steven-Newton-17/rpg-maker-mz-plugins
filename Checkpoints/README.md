# Checkpoints (Chapter Select)

Start testing from any point in the story instead of replaying the game.

## Using it

- **Title screen → Chapter Select** (test play only) lists every checkpoint, grouped by chapter.
- **F7 on the map** opens the same list, with **Capture this moment** at the top.
- **`index.html?test&checkpoint=ch1_dinner`** boots straight into a checkpoint (handy from the Game Manager and for automated tests).

Starting a checkpoint begins a fresh game, applies the checkpoint (and any it builds on), and places Ava where it says.

## Files

Checkpoints are JSON files in the Game Manager's `content/checkpoints/<Chapter>/`, compiled to `data/Checkpoints.json`. The folder name is the chapter heading unless the file sets `chapter`.

```json
{
  "id": "ch1_dinner", "name": "Dinner and the evening question", "order": 60,
  "description": "One short line shown above the list.",
  "after": "ch1_dad_home",
  "position": { "map": 8, "x": 10, "y": 18, "d": 8 },
  "state": { "...": "captured snapshot" },
  "worldStates": { "ch1_explored": true },
  "variables": { "20": 4 },
  "items": { "honey_bun": 1 }, "partyAdd": ["lio"], "partyRemove": [],
  "quests": { "hero_and_demon_king": { "status": "active", "revealed": [8], "completed": [0, 1] } },
  "thingStates": { "ch1_decoration": "repaired" },
  "heard": ["ch1_joren_v2"], "chronicle": ["corin"], "relationships": { "lio": 10 }
}
```

`state` comes from **Capture this moment**. The other fields are for hand edits and are applied after it. Items and actors may use Game Manager ids (`honey_bun`, `lio`) or numbers.

Captures go to `content/checkpoints/Captured/` (through NW.js in RPG Maker's playtest, or through the Game Manager when the game runs from it). Rename them, set `name`, `order` and `description`, and move them into the chapter's folder.

**Scene cues.** A capture records the state *after* anything that already ran. If a scene had just started (a cutscene or an autorun trigger), set its cue variable so it plays again: in Chapter 1, variable 20 is 6 for the role choice, 5 for Dad's map, and 4 for dinner.

**Keep them fresh.** Captured state is a snapshot. When a chapter's flags change, recapture the checkpoints after the change.
