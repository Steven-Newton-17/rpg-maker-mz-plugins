# Changelog

## 1.1.0 — 2026-10-10

- Objects keep their line: the new default mode for tile entries, "object", gives each object (a patch of touching matching cells) one line for good, so a barrel of cider stays a barrel of cider. "at" entries still cycle by default.

## 1.0.0 — 2026-10-10

- Press OK facing a map tile with no event: Ava says a line about it (flavour text). Entries match tile ids on a tileset, exact cells on a map, maps, and story conditions; lines cycle (or random / once-then-last). Shown through DialogueSystem, so they appear in the Log. Data: data/Examine.json from the Game Manager's content/examine.
