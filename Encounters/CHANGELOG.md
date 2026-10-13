# Changelog

## 1.1.0 — 2026-10-06

- Works with Interactions 2.0: "self" and a monster's `winState` address the placed instance that started the fight, not the Thing definition.

## 1.0.1 — 2026-10-06

- A monster Thing's `winState` now applies even when the battle has no matching outcome rule.

## 1.0.0 — 2026-10-06

- Initial release: per-map spawn tables with ordered rules (conditions, regions, weighted entries, loot, rates), named battles with
  conditional win/lose/escape outcomes (effects, dialogue, continue-or-game-over), loot tables that add to or replace enemy drops,
  the `battle` effect, the Start Battle plugin command, and the `Encounters` script API.
