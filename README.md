# RPG Maker MZ Plugins

A set of data-driven plugins for **RPG Maker MZ**, built for my story-driven RPG *Threads of Providence*
and kept general enough to use in other games. Each plugin lives in its own folder, with a README,
a changelog and a version number.

## Plugins

### Core services
| Plugin | Version | What it does |
|---|---|---|
| [ConditionSystem](ConditionSystem/) | 1.0.0 | Generic, read-only condition evaluation with nested logic and diagnostics. Most other plugins plug their state into it |
| [WorldState](WorldState/) | 1.1.0 | Named, organized switches (`WorldState.get("village_saved")`) with a condition adapter |
| [CharacterPresentation](CharacterPresentation/) | 1.3.0 | Connects character packages (IDs, faces, expressions) to map events and dialogue automatically |

### Story and dialogue
| Plugin | Version | What it does |
|---|---|---|
| [DialogueSystem](DialogueSystem/) | 1.6.1 | Data-driven branching dialogue with conditions and stage directions, shown in the standard MZ message windows |
| [DialogueLog](DialogueLog/) | 1.0.0 | Conversation log in the menu. In playtests, also shows which lines have never been heard |
| [MessageWordWrap](MessageWordWrap/) | 1.0.0 | Wraps long message lines to the window width |
| [Examine](Examine/) | 1.1.0 | Press OK facing any tile with no event on it to hear a line about it |
| [Interactions](Interactions/) | 2.1.1 | Characters and "Things" on the map run ordered rules; each placed Thing keeps its own state |

### Progression and relationships
| Plugin | Version | What it does |
|---|---|---|
| [QuestJournal](QuestJournal/) + [UI](QuestJournalUI_Default/) | 1.3.0 / 1.0.1 | Quest state, objectives, outcomes and persistence, plus a default journal screen |
| [Chronicle](Chronicle/) + [UI](ChronicleUI_Default/) | 1.1.0 / 1.0.0 | Discovery and knowledge tracking for people, factions and lore, plus a default screen |
| [Relationships](Relationships/) | 1.2.0 | Per-character affinity, flags and relationship tiers |
| [Reputation](Reputation/) | 1.2.0 | Faction reputation values and tiers |

### World and systems
| Plugin | Version | What it does |
|---|---|---|
| [Encounters](Encounters/) | 1.1.0 | Rule-based random encounters, scripted battles, loot tables, conditional outcomes |
| [NightLighting](NightLighting/) | 1.1.0 | Night maps darken characters to match night tiles; lamps and fires light the ground around them |
| [SystemMenu](SystemMenu/) | 1.0.0 | Groups Save, Load, Options and Game End under one System menu |
| [Checkpoints](Checkpoints/) | 1.0.0 | Chapter Select for testing: start from any story checkpoint, or capture the current moment as one |

## Design

- **Logic and UI are separate.** Core plugins own state and rules, and the `*UI_Default` plugins draw the screens.
  You can replace a UI without touching the logic.
- **Data-driven.** Quests, dialogue and conditions are authored as JSON data, not long event chains.
- **Shared conditions.** State plugins register resolvers with ConditionSystem, so one condition can check
  quests, relationships, reputation and world state together.
- **Save-friendly.** State persists through the normal RPG Maker save files.

## Install

Copy `<Plugin>/js/plugins/<Plugin>.js` into your project's `js/plugins/` folder and enable it in the Plugin
Manager. Load **ConditionSystem** first, then the core plugins, then their UI plugins. Each plugin's
README covers its data files, commands and options.

## License

[MIT](LICENSE)
