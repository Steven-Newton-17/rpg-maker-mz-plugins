# Night Lighting for RPG Maker MZ

Version **1.1.0**. Night tilesets are drawn dark, but character sprites are drawn in daylight, so on a night map
they look pasted on. This plugin darkens every character sprite on a night map to the same tone as the tiles.

- **Which maps:** a map whose tileset note contains `:night>` (the night towns the Game Manager builds), or whose
  map note contains `<night>`. `<night:0.5,0.55,0.8>` sets a map's own tone; `<day>` turns it off.
- **Lights:** an event with `<glow>` in its note or in a comment on its current page stays at full brightness and lights a
  pool of ground round it; characters walking into it are lit too. `<light:4,#ffd890,2>` sets the radius in tiles, the
  colour, and how many tiles below the event the pool is centred (a lamp head sits above the ground it lights);
  `<light:0>` stays bright but lights nothing.
- **Script:** `NightLighting.isNight()`, `NightLighting.set(r, g, b)`, `NightLighting.clear()` (until the map is left).

Faces, pictures, menus and battles are not changed.

## Install

Copy `js/plugins/NightLighting.js` into the game's plugin folder and turn it on in the Plugin Manager. It needs no
other plugin.
