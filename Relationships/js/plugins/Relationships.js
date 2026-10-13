/*:
 * @target MZ
 * @plugindesc v1.2.0 Persistent affinity, relationship flags, tiers, and condition adapter.
 * @author Steven Newton
 * @param relationshipDataFile
 * @text Relationship Data File
 * @type string
 * @default Relationships.json
 *
 * @command addAffinity
 * @text Add Affinity
 * @arg characterId
 * @type string
 * @default alice
 * @arg amount
 * @type number
 * @min -9999
 * @default 10
 *
 * @command setAffinity
 * @text Set Affinity
 * @arg characterId
 * @type string
 * @default alice
 * @arg value
 * @type number
 * @min -9999
 * @default 0
 *
 * @command setFlag
 * @text Set Relationship Flag
 * @arg characterId
 * @type string
 * @default alice
 * @arg flagId
 * @type string
 * @default personal_quest_completed
 * @arg value
 * @type boolean
 * @default true
 *
 * @help
 * Script API: Relationships.affinity/add/set/meets/setFlag/hasFlag.
 */
(() => {
"use strict";
const pluginName = "Relationships";
const params = PluginManager.parameters(pluginName);
const dataFile = String(params.relationshipDataFile || "Relationships.json");
const definitions = new Map();
let defaultTiers = [];
const builtinDefaultTiers = [
    { id: "stranger", threshold: 0, displayName: "Stranger" },
    { id: "acquaintance", threshold: 20, displayName: "Acquaintance" },
    { id: "friend", threshold: 40, displayName: "Friend" },
    { id: "close", threshold: 60, displayName: "Close Friend" },
    { id: "trusted", threshold: 80, displayName: "Trusted Companion" },
    { id: "bonded", threshold: 100, displayName: "Unbreakable Bond" }
];
window.$dataRelationships = null;
DataManager._databaseFiles.push({ name: "$dataRelationships", src: dataFile });

const R = window.Relationships = {
    version: "1.2.0",
    reloadDefinitions() {
        definitions.clear();
        const data = window.$dataRelationships;
        const source = Array.isArray(data) ? data : Array.isArray(data?.characters) ? data.characters : [];
        defaultTiers = this.normalizeTiers(Array.isArray(data?.defaultTiers) && data.defaultTiers.length ? data.defaultTiers : builtinDefaultTiers);
        for (const entry of source) {
            if (!entry?.id) continue;
            definitions.set(String(entry.id), { displayName: String(entry.id), initialAffinity: 0, minAffinity: -100, maxAffinity: 100, ...entry, id: String(entry.id) });
        }
    },
    normalizeTiers(tiers) {
        return tiers.filter(t => t?.id != null && Number.isFinite(Number(t.threshold)))
            .map(t => ({ id: String(t.id), threshold: Number(t.threshold), displayName: String(t.displayName || t.id) }))
            .sort((a, b) => a.threshold - b.threshold);
    },
    tiers(id) {
        const def = this.definition(id) || {};
        if (def.staticTier) return [{ id: String(def.staticTier.id || "special"), threshold: Number.NEGATIVE_INFINITY, displayName: String(def.staticTier.displayName || def.staticTier.id || "Special") }];
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
    state(id) {
        $gameSystem._relationshipStates ||= {};
        const def = this.definition(id) || { initialAffinity: 0 };
        const state = $gameSystem._relationshipStates[id] ||= { affinity: Number(def.initialAffinity) || 0, flags: {} };
        state.flags ||= {};
        return state;
    },
    affinity(id) { return Number(this.state(String(id)).affinity) || 0; },
    set(id, value) {
        id = String(id); const def = this.definition(id) || { minAffinity: -9999, maxAffinity: 9999 };
        const min = Number.isFinite(Number(def.minAffinity)) ? Number(def.minAffinity) : -9999;
        const max = Number.isFinite(Number(def.maxAffinity)) ? Number(def.maxAffinity) : 9999;
        this.state(id).affinity = Math.max(min, Math.min(max, Number(value) || 0));
        return this.affinity(id);
    },
    add(id, amount) { return this.set(id, this.affinity(id) + (Number(amount) || 0)); },
    meets(id, threshold) { return this.affinity(id) >= Number(threshold); },
    tier(id) {
        const tiers = this.tiers(String(id));
        if (!tiers.length) return { id: "unranked", threshold: Number.NEGATIVE_INFINITY, displayName: "Unranked", rank: 0 };
        const value = this.affinity(String(id));
        let rank = 0;
        for (let i = 0; i < tiers.length; i++) if (value >= tiers[i].threshold) rank = i;
        return { ...tiers[rank], rank };
    },
    tierId(id) { return this.tier(id).id; },
    tierRank(id) { return this.tier(id).rank; },
    tierName(id) { return this.tier(id).displayName; },
    setFlag(id, flagId, value = true) { this.state(String(id)).flags[String(flagId)] = !!value; },
    hasFlag(id, flagId) { return !!this.state(String(id)).flags[String(flagId)]; },
    flags(id) { return { ...this.state(String(id)).flags }; }
};

const _DataManager_onLoad = DataManager.onLoad;
DataManager.onLoad = function(object) { _DataManager_onLoad.call(this, object); if (object === window.$dataRelationships) R.reloadDefinitions(); };
const _Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() { _Game_System_initialize.call(this); this._relationshipStates = {}; };

PluginManager.registerCommand(pluginName, "addAffinity", a => R.add(a.characterId, a.amount));
PluginManager.registerCommand(pluginName, "setAffinity", a => R.set(a.characterId, a.value));
PluginManager.registerCommand(pluginName, "setFlag", a => R.setFlag(a.characterId, a.flagId, a.value === "true"));
if (window.ConditionSystem) {
    ConditionSystem.register("relationship", condition => ({
        actual: condition.property === "flag"
            ? R.hasFlag(condition.target, condition.key ?? condition.flagId)
            : condition.property === "tierRank"
                ? R.tierRank(condition.target)
                : condition.property === "tier"
                    ? R.tierId(condition.target)
                    : R.affinity(condition.target)
    }));
}
})();
