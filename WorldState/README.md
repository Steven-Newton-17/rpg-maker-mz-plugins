# World State for RPG Maker MZ

Version **1.1.0**. This is intentionally a small organizational layer over
vanilla RPG Maker switches—not a replacement persistence system.

Install the plugin, copy the example to `data/WorldStates.json`, assign suitable
switch IDs, and name those switches in the RPG Maker database.

```js
WorldState.get("village_saved");
WorldState.set("village_saved", true);
WorldState.toggle("elf_alliance_formed");
WorldState.all("Alliances");
```

Because values are normal switches, event-page conditions work normally and
save/load behavior remains native to RPG Maker.

When loaded after ConditionSystem, this plugin registers the `worldState`
condition resolver.
