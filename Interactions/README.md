# Interactions for RPG Maker MZ

Version **2.0.0**. Lets a character own their conversations. Rules are authored in
the Game Manager and compiled to `data/Interactions.json`:

```json
{ "protagonist_mother": { "rules": [
  { "id": "r_1", "name": "After the lesson", "dialogue": "example_villager_waiting",
    "conditions": { "type": "switch", "target": 3, "operator": "==", "value": true } },
  { "id": "r_2", "name": "First meeting", "dialogue": "example_villager_ask" }
] } }
```

The first rule whose conditions pass (ConditionSystem) starts its dialogue
(DialogueSystem). A rule without conditions is a catch-all and belongs last.

## Events

Tag an event `<character:id>` and give it no commands: it is talkable by itself.
Pages are only needed for appearance conditions (for example, a character who
should not exist yet). `<interact:false>` opts out. Events that already have
commands are untouched; use the **Interact** plugin command inside them to run
the rules from a longer sequence.

## Load order

After ConditionSystem, CharacterPresentation and DialogueSystem.

## Things (1.1.0)

Anything on a map that is not a character is a **Thing**, tagged `<thing:id>`. `data/Things.json`:

```json
{ "chest_cloth": { "name": "Clean cloth chest", "type": "chest", "trigger": "action",
    "appearsWhen": { "type": "quest", "target": "mother_help", "operator": "==", "value": "active" },
    "states": [ { "id": "closed", "graphic": { "characterName": "!Chest", "characterIndex": 0, "direction": 2, "pattern": 1 } },
                { "id": "open",   "graphic": { "characterName": "!Chest", "characterIndex": 0, "direction": 8, "pattern": 1 } } ],
    "rules": [ { "id": "r1", "name": "Take it", "conditions": { "type": "thing", "target": "self", "operator": "==", "value": "closed" },
                 "effects": [ { "type": "thingState", "target": "self", "state": "open" } ], "dialogue": "d_abc" },
               { "id": "r2", "name": "Empty", "dialogue": "d_def" } ] } }
```

- **Triggers:** `action` (button), `bump` (touch and block), `walkon` (step onto it), `auto` (runs once).
- **Wrapping native commands:** if the event has its own commands (for example a Transfer), the Thing's
  rule decides whether they run. A rule with `"then": "continue"` lets them run after its effects and
  dialogue; any other rule stops before them. If no rule matches, they run.
- **Appears when:** the event is absent while these conditions fail. Applies to characters too.
- **State and once:** a rule marked `once` is skipped after it has run; states are saved with the game.

### 2.1.1

Known characters obey placement appearance conditions even when they have no interaction record.
