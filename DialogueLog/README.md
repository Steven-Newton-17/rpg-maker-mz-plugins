# DialogueLog for RPG Maker MZ

Version **1.0.0**. Adds a **Log** command to the menu with the conversation backlog: speaker names, lines and
the replies Ava chose, grouped by conversation. During playtests (Test Play from RPG Maker, or the Game Manager's
game preview) Shift switches to **Coverage**: how many lines of each conversation have been heard in this save and
which ones never were. Conversations matching the Coverage Ignores pattern (default: drafts, tests, examples) are left out.

Load after DialogueSystem (1.6 or later, which records heard lines). Parameters: menu command name, lines kept.
Optional module in the Game Manager's Settings ("Dialogue log").
