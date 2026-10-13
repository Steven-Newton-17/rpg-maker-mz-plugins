# Changelog

## 1.6.1 — 2026-10-11

- Stage directions accept follower:<actorId>. Explicit NPC move through:true restores collision on completion or dialogue cancellation. Node effects execute before stage directions: put completion/visibility effects in a following node when walking must remain visible.

## 1.6.0 — 2026-10-08

- **Memory.** Every node entered is remembered in the save (`$gameSystem._dialogueHeard`). New condition type `dialogue` (`target` dialogue id, optional `node`): true once Ava has heard it. API: `heard(dialogueId, nodeId?)`.
- **Choices built from what happened.** `node.choiceLimit` shows at most N of the conditional choices that pass, in authored order; choices without conditions always show. Used for the evening question.

## 1.5.0 — 2026-10-08

- **Stage directions.** A node may have `steps`, played in order on the map before its line: `move` (path-finding walk, snaps into place if blocked), `locate`, `face` (direction or toward someone), `wait`, `balloon`, `jump`, `pose` (`fallen` lies sideways; reset when the dialogue ends unless `keep`), `visible`, `camera` (pan to a place, or back to the player), `fade`, `tint`, `shake`, `sound`. Timed steps wait for themselves unless `wait: false`. Who: `player`, `character:<id>`, `thing:<id>`, `event:<n>`; where: a who, `{ at, dx, dy }` or `{ x, y }`.
- A node with no text and no choices shows no message box (pure staging).
- The player cannot move while a dialogue runs; characters used in a scene stop wandering until it ends.
- `DialogueSystem.Stage` exposes the runner (`actor`, `point`).

## 1.4.0 — 2026-10-06

- Scene effects for story beats: `party` (add or remove an actor), `lifeStage` (CharacterPresentation stage), `music` (play, fade, stop),
  `sound`, and `screen` (fade out/in, tint preset, shake). They start when the node is entered and do not block the text.

## 1.3.0 — 2026-10-06

- Added the `transfer` effect (move the party to a map position, optionally facing a direction) and the `healParty` effect (restore
  every party member), so a lost duel can end with a night at the infirmary.

## 1.2.0 — 2026-10-05

- Added `giveWeapon`, `removeWeapon`, `giveArmor`, and `removeArmor` effects, alongside `giveItem` and `removeItem`.

## 1.1.0 — 2026-10-04

- Added the `chronicle` effect (`discover`, `hide`, `revealSection`, `hideSection`,
  `setStage`) so dialogue can drive Chronicle without script calls.

## 1.0.0 — 2026-10-04

- Initial dialogue registry and node flow.
- Added ConditionSystem-based node and choice requirements.
- Added hidden and disabled choices with requirement labels.
- Added branching, effects, event hooks, interpreter waiting, and standard MZ UI.
- Added optional CharacterPresentation speaker resolution.
