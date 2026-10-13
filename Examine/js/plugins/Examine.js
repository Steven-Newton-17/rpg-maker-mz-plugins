/*:
 * @target MZ
 * @plugindesc v1.1.0 Examine anything: press OK facing a map tile with no event to hear a line about it.
 * @author Steven Newton
 * @orderAfter DialogueSystem
 *
 * @help
 * Requires DialogueSystem (and ConditionSystem for "when"). Data: data/Examine.json, compiled by the Game Manager
 * from content/examine/**. Without the file the plugin does nothing.
 *
 * An entry:
 *   { "id": "barrel_sealed",                       unique; counts how often it was looked at
 *     "tileset": 7, "tiles": [63],                 tile ids (B-E objects, or autotile base ids) on that tileset
 *     "maps": [7, 9],                              optional: only on these maps
 *     "at": { "7": ["38,15", "40,15"] },           optional: only these cells (map id -> "x,y"); checked first
 *     "when": { ...condition... },                 optional: only while it passes (story state)
 *     "speaker": "ava", "expression": "neutral",   default Ava; null for narration
 *     "mode": "object",                            object | cycle | random | once-then-last (see below)
 *     "lines": ["Closed tight.", "Smells like... cider?", { "speaker": null, "text": "A spider lives here." }] }
 * Modes. "object" (the default for tile entries) gives every object its own line for good: this barrel always holds
 * cider, that one is always empty. An object is the patch of touching cells the entry matches, so a two-tile tree is one
 * tree. Write each line so it is true of any single object; put a one-off fact on an "at" entry instead.
 * "cycle" (the default for "at" entries) steps through the lines, so they must all stay true together.
 * Most specific first: entries with "at", then entries limited to maps, then the rest. Events in front always win.
 * Each look is shown through DialogueSystem, so it appears in the Log.
 */
(() => {
"use strict";
const DS = window.DialogueSystem;
if (!DS) throw new Error("Examine requires DialogueSystem above it.");

window.$dataExamine = null;
// The data file is optional: a game without content/examine simply has no flavour text.
const _loadDataFile = DataManager.loadDataFile;
DataManager.loadDataFile = function(name, src) {
    if (name !== "$dataExamine") return _loadDataFile.call(this, name, src);
    const request = new XMLHttpRequest();
    request.open("GET", "data/" + src);
    request.overrideMimeType("application/json");
    const done = () => { try { window[name] = request.status < 400 && request.responseText ? JSON.parse(request.responseText) : []; } catch { window[name] = []; } prepare(); };
    request.onload = done;
    request.onerror = () => { window[name] = []; prepare(); };
    request.send();
};
DataManager._databaseFiles.push({ name: "$dataExamine", src: "Examine.json" });

let entries = [];
function prepare() {
    const rank = e => (e.at ? 0 : e.maps ? 1 : 2);
    entries = (Array.isArray(window.$dataExamine) ? window.$dataExamine : []).slice().sort((a, b) => rank(a) - rank(b));
}

const seen = () => ($gameSystem._examine ||= {});
const tilesAt = (x, y) => [3, 2, 1, 0].map(z => $gameMap.tileId(x, y, z)).filter(id => id > 0);
const matchesTile = (entry, id) => (entry.tiles || []).some(t => t === id || (t >= Tilemap.TILE_ID_A1 && id >= Tilemap.TILE_ID_A1 && Tilemap.isSameKindTile(t, id)));

function find(x, y) {
    const mapId = $gameMap.mapId(), tileset = $gameMap.tilesetId(), cell = x + "," + y, tiles = tilesAt(x, y);
    for (const entry of entries) {
        if (entry.maps && !entry.maps.includes(mapId)) continue;
        if (entry.when && window.ConditionSystem && !ConditionSystem.check(entry.when)) continue;
        if (entry.at) { if ((entry.at[mapId] || entry.at[String(mapId)] || []).includes(cell)) return entry; continue; }
        if (entry.tileset && Number(entry.tileset) !== tileset) continue;
        if (tiles.some(id => matchesTile(entry, id))) return entry;
    }
    return null;
}

// The object under (x, y): the touching cells this entry matches. Large patches (a forest) count as one object.
function objectKey(entry, x, y) {
    const key = (a, b) => a + "," + b, done = new Set([key(x, y)]), queue = [[x, y]];
    let best = [x, y];
    while (queue.length) {
        const [cx, cy] = queue.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
            if (done.has(k) || !$gameMap.isValid(nx, ny) || !tilesAt(nx, ny).some(id => matchesTile(entry, id))) continue;
            done.add(k); queue.push([nx, ny]);
            if (done.size > 48) return entry.id + "@patch";
            if (ny < best[1] || (ny === best[1] && nx < best[0])) best = [nx, ny];
        }
    }
    return entry.id + "@" + $gameMap.mapId() + ":" + best.join(",");
}
const hash = text => { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

function show(entry, x, y) {
    const n = seen()[entry.id] || 0;
    seen()[entry.id] = n + 1;
    const lines = entry.lines;
    const mode = entry.mode || (entry.at ? "cycle" : "object");
    const index = mode === "random" ? Math.floor(Math.random() * lines.length)
        : mode === "once-then-last" ? Math.min(n, lines.length - 1)
        : mode === "object" && x !== undefined ? hash(objectKey(entry, x, y)) % lines.length : n % lines.length;
    const line = typeof lines[index] === "string" ? { text: lines[index] } : lines[index];
    const speaker = line.speaker !== undefined ? line.speaker : entry.speaker !== undefined ? entry.speaker : "ava";
    const node = { text: line.text, end: true };
    if (speaker) { node.speaker = speaker; node.expression = line.expression || entry.expression || "neutral"; }
    const id = "examine_" + entry.id + "_" + index;
    if (!DS.dialogue(id)) DS.registerDialogue({ id, name: "Examine: " + entry.id, start: "n0", nodes: { n0: node } });
    return DS.start(id);
}

window.Examine = { version: "1.1.0", find, show, entries: () => entries.slice() };

// OK facing a tile with no event: look at it.
const _triggerButtonAction = Game_Player.prototype.triggerButtonAction;
Game_Player.prototype.triggerButtonAction = function() {
    if (_triggerButtonAction.call(this)) return true;
    if (!Input.isTriggered("ok") || $gameMap.isEventRunning() || DS.isRunning() || $gameMessage.isBusy() || this.isInVehicle()) return false;
    const d = this.direction(), x = $gameMap.roundXWithDirection(this.x, d), y = $gameMap.roundYWithDirection(this.y, d);
    if ($gameMap.eventsXy(x, y).some(e => e._pageIndex >= 0 && !e._erased)) return false;
    const entry = find(x, y);
    return entry ? show(entry, x, y) : false;
};
})();
