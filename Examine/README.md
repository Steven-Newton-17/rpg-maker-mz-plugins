# Examine for RPG Maker MZ

Version **1.0.0**. Everything on the map can be looked at. Press OK facing a tile with no event and Ava says a line
about what is there: a barrel ("Closed tight. It smells like... cider?"), a closet, a tree, a bed. Lines cycle on repeat
looks, can be limited to a map or to exact cells, and can depend on story state (later Acts can hide clues in the same
barrel). Write entries in the Game Manager's `content/examine/**/*.json`; the build compiles them to `data/Examine.json`.
See the plugin help for the entry format. Load after DialogueSystem.
