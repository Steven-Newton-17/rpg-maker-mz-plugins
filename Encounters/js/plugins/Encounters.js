/*:
 * @target MZ
 * @plugindesc v1.1.0 Rule-based random encounters, scripted battles, loot tables, and conditional battle outcomes.
 * @author Steven Newton
 *
 * @param encounterDataFile
 * @text Encounters File
 * @type string
 * @default Encounters.json
 *
 * @command startBattle
 * @text Start Battle
 * @desc Starts a named battle once nothing else is running.
 * @arg battleId
 * @text Battle ID
 * @type string
 * @default
 *
 * @help
 * Encounters replaces "a list of troops on the map" with rules, and adds named battles whose
 * outcome depends on the story. Everything is authored in the Game Manager.
 *
 * Spawn tables (random encounters)
 *   A map with a table ignores its editor encounter list. The first rule whose conditions pass
 *   (and whose regions match the player's tile) decides what can appear, how often, and what drops.
 *   When no rule passes there are no encounters. Maps without a table are untouched.
 *   Rule: { conditions, regions[], steps, entries[{battle|troop, weight, conditions}], loot[],
 *           goldRate, expRate, replaceDrops, canEscape, defeat: "gameOver"|"continue" }
 *
 * Battles
 *   { name, troop, canEscape, goldRate, expRate, replaceDrops, loot[], rules[] }
 *   Outcome rules run after the battle, first match wins:
 *   { result: "win"|"lose"|"escape"|"any", conditions, effects, dialogue, defeat, once }
 *   A losing battle ends the game unless a matching "lose" rule has defeat "continue".
 *   Conditions are checked when the battle ends, so they can depend on the story so far.
 *
 * Loot entries: { type: "item"|"weapon"|"armor"|"gold", target, count, chance (percent), conditions }
 *
 * Starting a battle
 *   Effect "battle" (target = battle id, optional winState = the Thing's state once won) from a dialogue or rule; Plugin Command Start Battle;
 *   Encounters.start("id"). The battle begins once the current dialogue or event has finished,
 *   and the placed Thing that started it can be addressed as target "self" in the outcome effects.
 *
 * Script API
 *   Encounters.start("id")         Encounters.table(mapId)       Encounters.activeRule()
 *   Encounters.isBattleActive()    Encounters.lastResult()       // "win" | "lose" | "escape"
 *
 * Requires ConditionSystem and DialogueSystem, loaded before this plugin.
 */
(() => {
"use strict";
const pluginName = "Encounters";
const params = PluginManager.parameters(pluginName);
const dataFile = String(params.encounterDataFile || "Encounters.json");
const warned = new Set();
const warnOnce = message => { if (!warned.has(message)) { warned.add(message); console.warn(message); } };

window.$dataEncounters = null;
DataManager._databaseFiles.push({ name: "$dataEncounters", src: dataFile });

const save = () => { $gameSystem._encounters = $gameSystem._encounters || { done: {}, last: null }; return $gameSystem._encounters; };

/* "self" in a rule's effects means the placed Thing that started the battle (its state key, e.g. "goblin@7:p1"). */
const resolveSelf = (value, context) => {
    const selfKey = context?.selfKey;
    if (Array.isArray(value)) return value.map(item => resolveSelf(item, context));
    if (value && typeof value === "object") {
        const out = {};
        for (const [key, item] of Object.entries(value)) out[key] = key === "target" && item === "self" && selfKey ? selfKey : resolveSelf(item, context);
        return out;
    }
    return value;
};
const passes = (conditions, context) => !conditions || ConditionSystem.check(resolveSelf(conditions, context));
const asList = value => (Array.isArray(value) ? value : []);

let active = null;     // the battle in progress: { id, def, rule, troopId, canEscape, mods, context, defeatContinue }
let finished = null;   // what just ended, waiting to be turned into outcome effects on the map
let queued = null;     // a scripted battle waiting for the map to be idle

const E = window.Encounters = {
    version: "1.1.0",
    battle(id) { return window.$dataEncounters?.battles?.[id] || null; },
    table(mapId) {
        const id = mapId ?? window.$gameMap?.mapId?.();
        return id ? window.$dataEncounters?.tables?.[String(id)] || null : null;
    },
    isBattleActive() { return !!active; },
    lastResult() { return save().last; },

    // ---- spawn tables ----
    ruleAllowed(rule) {
        const regions = asList(rule.regions);
        if (regions.length && !regions.includes($gamePlayer.regionId())) return false;
        return passes(rule.conditions, null);
    },
    activeRule(mapId) {
        const table = this.table(mapId);
        if (!window.$gamePlayer) return null;
        return table ? asList(table.rules).find(rule => this.ruleAllowed(rule)) || null : null;
    },
    pickEntry(rule) {
        const options = asList(rule.entries).filter(entry => (entry.battle || entry.troop) && passes(entry.conditions, null));
        const total = options.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 1), 0);
        if (total <= 0) return null;
        let roll = Math.random() * total;
        for (const entry of options) { roll -= Math.max(0, Number(entry.weight) || 1); if (roll < 0) return entry; }
        return options[options.length - 1];
    },

    // ---- starting battles ----
    /** Queues a scripted battle; it starts when no event, message, or dialogue is running. */
    start(battleId, context = {}) {
        if (!this.battle(battleId)) { warnOnce(`Encounters: unknown battle '${battleId}'.`); return false; }
        queued = { battleId: String(battleId), context };
        return true;
    },
    /** Prepares BattleManager for a named battle (optionally inside a spawn rule). */
    prepareBattle(battleId, context = {}, spawnRule = null) {
        const def = this.battle(battleId);
        if (!def || !window.$dataTroops?.[def.troop]) { warnOnce(`Encounters: battle '${battleId}' has no valid troop.`); return false; }
        const mods = mergeMods([def, spawnRule].filter(Boolean));
        active = { id: String(battleId), def, rule: spawnRule, troopId: Number(def.troop), canEscape: def.canEscape !== false && (!spawnRule || spawnRule.canEscape !== false), mods, context };
        BattleManager.setup(active.troopId, active.canEscape, false);
        return true;
    },
    prepareTroop(troopId, rule) {
        if (!window.$dataTroops?.[troopId]) { warnOnce(`Encounters: unknown troop ${troopId}.`); return false; }
        active = { id: null, def: null, rule, troopId: Number(troopId), canEscape: rule.canEscape !== false, mods: mergeMods([rule]), context: {}, defeatContinue: rule.defeat === "continue" };
        BattleManager.setup(active.troopId, active.canEscape, false);
        return true;
    },

    // ---- outcomes ----
    outcomeRule(result, source = active) {
        const def = source?.def;
        if (!def) return null;
        for (const rule of asList(def.rules)) {
            if (rule.once && save().done[source.id + "/" + rule.id]) continue;
            const wants = rule.result || "any";
            if (wants !== "any" && wants !== result) continue;
            if (passes(rule.conditions, source.context)) return rule;
        }
        return null;
    },
    defeatAllowed() {
        if (!active) return false;
        const rule = this.outcomeRule("lose");
        if (rule) return rule.defeat === "continue";
        return !!active.defeatContinue;
    }
};

function mergeMods(sources) {
    const mods = { goldRate: 1, expRate: 1, replaceDrops: false, loot: [] };
    for (const source of sources) {
        mods.goldRate *= Number(source.goldRate ?? 1);
        mods.expRate *= Number(source.expRate ?? 1);
        if (source.replaceDrops) mods.replaceDrops = true;
        mods.loot.push(...asList(source.loot));
    }
    return mods;
}

/* ---------- random encounters ---------- */
const _makeEncounterCount = Game_Player.prototype.makeEncounterCount;
Game_Player.prototype.makeEncounterCount = function() {
    const table = E.table();
    const rule = table && E.activeRule();
    const steps = Number(rule?.steps ?? table?.steps) || 0;
    if (!steps) return _makeEncounterCount.call(this);
    this._encounterCount = Math.randomInt(steps) + Math.randomInt(steps) + 1;
};

const _executeEncounter = Game_Player.prototype.executeEncounter;
Game_Player.prototype.executeEncounter = function() {
    if (!E.table()) return _executeEncounter.call(this); // no table here: the map's own encounter list applies
    if ($gameMap.isEventRunning() || this._encounterCount > 0) return false;
    this.makeEncounterCount();
    const rule = E.activeRule();
    const entry = rule && E.pickEntry(rule);
    if (!entry) return false;
    const ready = entry.battle ? E.prepareBattle(entry.battle, {}, rule) : E.prepareTroop(entry.troop, rule);
    if (!ready) return false;
    BattleManager.onEncounter();
    return true;
};

/* ---------- loot and rates ---------- */
const databaseOf = { item: "$dataItems", weapon: "$dataWeapons", armor: "$dataArmors" };
const _makeRewards = BattleManager.makeRewards;
BattleManager.makeRewards = function() {
    _makeRewards.call(this);
    if (!active) return;
    const { goldRate, expRate, replaceDrops, loot } = active.mods;
    const rewards = this._rewards;
    rewards.gold = Math.round(rewards.gold * goldRate);
    rewards.exp = Math.round(rewards.exp * expRate);
    if (replaceDrops) rewards.items = [];
    for (const entry of loot) {
        if (!passes(entry.conditions, active.context)) continue;
        if (Math.random() * 100 >= (entry.chance === undefined ? 100 : Number(entry.chance))) continue;
        const count = Math.max(1, Number(entry.count) || 1);
        if (entry.type === "gold") { rewards.gold += count; continue; }
        const database = window[databaseOf[entry.type]];
        const item = database?.[Number(entry.target)];
        if (!item) { warnOnce(`Encounters: loot '${entry.type}' ${entry.target} does not exist.`); continue; }
        for (let i = 0; i < count; i++) rewards.items.push(item);
    }
};

/* ---------- outcomes ---------- */
const _processDefeat = BattleManager.processDefeat;
BattleManager.processDefeat = function() {
    if (active) this._canLose = E.defeatAllowed(); // decided now, so the story so far can matter
    _processDefeat.call(this);
};

const _endBattle = BattleManager.endBattle;
BattleManager.endBattle = function(result) {
    const wasLost = result === 2;
    const gameOver = !!active && wasLost && !this._canLose;
    _endBattle.call(this, result);
    if (!active) return;
    const outcome = result === 0 ? "win" : this._escaped || result === 1 ? "escape" : "lose";
    save().last = outcome;
    finished = { source: active, result: outcome, gameOver };
    active = null;
};

/** Applies the matching outcome rule once the map is running again. */
const runOutcome = ({ source, result, gameOver }) => {
    if (gameOver) return;
    const rule = E.outcomeRule(result, source);
    const selfKey = source.context?.selfKey;
    // the monster that started the fight leaves (or changes) when it is beaten, whether or not an outcome rule matches
    if (result === "win" && source.context?.winState && selfKey && window.Interactions) { Interactions.setThingState(selfKey, source.context.winState); if (!rule) Interactions.refresh(); }
    if (!rule) return;
    if (rule.once) save().done[source.id + "/" + rule.id] = true;
    const context = { source: "encounter", subject: source.context?.subject, selfKey, battle: source.id, ruleId: rule.id };
    if (asList(rule.effects).length) DialogueSystem.applyEffects(resolveSelf(rule.effects, source.context), context);
    if (rule.dialogue && !DialogueSystem.start(rule.dialogue)) warnOnce(`Encounters: outcome '${rule.name || rule.id}' points at missing dialogue '${rule.dialogue}'.`);
    if (window.Interactions?.refresh) Interactions.refresh(); else $gameMap.requestRefresh();
};

const mapIsIdle = () => !$gameMap.isEventRunning() && !$gameMessage.isBusy() && !DialogueSystem.isRunning() && !SceneManager.isSceneChanging() && !$gamePlayer.isTransferring();
E.tick = function() {
    if (!mapIsIdle()) return;
    if (finished) { const done = finished; finished = null; runOutcome(done); return; }
    if (queued && !BattleManager.isBattleTest()) {
        const { battleId, context } = queued; queued = null;
        if (E.prepareBattle(battleId, context)) { $gamePlayer.makeEncounterCount(); SceneManager.push(Scene_Battle); }
    }
};
const _Scene_Map_update = Scene_Map.prototype.update;
Scene_Map.prototype.update = function() { _Scene_Map_update.call(this); E.tick(); };

/* ---------- commands and effects ---------- */
PluginManager.registerCommand(pluginName, "startBattle", args => E.start(String(args.battleId || "").trim()));
DialogueSystem.registerEffect("battle", (effect, context) => E.start(effect.target, { subject: context?.subject, selfKey: context?.selfKey, winState: effect.winState || "" }));
})();
