# Changelog

All notable changes to QuestJournal are recorded here. Versions follow semantic
versioning.

## 1.3.1 — 2026-10-06

- Removed the legacy command namespace from the sandbox project.

## 1.3.0 — 2026-10-04

- Added optional quest resolver registration with ConditionSystem.

## 1.1.0 — 2026-10-04

- Added independent checklist-objective completion.
- Added hidden objectives and runtime objective revelation.
- Added active, completed, and failed descriptions.
- Added `statusOf` and `isObjectiveComplete` query helpers.
- Added Complete Objective and Reveal Objective plugin commands.
- Preserved existing save data.
- Validated the feature set using four playable quest scenarios.

## 1.0.0 — 2026-10-03

- Initial data-driven release.
- Added All, Active, Complete, and Failed journal tabs.
- Added JSON quest definitions, variable-backed counters, switch integration,
  save persistence, plugin commands, and the script API.
## 1.2.0

- Extracted the menu scene and windows into replaceable UI plugins.
- Preserved save data, script APIs, plugin commands, and the legacy command namespace.
