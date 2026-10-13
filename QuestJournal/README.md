# Quest Journal for RPG Maker MZ

A reusable, data-driven quest engine. It owns quest state and event integration; presentation is supplied by a separate UI plugin.

Current version: **1.3.0**

## Install

1. Copy `js/plugins/QuestJournal.js` into the game's `js/plugins` folder.
2. Copy one compatible UI plugin, such as `QuestJournalUI_Default.js`.
3. Create the game's `data/Quests.json` (the Game Manager compiles it).
4. Enable **QuestJournal**, then its UI plugin directly below it.
5. Edit `Quests.json` to define the game's quests.

Do not rename `QuestJournal.js`; RPG Maker uses the filename to find its plugin parameters and commands.

## Quest data

Each quest has a unique string `id`, display text, an objective list, and optional switch/variable links. IDs remain stable even when titles change.

- `acceptSwitchId`: when ON, the quest is Active.
- `completeSwitchId`: when ON, the quest is Complete.
- `failureSwitchId`: when ON, the quest is Failed.
- Objective `variableId` and `target`: show live progress from a game variable.
- `hidden: true`: hide an objective until `revealObjective` is called.
- An objective without a target is a checklist step completed with `completeObjective`.
- `activeDescription`, `completeDescription`, and `failedDescription` provide outcome-specific journal text. The older `description` field remains a fallback.

Switch priority is Failed, Complete, Active, then the saved API state.

## Using events

Use RPG Maker's **Plugin Command** event command and select QuestJournal:

- **Accept Quest**
- **Complete Quest**
- **Fail Quest**
- **Set Objective Progress** (for objectives not linked to a variable)
- **Complete Objective**
- **Reveal Objective**

## Script calls

```js
QuestJournal.accept("example_quest");
QuestJournal.complete("example_quest");
QuestJournal.fail("example_quest");
QuestJournal.setProgress("example_quest", 0, 5);
QuestJournal.completeObjective("example_quest", 0);
QuestJournal.revealObjective("example_quest", 1);
QuestJournal.statusOf("example_quest");
QuestJournal.isObjectiveComplete("example_quest", 0);
```

The objective index in script calls is zero-based. The Plugin Command UI uses human-friendly numbering starting at 1.

## Reusing it in another game

Copy the core, one UI theme, and create a fresh `data/Quests.json` (the Game Manager writes it). No game-specific content is embedded in the plugin. Only one QuestJournal UI theme should be enabled at a time.

When loaded after ConditionSystem, QuestJournal registers the `quest` resolver.
It returns quest state by default; use `property: "objective"` with `index` to
query completion of an individual objective.

## Versioning

This component uses semantic versioning (`major.minor.patch`). Update `VERSION`,
the plugin's `@plugindesc`, `QuestJournal.version`, and `CHANGELOG.md` together
when publishing a release.
