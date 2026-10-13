# Relationships for RPG Maker MZ

Version **1.2.0**. Provides persistent affinity values, player-facing tiers, and independent named
flags for important characters. It contains no romance assumptions.

Install the plugin and copy the example data to `data/Relationships.json`.

```js
Relationships.affinity("alice");
Relationships.add("alice", 10);
Relationships.set("alice", 50);
Relationships.meets("alice", 40);
Relationships.setFlag("alice", "personal_quest_completed", true);
Relationships.hasFlag("alice", "personal_quest_completed");
Relationships.tier("alice");
Relationships.tierId("alice");
Relationships.tierRank("alice");
Relationships.tierName("alice");
```

Affinity and flags persist in saves. Character definitions remain game data.
Set `replaceTiers: true` for a complete custom tier table; otherwise tiers
matching IDs override defaults. When loaded after ConditionSystem, this plugin
registers the `relationship` resolver. It supports affinity by default plus
`property: "flag"`, `"tier"`, and `"tierRank"` queries.
