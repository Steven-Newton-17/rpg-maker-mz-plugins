# Changelog

## 2.1.1 — 2026-10-11

- Known characters obey placement appearance conditions even when they have no interaction record.

## 2.1.0 — 2026-10-08

- **Again dialogues.** A rule may list `again` dialogue ids. Its first run plays `dialogue`; later runs play the again dialogues in order and then keep the last one, or `againMode: "cycle"` / `"random"` (no immediate repeat). Run counts are saved per subject and rule (`$gameSystem._interactions.runs`).
- API: `dialogueFor(subject, rule)`, `timesRun(kind, id, ruleId)`.
- Older saves and rules without `again` behave exactly as before.

## 2.0.0 — 2026-10-06

- **Definitions and instances.** A Thing is a definition; each map placement (`<thing:id>` plus `<place:pid>`) is its own instance with its own state, "only
  once" flags and auto-run flag. Mark a Thing `scope: "shared"` for one state across the game (a winch, a door). People stay singletons.
- Placements may carry their own starting state and their own "appears when" (new data file `Placements.json`, parameter **Placements File**).
- "self" in conditions and effects is the instance. A Thing's state can be read or set by id from elsewhere only when it is shared.
- API: `eventState(event)`, `setEventState(event, state)`, `stateKeyOf(event)`; `thingState` / `setThingState` take a state key (a shared Thing's id, or "id@map:place").
- **Breaking:** saves from before 2.0 hold Thing states under the old keys and will not carry over.

## 1.3.1 — 2026-10-06

- A "step onto" gate placed on a door (a wall tile the player cannot enter, whose page is same-as-characters) keeps that priority, so touching
  the door runs the gate instead of doing nothing.

## 1.3.0 — 2026-10-06

- A Thing state's graphic can be marked `animate`: the event keeps its walking animation and turns as it moves, for visible monsters that
  wander or chase (movement itself is set on the map event). Other Things still stand still with a fixed direction.

## 1.2.0 — 2026-10-06

- Added `Interactions.refresh()` so other plugins (Encounters) can make tagged events update immediately after they change a
  Thing's state.

## 1.1.0 — 2026-10-05

- Added **Things**: map events tagged `<thing:id>` (chests, signs, gates, triggers, levers) with a trigger
  (`action`, `bump`, `walkon`, `auto`), optional **states** each with its own graphic, and
  `appearsWhen` conditions that hide the event until they pass.
- Rules can now run **effects**, can be **only once**, may omit the dialogue, and (for Things) can
  let the event's own commands continue (`then: "continue"`), so a door's Transfer stays in the editor.
- Characters also support `appearsWhen`.
- New condition type `thing` (state), new effect `thingState`, and target `self` in a Thing's own rules.
- New data file `Things.json` (parameter **Things File**).
- The map refreshes after rules, state changes, and dialogue so appearance follows the story (events are
  re-setup immediately, never left without a page).

## 1.0.0 — 2026-10-04

- Initial release: ordered per-character interaction rules with ConditionSystem
  conditions, started through DialogueSystem.
- `Interact` plugin command and `Interactions` script API.
- Events tagged `<character:id>` with no commands become talkable automatically
  and default to "Same as characters" priority; `<interact:false>` opts out.
