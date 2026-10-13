# ConditionSystem for RPG Maker MZ

Version **1.0.0**. A generic, read-only evaluation layer for JSON-compatible
conditions. It supports nested ALL, ANY, and NOT groups and returns diagnostic
results suitable for dialogue, menus, debugging, and requirements previews.

Install `js/plugins/ConditionSystem.js` before plugins that register additional
resolvers.

```js
ConditionSystem.check({type: "gold", operator: ">=", value: 1000});
ConditionSystem.evaluate({
  all: [
    {type: "relationship", target: "alice", operator: ">=", value: 30},
    {type: "worldState", target: "village_saved", operator: "==", value: true}
  ]
});
```

Public API:

- `register(type, resolver)` / `unregister(type)` / `hasResolver(type)`
- `evaluate(condition)` / `check(condition)`
- `evaluateAll(array)` / `evaluateAny(array)`
- `compare(actual, operator, expected)`
- `getRegisteredTypes()` / `describe(condition)`
- `setDebug(boolean)`

Built-in types: switch, variable, item, weapon, armor, gold, partyMember,
actorLevel, actorClass, actorSkill, and actorState.

Supported operators: `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains`,
`notContains`, `in`, `notIn`, `exists`, and `notExists`.

Unknown types and malformed conditions return structured failures instead of
crashing normal gameplay. ConditionSystem never mutates game state.
