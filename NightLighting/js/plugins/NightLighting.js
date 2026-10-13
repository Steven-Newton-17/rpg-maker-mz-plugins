/*:
 * @target MZ
 * @plugindesc v1.1.0 Night maps darken characters to match the night tiles; lamps and fires light the ground round them.
 * @author Steven Newton
 *
 * @param tone
 * @text Night tone (red, green, blue)
 * @desc How much of each colour a character keeps at night, 0 to 1. Matches the night tilesets the manager builds.
 * @type string
 * @default 0.42, 0.48, 0.72
 *
 * @param lift
 * @text Blue lift
 * @desc Blue added on top (0 to 255), so dark colours read as moonlit instead of black.
 * @type number
 * @min 0
 * @max 255
 * @default 10
 *
 * @param lightRadius
 * @text Light radius
 * @desc How far a light reaches, in tiles, when its <glow> or <light> tag gives no radius.
 * @type number
 * @decimals 1
 * @min 0
 * @default 3
 *
 * @param lightColor
 * @text Light colour
 * @desc The colour of a light whose tag gives none.
 * @type string
 * @default #ffcf80
 *
 * @param lightStrength
 * @text Light strength
 * @desc How bright the centre of a pool of light is, 0 to 1.
 * @type number
 * @decimals 2
 * @min 0
 * @max 1
 * @default 0.45
 *
 * @help
 * Night tiles are drawn dark by the artist, but characters are drawn in
 * daylight. On a night map this plugin darkens every character sprite (the
 * player, followers, events, vehicles) to the same tone as the tiles, and
 * lights give off a pool of light that brightens the ground and anyone who
 * walks into it.
 *
 * A map is at night when:
 *   - its tileset's note contains ":night>" (the night towns the Map Builder
 *     makes), or
 *   - the map's note contains <night>.
 * A map's note can also hold:
 *   <night:0.5,0.55,0.8>   its own tone (red, green, blue kept, 0 to 1)
 *   <day>                  never night, whatever its tileset
 *
 * Lights (in an event's note, or a comment on its current page):
 *   <glow>                 stays at full brightness and lights a pool round it
 *   <light:4>              a pool 4 tiles across in radius
 *   <light:4,#ffd890>      ... in that colour
 *   <light:4,#ffd890,2>    ... centred 2 tiles below the event (a lamp's head
 *                          sits above the ground it lights)
 *   <light:0>              stays bright, but lights nothing
 * The Map Builder marks its fires, braziers, torches, lanterns and street
 * lamps this way.
 *
 * Script calls (they last until the player leaves the map):
 *   NightLighting.isNight()
 *   NightLighting.set(0.4, 0.45, 0.7)   darken this map now
 *   NightLighting.clear()               back to daylight on this map
 *
 * Faces, pictures, menus and battles are not changed.
 */
(() => {
  "use strict";
  const PARAMS = PluginManager.parameters("NightLighting");
  const numbers = text => String(text || "").split(",").map(Number).filter(n => Number.isFinite(n));
  const DEFAULT = numbers(PARAMS.tone).length === 3 ? numbers(PARAMS.tone) : [0.42, 0.48, 0.72];
  const LIFT = Math.max(0, Math.min(255, Number(PARAMS.lift ?? 10))) / 255;
  const RADIUS = Math.max(0, Number(PARAMS.lightRadius ?? 3) || 0);
  const COLOR = /^#[0-9a-f]{6}$/i.test(String(PARAMS.lightColor || "")) ? PARAMS.lightColor : "#ffcf80";
  const STRENGTH = Math.max(0, Math.min(1, Number(PARAMS.lightStrength ?? 0.45)));

  let tone = null; // [r, g, b] while it is night on this map, else null
  let lights = []; // the pools of light this frame, in screen pixels: { x, y, r }

  /** A colour matrix that keeps `keep` of each channel and adds `lift` blue. */
  const matrixOf = (keep, lift) => [keep[0], 0, 0, 0, 0, 0, keep[1], 0, 0, 0, 0, 0, keep[2], 0, lift, 0, 0, 0, 1, 0];

  /** The tone a map asks for: its own note first, then its tileset. */
  function toneOfMap() {
    const note = String(($dataMap && $dataMap.note) || "");
    if (/<day>/i.test(note)) return null;
    const own = /<night:\s*([\d.\s]+),\s*([\d.\s]+),\s*([\d.\s]+)>/i.exec(note);
    if (own) return [Number(own[1]), Number(own[2]), Number(own[3])].map(v => Math.max(0, Math.min(1, v)));
    if (/<night>/i.test(note)) return DEFAULT;
    const tileset = $gameMap.tileset();
    return tileset && /:night>/i.test(String(tileset.note || "")) ? DEFAULT : null;
  }

  const setupMap = Game_Map.prototype.setup;
  Game_Map.prototype.setup = function (mapId) {
    setupMap.call(this, mapId);
    tone = toneOfMap();
  };

  /** The text an event is tagged with: its note and the comments on its current page. */
  function tagsOf(event) {
    const data = event.event(), page = event.page && event.page();
    const comments = page ? page.list.filter(c => c.code === 108 || c.code === 408).map(c => String(c.parameters[0])) : [];
    return [String((data && data.note) || ""), ...comments].join("\n");
  }

  /** What an event gives off: { glow, light: { r, color, oy } | null }. Worked out again only when its page changes. */
  function lightingOf(event) {
    const page = event.page && event.page();
    if (event._nightPage === page && event._nightLighting) return event._nightLighting;
    const tags = tagsOf(event);
    const tag = /<light(?::\s*([\d.]+)\s*(?:,\s*(#[0-9a-f]{6}))?\s*(?:,\s*(-?[\d.]+))?)?>/i.exec(tags);
    const glow = /<glow>/i.test(tags) || !!tag;
    let light = null;
    if (tag) { const r = tag[1] !== undefined ? Number(tag[1]) : RADIUS; if (r > 0) light = { r, color: tag[2] || COLOR, oy: Number(tag[3]) || 0 }; }
    else if (glow && RADIUS > 0) light = { r: RADIUS, color: COLOR, oy: 0 };
    event._nightPage = page;
    event._nightLighting = { glow, light };
    return event._nightLighting;
  }

  // ---- pools of light: a soft round glow added onto the ground, under the characters ----

  const halos = new Map(); // "radius,colour" -> Bitmap
  function haloBitmap(radiusPx, color) {
    const key = radiusPx + "," + color;
    if (!halos.has(key)) {
      const size = Math.ceil(radiusPx * 2), bitmap = new Bitmap(size, size), ctx = bitmap.context;
      const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, `rgba(${r},${g},${b},${STRENGTH})`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},${STRENGTH * 0.5})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
      bitmap.baseTexture.update();
      halos.set(key, bitmap);
    }
    return halos.get(key);
  }

  const updateSpriteset = Spriteset_Map.prototype.update;
  Spriteset_Map.prototype.update = function () {
    updateNightLights.call(this);
    updateSpriteset.call(this);
  };

  function updateNightLights() {
    this._nightHalos = this._nightHalos || new Map(); // event id -> Sprite
    const seen = new Set(), tw = $gameMap.tileWidth(), th = $gameMap.tileHeight(), t = Graphics.frameCount;
    lights = [];
    if (tone && this._tilemap) for (const event of $gameMap.events()) {
      if (event._erased || event._pageIndex < 0) continue;
      const { light } = lightingOf(event);
      if (!light) continue;
      const x = event.screenX(), y = event.screenY() - th / 2 + light.oy * th, r = light.r * tw;
      if (x < -r || y < -r || x > Graphics.width + r || y > Graphics.height + r) continue;
      // a slow, uneven flicker, different for each light
      const flicker = 0.92 + 0.05 * Math.sin(t * 0.11 + event.eventId() * 1.7) + 0.03 * Math.sin(t * 0.37 + event.eventId());
      let halo = this._nightHalos.get(event.eventId());
      if (!halo || halo._key !== r + light.color) {
        if (halo) this._tilemap.removeChild(halo);
        halo = new Sprite(haloBitmap(r, light.color));
        halo._key = r + light.color; halo.anchor.set(0.5, 0.5); halo.blendMode = PIXI.BLEND_MODES.ADD; halo.z = 1;
        this._tilemap.addChild(halo); this._nightHalos.set(event.eventId(), halo);
      }
      halo.x = x; halo.y = y; halo.opacity = 255 * flicker; halo.visible = true;
      seen.add(event.eventId());
      lights.push({ x, y, r: r * flicker });
    }
    for (const [id, halo] of this._nightHalos) if (!seen.has(id)) halo.visible = false;
  }

  /** How lit a point on screen is, 0 (dark) to 1 (in the heart of a light). */
  function lightAt(x, y) {
    let best = 0;
    for (const l of lights) { const d = Math.hypot(l.x - x, l.y - y); if (d < l.r) best = Math.max(best, Math.pow(1 - d / l.r, 1.3)); }
    return best;
  }

  // ---- characters: darkened at night, less so in a pool of light; lights themselves stay bright ----

  const updateSprite = Sprite_Character.prototype.update;
  Sprite_Character.prototype.update = function () {
    updateSprite.call(this);
    const character = this._character;
    const glow = character instanceof Game_Event && lightingOf(character).glow;
    if (!tone || !character || glow) {
      if (this._nightFilter) { this.filters = (this.filters || []).filter(f => f !== this._nightFilter); if (!this.filters.length) this.filters = null; this._nightFilter = null; }
      return;
    }
    if (!this._nightFilter) { this._nightFilter = new PIXI.filters.ColorMatrixFilter(); this.filters = [...(this.filters || []), this._nightFilter]; this._nightLevel = -1; }
    const level = Math.round(lightAt(this.x, this.y - $gameMap.tileHeight() / 2) * 0.85 * 50) / 50; // even the heart of a light is a little dim
    if (level === this._nightLevel && tone === this._nightTone) return;
    this._nightLevel = level; this._nightTone = tone;
    this._nightFilter.matrix = matrixOf(tone.map(v => v + (1 - v) * level), LIFT * (1 - level));
  };

  window.NightLighting = {
    isNight: () => !!tone,
    set: (r, g, b) => { tone = [r, g, b].map(v => Math.max(0, Math.min(1, Number(v) || 0))); },
    clear: () => { tone = null; }
  };
})();
