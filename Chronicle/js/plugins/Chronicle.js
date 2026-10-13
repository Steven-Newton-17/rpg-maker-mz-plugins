/*:
 * @target MZ
 * @plugindesc v1.1.0 Core discovery, knowledge, persistence, commands, and social queries.
 * @author Steven Newton
 * @param chronicleDataFile
 * @text Chronicle Data File
 * @type string
 * @default Chronicle.json
 *
 * @command discoverEntry
 * @text Discover Entry
 * @arg entryId
 * @type string
 * @default alice
 * @command hideEntry
 * @text Hide Entry
 * @arg entryId
 * @type string
 * @default alice
 * @command setStage
 * @text Set Knowledge Stage
 * @arg entryId
 * @type string
 * @default demon_king
 * @arg stageId
 * @type string
 * @default revealed
 * @command revealSection
 * @text Reveal History/Knowledge Section
 * @arg entryId
 * @type string
 * @default alice
 * @arg sectionId
 * @type string
 * @default first_meeting
 * @help
 * Chronicle owns discovery and presented knowledge only. Relationship and
 * reputation values remain owned by their respective plugins.
 */
(() => {
"use strict";
const pluginName = "Chronicle";
const params = PluginManager.parameters(pluginName);
const dataFile = String(params.chronicleDataFile || "Chronicle.json");
const definitions = new Map();
const typeOrder = ["people", "factions", "lore"];
window.$dataChronicle = null;
DataManager._databaseFiles.push({ name: "$dataChronicle", src: dataFile });

const C = window.Chronicle = {
    version: "1.1.0",
    reloadDefinitions() {
        definitions.clear();
        const source = Array.isArray(window.$dataChronicle) ? window.$dataChronicle : window.$dataChronicle?.entries;
        for (const entry of Array.isArray(source) ? source : []) {
            if (!entry?.id || !typeOrder.includes(entry.type)) continue;
            definitions.set(String(entry.id), { displayName: String(entry.id), title: "", description: "", sections: [], stages: [], ...entry, id: String(entry.id) });
        }
    },
    definition(id) { return definitions.get(String(id)); },
    definitions() { return [...definitions.values()]; },
    states() { $gameSystem._chronicleStates ||= {}; return $gameSystem._chronicleStates; },
    state(id) {
        id = String(id); const def = this.definition(id) || {};
        const state = this.states()[id] ||= { discovered: !!def.discoveredByDefault, stage: def.initialStage || "", sections: {}, overrides: {} };
        state.sections ||= {}; state.overrides ||= {};
        return state;
    },
    discover(id) { if (!this.definition(id)) return false; this.state(id).discovered = true; return true; },
    hide(id) { if (!this.definition(id)) return false; this.state(id).discovered = false; return true; },
    isDiscovered(id) { return !!this.state(id).discovered; },
    setStage(id, stageId) { const def = this.definition(id); if (!def || !def.stages.some(s => s.id === stageId)) return false; this.state(id).stage = String(stageId); return true; },
    stage(id) { const def = this.definition(id); const state = this.state(id); return def?.stages.find(s => s.id === state.stage) || null; },
    update(id, fields) { if (!this.definition(id)) return false; Object.assign(this.state(id).overrides, fields || {}); return true; },
    revealSection(id, sectionId) { if (!this.definition(id)) return false; this.state(id).sections[String(sectionId)] = true; return true; },
    hideSection(id, sectionId) { if (!this.definition(id)) return false; this.state(id).sections[String(sectionId)] = false; return true; },
    sectionVisible(id, section) { return Object.prototype.hasOwnProperty.call(this.state(id).sections, section.id) ? !!this.state(id).sections[section.id] : !!section.discoveredByDefault; },
    current(id) {
        const def = this.definition(id); if (!def) return null;
        const stage = this.stage(id) || {};
        return { ...def, ...stage, ...this.state(id).overrides, id: def.id, type: def.type, sections: def.sections };
    },
    visible(type) { return this.definitions().filter(e => e.type === type && this.isDiscovered(e.id)); },
    socialLabel(entry) {
        if (entry.relationshipId && window.Relationships) return Relationships.tierName(entry.relationshipId);
        if (entry.reputationId && window.Reputation) return Reputation.tierName(entry.reputationId);
        return "";
    }
};

const _DataManager_onLoad = DataManager.onLoad;
DataManager.onLoad = function(object) { _DataManager_onLoad.call(this, object); if (object === window.$dataChronicle) C.reloadDefinitions(); };
const _Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() { _Game_System_initialize.call(this); this._chronicleStates = {}; };
PluginManager.registerCommand(pluginName, "discoverEntry", a => C.discover(a.entryId));
PluginManager.registerCommand(pluginName, "hideEntry", a => C.hide(a.entryId));
PluginManager.registerCommand(pluginName, "setStage", a => C.setStage(a.entryId, a.stageId));
PluginManager.registerCommand(pluginName, "revealSection", a => C.revealSection(a.entryId, a.sectionId));

})();

