# Changelog

## 1.3.0 — 2026-10-04

- Added life stages: a record may define `stages` (for example child, teen,
  adult) and a `defaultStage`. The current stage is saved with the game.
- Added the **Set Character Life Stage** plugin command and
  `CharacterPresentation.setStage`, `stageOf`, `stages`, and `raw`.
- `definition(id)` now returns the record with the current stage merged in, so
  dialogue, map events, and other plugins follow the stage automatically.
- Tagged map events and the player refresh immediately after a stage change.
- Actors tagged `<character:id>` take their walking sprite, face, and battler
  from the character; `<characterAutoActor:false>` opts out.
- Records may include `battlerName` and `damagedSpriteName`.

## 1.2.0 — 2026-10-04

- Added the `defaultCharacterId` plugin parameter (default `default_character`).
- A speaker that is not registered, or has no expressions, now borrows the
  placeholder character's face sheet and keeps its own name (title-cased from
  the ID). Resolved data includes a `placeholder` flag.
- A tagged map event whose character has no `mapSprite` (or is unregistered)
  now uses the placeholder's walking sprite.
- Missing-character warnings are logged once per ID instead of every message.

## 1.1.0 — 2026-10-04

- Added automatic walking-sprite assignment through `<character:id>` event
  note tags.
- Added `<characterAutoSprite:false>` for exceptional event pages.
- Added `mapSprite`, `portraitName`, and package version support to character
  definitions.
- Included portrait names in resolved presentation data.

## 1.0.0 — 2026-10-04

- Initial reusable release.
- Added JSON character definitions, expression resolution, speaker names, and
  integration with the standard Show Text event command.
