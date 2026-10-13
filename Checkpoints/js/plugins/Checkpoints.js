/*:
 * @target MZ
 * @plugindesc v1.0.0 Chapter Select for testing: start the game from any story checkpoint, or capture the current moment as one.
 * @author Steven Newton
 *
 * @param showInRelease
 * @text Show in release builds
 * @desc Off: Chapter Select only appears in test play (RPG Maker's Playtest, or ?test in a browser).
 * @type boolean
 * @default false
 *
 * @param hotkey
 * @text Hotkey (key code)
 * @desc Opens Chapter Select on the map during test play. 118 = F7.
 * @type number
 * @default 118
 *
 * @help
 * Checkpoints live in the Game Manager's content/checkpoints/**.json and compile to data/Checkpoints.json.
 *
 *   Title screen → Chapter Select     start from any checkpoint
 *   F7 on the map                     the same list, plus "Capture this moment"
 *   index.html?test&checkpoint=<id>   boots straight into a checkpoint (Game Manager "Play from here", tests)
 *
 * A checkpoint:
 *   { "id": "ch1_free_roam", "chapter": "Chapter 1", "name": "Free roam with Lio", "order": 30,
 *     "description": "After the repair; Lio follows.", "after": "ch1_after_duel",      (optional: builds on another)
 *     "position": { "map": 7, "x": 20, "y": 16, "d": 2 },
 *     "state": { ...captured snapshot... },                                              (from "Capture this moment")
 *     "worldStates": { "ch1_explored": true }, "variables": { "22": 6 },                 (hand-written additions)
 *     "items": { "39": 1 }, "partyAdd": [2], "partyRemove": [], "quests": { "id": { "status": "active", "revealed": [0], "completed": [] } },
 *     "thingStates": { "ch1_decoration": "repaired" }, "heard": ["ch1_joren_v2"], "chronicle": ["corin"] }
 * A captured snapshot holds the story state only: switches, variables, self switches, party, skills, items, gold and
 * the plugins' saved state (quests, Chronicle, relationships, heard dialogue, Things, encounters...). Not the Log.
 *
 * Captures are written to content/checkpoints/Captured/ (in test play through NW.js, or through the Game Manager when the
 * game runs from it). Rename and move them into the chapter's folder in the Game Manager or the file system.
 */
(() => {
"use strict";
const pluginName = "Checkpoints";
const params = PluginManager.parameters(pluginName);
const showInRelease = String(params.showInRelease) === "true";
const hotkey = Number(params.hotkey) || 118;
const enabled = () => showInRelease || $gameTemp?.isPlaytest() || /[?&]test\b/.test(location.search);

window.$dataCheckpoints = null;
const _loadDataFile = DataManager.loadDataFile;
DataManager.loadDataFile = function(name, src) {
    if (name !== "$dataCheckpoints") return _loadDataFile.call(this, name, src);
    const request = new XMLHttpRequest();
    request.open("GET", "data/" + src);
    request.overrideMimeType("application/json");
    const done = () => { try { window[name] = request.status < 400 && request.responseText ? JSON.parse(request.responseText) : []; } catch { window[name] = []; } };
    request.onload = done;
    request.onerror = () => { window[name] = []; };
    request.send();
};
DataManager._databaseFiles.push({ name: "$dataCheckpoints", src: "Checkpoints.json" });

const SYSTEM_FIELDS = ["_characterStages", "_chronicleStates", "_dialogueHeard", "_encounters", "_examine", "_interactions",
    "_questJournalStates", "_relationshipStates", "_reputationValues"];
const copy = value => JsonEx.makeDeepCopy(value);
const list = () => (Array.isArray(window.$dataCheckpoints) ? window.$dataCheckpoints : []).slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.id).localeCompare(String(b.id)));
const byId = id => list().find(c => c.id === id) || null;

/* ---------- applying ---------- */
function applyState(s) {
    for (const n of s.switches || []) $gameSwitches.setValue(Number(n), true);
    for (const [n, v] of Object.entries(s.variables || {})) $gameVariables.setValue(Number(n), v);
    for (const key of s.selfSwitches || []) $gameSelfSwitches._data[key] = true;
    if (Array.isArray(s.party)) $gameParty._actors = s.party.slice();
    for (const [actorId, skills] of Object.entries(s.skills || {})) { const a = $gameActors.actor(Number(actorId)); if (a) for (const id of skills) a.learnSkill(id); }
    if (s.items) $gameParty._items = copy(s.items);
    if (s.weapons) $gameParty._weapons = copy(s.weapons);
    if (s.armors) $gameParty._armors = copy(s.armors);
    if (Number.isFinite(s.gold)) $gameParty._gold = s.gold;
    for (const [field, value] of Object.entries(s.system || {})) if (SYSTEM_FIELDS.includes(field)) $gameSystem[field] = copy(value);
}
function applyFriendly(c) {
    for (const [id, v] of Object.entries(c.worldStates || {})) window.WorldState?.set(id, v);
    for (const [n, v] of Object.entries(c.variables || {})) $gameVariables.setValue(Number(n), v);
    for (const [n, v] of Object.entries(c.switches || {})) $gameSwitches.setValue(Number(n), !!v);
    for (const [kind, data] of [["items", $dataItems], ["weapons", $dataWeapons], ["armors", $dataArmors]])
        for (const [id, count] of Object.entries(c[kind] || {})) { const entry = data[Number(id)]; if (entry) $gameParty.gainItem(entry, Number(count) - $gameParty.numItems(entry)); }
    for (const id of c.partyAdd || []) $gameParty.addActor(Number(id));
    for (const id of c.partyRemove || []) $gameParty.removeActor(Number(id));
    for (const [questId, q] of Object.entries(c.quests || {})) {
        if (!window.QuestJournal) break;
        if (q.status && q.status !== "hidden") QuestJournal.accept(questId);
        for (const i of q.revealed || []) QuestJournal.revealObjective(questId, i);
        for (const i of q.completed || []) QuestJournal.completeObjective(questId, i);
        for (const [i, v] of Object.entries(q.progress || {})) QuestJournal.setProgress(questId, Number(i), v);
        if (q.status === "completed") QuestJournal.complete(questId);
        if (q.status === "failed") QuestJournal.fail(questId);
    }
    const inter = ($gameSystem._interactions ||= { states: {}, done: {} });
    for (const [key, state] of Object.entries(c.thingStates || {})) (inter.states ||= {})[key] = state;
    const heard = ($gameSystem._dialogueHeard ||= {});
    for (const id of c.heard || []) heard[id] ||= { n0: true };
    for (const id of c.chronicle || []) window.Chronicle?.discover?.(id);
    for (const [id, v] of Object.entries(c.relationships || {})) window.Relationships?.set?.(id, v);
    for (const [actorId, skills] of Object.entries(c.learn || {})) { const a = $gameActors.actor(Number(actorId)); if (a) for (const id of skills) a.learnSkill(Number(id)); }
}
function chainOf(id) {
    const chain = [];
    for (let c = byId(id), guard = 0; c && guard < 50; c = c.after ? byId(c.after) : null, guard++) chain.unshift(c);
    return chain;
}
/** Starts a new game at a checkpoint. Returns false when the id is unknown. */
function start(id) {
    const chain = chainOf(id);
    if (!chain.length) { console.warn(`Checkpoints: unknown checkpoint '${id}'.`); return false; }
    DataManager.setupNewGame();
    for (const c of chain) { if (c.state) applyState(c.state); applyFriendly(c); }
    const pos = [...chain].reverse().find(c => c.position)?.position;
    if (pos) $gamePlayer.reserveTransfer(Number(pos.map), Number(pos.x), Number(pos.y), Number(pos.d) || 2, 0);
    $gamePlayer.refresh();
    SceneManager.goto(Scene_Map);
    return true;
}

/* ---------- capturing ---------- */
function snapshot() {
    const switches = [], variables = {};
    for (let i = 1; i < $dataSystem.switches.length; i++) if ($gameSwitches.value(i)) switches.push(i);
    for (let i = 1; i < $dataSystem.variables.length; i++) { const v = $gameVariables.value(i); if (v !== 0) variables[i] = v; }
    const skills = {};
    for (const id of $gameParty._actors) skills[id] = $gameActors.actor(id)?._skills?.slice() || [];
    const system = {};
    for (const field of SYSTEM_FIELDS) if ($gameSystem[field] !== undefined) system[field] = copy($gameSystem[field]);
    return {
        switches, variables, selfSwitches: Object.keys($gameSelfSwitches._data).filter(k => $gameSelfSwitches._data[k]),
        party: $gameParty._actors.slice(), skills, items: copy($gameParty._items), weapons: copy($gameParty._weapons),
        armors: copy($gameParty._armors), gold: $gameParty._gold, system
    };
}
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "checkpoint";
/** Captures the current moment. Writes content/checkpoints/Captured/<id>.json where it can; returns the checkpoint. */
async function capture(info = {}) {
    const stamp = new Date().toTimeString().slice(0, 5);
    const name = info.name || `${$dataMapInfos[$gameMap.mapId()]?.name || "Map " + $gameMap.mapId()} at ${stamp}`;
    const checkpoint = {
        id: info.id || "cap_" + slug(name) + "_" + Date.now().toString(36), chapter: info.chapter || "Captured", name,
        order: info.order ?? 9000, description: info.description || "",
        position: { map: $gameMap.mapId(), x: $gamePlayer.x, y: $gamePlayer.y, d: $gamePlayer.direction() }, state: snapshot()
    };
    const text = JSON.stringify(checkpoint, null, 2) + "\n";
    let where = null;
    try {
        if (Utils.isNwjs()) {
            const fs = require("fs"), path = require("path");
            const dir = path.join(path.dirname(process.mainModule.filename), "content", "checkpoints", info.folder || "Captured");
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, checkpoint.id + ".json"), text);
            where = dir;
        } else {
            const response = await fetch("/api/checkpoints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder: info.folder || "Captured", checkpoint }) });
            if (response.ok) where = "the Game Manager (content/checkpoints/" + (info.folder || "Captured") + ")";
        }
    } catch (error) { console.warn("Checkpoints: could not write the capture.", error); }
    if (!where) console.log("Checkpoints: capture (copy into content/checkpoints):\n" + text);
    window.$dataCheckpoints = [...(window.$dataCheckpoints || []).filter(c => c.id !== checkpoint.id), checkpoint];
    return { checkpoint, where };
}

window.Checkpoints = { version: "1.0.0", list, start, capture, snapshot, enabled };

/* ---------- Chapter Select scene ---------- */
class Window_CheckpointList extends Window_Command {
    initialize(rect, canCapture) { this._canCapture = canCapture; super.initialize(rect); }
    makeCommandList() {
        if (this._canCapture) this.addCommand("Capture this moment", "capture");
        let chapter = null;
        for (const c of list()) {
            if (c.chapter !== chapter) this.addCommand(c.chapter || "Checkpoints", "header", false);
            chapter = c.chapter;
            this.addCommand(c.name || c.id, "checkpoint", true, c.id);
        }
        if (!list().length) this.addCommand("No checkpoints yet", "none", false);
    }
    itemTextAlign() { return "left"; }
    drawItem(index) {
        const rect = this.itemLineRect(index), symbol = this.commandSymbol(index);
        this.resetTextColor();
        if (symbol === "header") { this.changeTextColor(ColorManager.systemColor()); this.changePaintOpacity(true); this.drawText(this.commandName(index), rect.x, rect.y, rect.width); return; }
        if (symbol === "capture") this.changeTextColor(ColorManager.powerUpColor());
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawText(this.commandName(index), rect.x + (symbol === "checkpoint" ? 24 : 0), rect.y, rect.width - 24);
    }
    select(index) { // skip chapter headings
        if (index < 0 || !this._list) return super.select(index);
        const step = index >= this.index() ? 1 : -1;
        while (index >= 0 && index < this.maxItems() && this.commandSymbol(index) === "header") index += step;
        if (index < 0 || index >= this.maxItems()) index = this._list.findIndex(c => c.symbol !== "header");
        super.select(index);
    }
    updateHelp() {
        const ext = this.currentExt(), c = ext && byId(ext);
        this._helpWindow?.setText(this.currentSymbol() === "capture" ? "Save the current story state as a new checkpoint." : c ? (c.description || c.id) : "");
    }
}
class Scene_ChapterSelect extends Scene_MenuBase {
    prepare(fromMap) { this._fromMap = !!fromMap; }
    create() {
        super.create();
        this._helpWindow = new Window_Help(new Rectangle(0, this.mainAreaTop(), Graphics.boxWidth, this.calcWindowHeight(2, false)));
        this.addWindow(this._helpWindow);
        const top = this._helpWindow.y + this._helpWindow.height;
        this._listWindow = new Window_CheckpointList(new Rectangle(0, top, Graphics.boxWidth, Graphics.boxHeight - top), this._fromMap);
        this._listWindow.setHelpWindow(this._helpWindow);
        this._listWindow.setHandler("checkpoint", () => { const id = this._listWindow.currentExt(); if (!start(id)) this._listWindow.activate(); });
        this._listWindow.setHandler("capture", () => this.onCapture());
        this._listWindow.setHandler("cancel", () => this.popScene());
        this.addWindow(this._listWindow);
    }
    async onCapture() {
        const result = await capture();
        this._listWindow.refresh(); this._listWindow.activate();
        this._helpWindow.setText(result.where ? "Captured: " + result.checkpoint.name + "\nRename it in content/checkpoints/Captured." : "Captured for this session (see the console to copy it).");
    }
}
window.Scene_ChapterSelect = Scene_ChapterSelect;

// Title screen
const _makeTitle = Window_TitleCommand.prototype.makeCommandList;
Window_TitleCommand.prototype.makeCommandList = function() {
    _makeTitle.call(this);
    if (enabled()) this.addCommand("Chapter Select", "chapterSelect");
};
const _titleRect = Scene_Title.prototype.commandWindowRect;
Scene_Title.prototype.commandWindowRect = function() {
    const rect = _titleRect.call(this);
    if (enabled()) { const extra = this.calcWindowHeight(4, true) - rect.height; rect.height += extra; rect.y = Math.max(0, rect.y - extra); }
    return rect;
};
const _createTitle = Scene_Title.prototype.createCommandWindow;
Scene_Title.prototype.createCommandWindow = function() {
    _createTitle.call(this);
    this._commandWindow.setHandler("chapterSelect", () => { this._commandWindow.close(); SceneManager.push(Scene_ChapterSelect); SceneManager.prepareNextScene(false); });
};

// F7 on the map
Input.keyMapper[hotkey] = "chapterSelect";
const _updateMap = Scene_Map.prototype.update;
Scene_Map.prototype.update = function() {
    _updateMap.call(this);
    if (enabled() && Input.isTriggered("chapterSelect") && !SceneManager.isSceneChanging() && !$gameMessage.isBusy()) {
        SceneManager.push(Scene_ChapterSelect); SceneManager.prepareNextScene(true);
    }
};

// index.html?test&checkpoint=<id>: boot straight into a checkpoint
const wanted = new URLSearchParams(location.search).get("checkpoint");
const _startNormalGame = Scene_Boot.prototype.startNormalGame;
Scene_Boot.prototype.startNormalGame = function() {
    if (wanted && enabled() && byId(wanted)) { this.checkPlayerLocation(); start(wanted); return; }
    _startNormalGame.call(this);
};
})();
