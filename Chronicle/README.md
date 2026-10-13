# Chronicle for RPG Maker MZ

Version **1.1.0**. A discoverable People, Factions, and Lore engine.
Chronicle owns discovery, stages, and unlocked narrative sections. A separate
UI plugin owns presentation. It reads—but never copies—relationship and
reputation values.

Core API:

```js
Chronicle.discover("alice");
Chronicle.hide("alice");
Chronicle.isDiscovered("alice");
Chronicle.setStage("demon_king", "revealed");
Chronicle.revealSection("alice", "first_meeting");
Chronicle.update("alice", { title: "Royal Archmage" });
```

Install `Chronicle.js` followed by one UI theme such as
`ChronicleUI_Default.js`. Only one Chronicle UI theme should be enabled.
