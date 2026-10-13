# Character Presentation for RPG Maker MZ

Version **1.3.0**. This plugin connects installed character packages to both
map events and normal Show Text commands.

## Map events

Add a package ID to the event's Note field:

```text
<character:ava>
```

The event receives the `mapSprite` registered in `data/Characters.json` each
time its page is set up. Add `<characterAutoSprite:false>` when a special page
must retain its manually selected image.

## Dialogue

Call **Set Speaker for Next Message**, then add a normal **Show Text** command.
The next message receives the registered display name, face file, and face
index. The pending speaker clears after one message.

```js
CharacterPresentation.setSpeaker("ava", "angry");
CharacterPresentation.resolve("ava", "happy");
CharacterPresentation.definition("ava");
```

Character definitions are installed from complete character packages and
belong in each game's `data/Characters.json`.

## Placeholder character

Install a character with the ID `default_character` (configurable through the
**Placeholder Character ID** parameter). Any speaker or tagged event that is
unregistered, or registered without art, borrows its face sheet and walking
sprite while keeping its own display name, so dialogue and expressions can be
written before real art exists. `CharacterPresentation.placeholder()` returns
the stand-in definition.

## Life stages

A character record may carry `stages` and a `defaultStage`:

```json
{ "id": "ava", "defaultStage": "child",
  "stages": { "child": { "mapSprite": {...}, "battlerName": "AvaChild", "expressions": {...} },
              "teen":  { ... }, "adult": { ... } } }
```

Top-level fields mirror the default stage. Change the current stage with the
**Set Character Life Stage** command or `CharacterPresentation.setStage("ava", "teen")`;
tagged events and the player update at once and the choice is saved with the game.
All dialogue and expression lookups use the current stage, so every stage should
define the same expression names.

## Actor binding

Put `<character:ava>` in an Actor's Note to drive that actor's walking sprite, face,
and battler from the character's current stage (`<characterAutoActor:false>` opts out).
