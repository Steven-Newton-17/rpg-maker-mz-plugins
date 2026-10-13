/*:
 * @target MZ
 * @plugindesc v1.2.0 Persistent reputation, tiers, and condition adapter.
 * @author Steven Newton
 * @param factionDataFile
 * @text Faction Data File
 * @type string
 * @default Factions.json
 *
 * @command addReputation
 * @text Add Reputation
 * @arg factionId
 * @type string
 * @default academy
 * @arg amount
 * @type number
 * @min -9999
 * @default 10
 *
 * @command setReputation
 * @text Set Reputation
 * @arg factionId
 * @type string
 * @default academy
 * @arg value
 * @type number
 * @min -9999
 * @default 0
 *
 * @help
 * Define factions in data/Factions.json. Use id "global" for global fame.
 * Script API: Reputation.value/add/set/meets.
 */
(() => {
"use strict";
const pluginName = "Reputation";
const params = PluginManager.parameters(pluginName);
const dataFile = String(params.factionDataFile || "Factions.json");
const definitions = new Map();
let defaultTiers = [];
const builtinDefaultTiers = [
    { id: "hated", threshold: -100, displayName: "Hated" },
    { id: "hostile", threshold: -75, displayName: "Hostile" },
    { id: "unfriendly", threshold: -40, displayName: "Unfriendly" },
    { id: "distrusted", threshold: -10, displayName: "Distrusted" },
    { id: "unknown", threshold: 0, displayName: "Unknown" },
    { id: "known", threshold: 20, displayName: "Known" },
    { id: "friendly", threshold: 40, displayName: "Friendly" },
    { id: "respected", threshold: 60, displayName: "Respected" },
    { id: "honored", threshold: 80, displayName: "Honored" },
    { id: "savior", threshold: 100, displayName: "Savior" }
];
window.$dataFactions = null;
DataManager._databaseFiles.push({ name: "$dataFactions", src: dataFile });

const Rep = window.Reputation = {
    version: "1.2.0",
    reloadDefinitions() {
        definitions.clear();
        const data = window.$dataFactions;
        const source = Array.isArray(data) ? data : Array.isArray(data?.factions) ? data.factions : [];
        defaultTiers = this.normalizeTiers(Array.isArray(data?.defaultTiers) && data.defaultTiers.length ? data.defaultTiers : builtinDefaultTiers);
        for (const entry of source) {
            if (!entry?.id) continue;
            definitions.set(String(entry.id), { displayName: String(entry.id), initialValue: 0, minValue: -100, maxValue: 100, ...entry, id: String(entry.id) });
        }
    },
    normalizeTiers(tiers) {
        return tiers.filter(t => t?.id != null && Number.isFinite(Number(t.threshold)))
            .map(t => ({ id: String(t.id), threshold: Number(t.threshold), displayName: String(t.displayName || t.id) }))
            .sort((a, b) => a.threshold - b.threshold);
    },
    tiers(id) {
        const def = this.definition(id) || {};
        const merged = new Map(def.replaceTiers ? [] : defaultTiers.map(t => [t.id, { ...t }]));
        for (const override of Array.isArray(def.tiers) ? def.tiers : []) {
            if (!override?.id) continue;
            const prior = merged.get(String(override.id)) || defaultTiers.find(t => t.id === String(override.id)) || { id: String(override.id), threshold: 0, displayName: String(override.id) };
            merged.set(String(override.id), { ...prior, ...override, id: String(override.id), threshold: Number(override.threshold ?? prior.threshold), displayName: String(override.displayName ?? prior.displayName) });
        }
        return this.normalizeTiers([...merged.values()]);
    },
    definition(id) { return definitions.get(String(id)); },
    definitions() { return [...definitions.values()]; },
    state() { $gameSystem._reputationValues ||= {}; return $gameSystem._reputationValues; },
    value(id) { id = String(id); const def = this.definition(id); const values = this.state(); return Object.prototype.hasOwnProperty.call(values, id) ? Number(values[id]) || 0 : Number(def?.initialValue) || 0; },
    set(id, value) {
        id = String(id); const def = this.definition(id) || { minValue: -9999, maxValue: 9999 };
        const min = Number.isFinite(Number(def.minValue)) ? Number(def.minValue) : -9999;
        const max = Number.isFinite(Number(def.maxValue)) ? Number(def.maxValue) : 9999;
        this.state()[id] = Math.max(min, Math.min(max, Number(value) || 0));
        return this.value(id);
    },
    add(id, amount) { return this.set(id, this.value(id) + (Number(amount) || 0)); },
    meets(id, threshold) { return this.value(id) >= Number(threshold); },
    tier(id) {
        const tiers = this.tiers(String(id));
        if (!tiers.length) return { id: "unranked", threshold: Number.NEGATIVE_INFINITY, displayName: "Unranked", rank: 0 };
        const value = this.value(String(id));
        let rank = 0;
        for (let i = 0; i < tiers.length; i++) if (value >= tiers[i].threshold) rank = i;
        return { ...tiers[rank], rank };
    },
    tierId(id) { return this.tier(id).id; },
    tierRank(id) { return this.tier(id).rank; },
    tierName(id) { return this.tier(id).displayName; },
    global() { return this.value("global"); }
};

const _DataManager_onLoad = DataManager.onLoad;
DataManager.onLoad = function(object) { _DataManager_onLoad.call(this, object); if (object === window.$dataFactions) Rep.reloadDefinitions(); };
const _Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() { _Game_System_initialize.call(this); this._reputationValues = {}; };
PluginManager.registerCommand(pluginName, "addReputation", a => Rep.add(a.factionId, a.amount));
PluginManager.registerCommand(pluginName, "setReputation", a => Rep.set(a.factionId, a.value));
if (window.ConditionSystem) {
    ConditionSystem.register("reputation", condition => ({
        actual: condition.property === "tierRank"
            ? Rep.tierRank(condition.target)
            : condition.property === "tier"
                ? Rep.tierId(condition.target)
                : Rep.value(condition.target)
    }));
}
})();
