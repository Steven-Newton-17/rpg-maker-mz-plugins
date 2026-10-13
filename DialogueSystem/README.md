# DialogueSystem for RPG Maker MZ

Version **1.4.0**. Data-driven branching dialogue built on ConditionSystem and
RPG Maker MZ's normal message and choice windows.

Load order:

1. ConditionSystem
2. State providers such as QuestJournal, Relationships, Reputation, WorldState
3. CharacterPresentation
4. DialogueSystem

Create `data/Dialogues.json` (the Game Manager compiles it). Start a conversation
with the **Start Dialogue** plugin command or:

```js
DialogueSystem.start("test_guard");
```

Supports node conditions and fallbacks, hidden and disabled choices, author-made
requirement labels, branching, effects, hooks, and speaker lookup through
CharacterPresentation. Dialogue definitions do not duplicate persistent state.

Hooks: `dialogueStart`, `dialogueEnd`, `nodeEnter`, `nodeExit`, and
`choiceSelected` through `on` and `off`.

Effect registry: `registerEffect`, `unregisterEffect`, and
`getRegisteredEffectTypes`. Initial effects cover worldState, quest,
relationship, reputation, chronicle, switch, variable, giveItem, removeItem, giveWeapon, removeWeapon, giveArmor, removeArmor, transfer, healParty, party, lifeStage, music, sound, screen, and gold.

### 1.6.1

Stage directions accept follower:<actorId>. Explicit NPC move through:true restores collision on completion or dialogue cancellation. Node effects execute before stage directions: put completion/visibility effects in a following node when walking must remain visible.
