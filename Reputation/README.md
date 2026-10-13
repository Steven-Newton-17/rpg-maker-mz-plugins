# Reputation for RPG Maker MZ

Version **1.2.0**. Tracks persistent global or faction reputation independently
from personal relationships. Factions are defined by each game.

Install the plugin and copy the example data to `data/Factions.json`.

```js
Reputation.value("academy");
Reputation.add("elves", 10);
Reputation.set("merchants", 50);
Reputation.meets("academy", 25);
Reputation.global();
Reputation.tier("elves");
Reputation.tierId("elves");
Reputation.tierRank("elves");
Reputation.tierName("elves");
```

Values are bounded by each faction's configurable minimum and maximum and
persist in save files.
Set `replaceTiers: true` for a complete faction-specific tier table; otherwise
matching IDs override defaults while unspecified tiers remain inherited.

When loaded after ConditionSystem, this plugin registers the `reputation`
resolver. It supports numeric reputation by default and `property: "tier"` or
`"tierRank"` queries.
