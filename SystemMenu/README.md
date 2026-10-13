# System Menu for RPG Maker MZ

Version **1.0.0**. Replaces the main menu's separate Save, Options, and Game End
commands with a single System command.

The System submenu contains:

- Save
- Load
- Options
- Game End

The default configuration provides 100 manual save slots in addition to MZ's
autosave slot. Standard MZ save restrictions remain in effect.

## Install

Copy `js/plugins/SystemMenu.js` into the game's plugin folder and enable it
after other plugins that add main-menu commands. Labels and the manual slot
count are configurable through Plugin Manager parameters.
