/*:
 * @target MZ
 * @plugindesc v1.1.0 Named switch organization and condition adapter.
 * @author Steven Newton
 * @param worldStateDataFile
 * @text World State Data File
 * @type string
 * @default WorldStates.json
 *
 * @command setState
 * @text Set World State
 * @arg stateId
 * @type string
 * @default village_saved
 * @arg value
 * @type boolean
 * @default true
 *
 * @command toggleState
 * @text Toggle World State
 * @arg stateId
 * @type string
 * @default village_saved
 *
 * @help
 * This plugin does not replace switches. It maps stable IDs and metadata onto
 * ordinary RPG Maker switches. Script API: WorldState.get/set/toggle/all.
 */
(() => {
"use strict";
const pluginName = "WorldState";
const params = PluginManager.parameters(pluginName);
const dataFile = String(params.worldStateDataFile || "WorldStates.json");
const definitions = new Map();
window.$dataWorldStates = null;
DataManager._databaseFiles.push({ name: "$dataWorldStates", src: dataFile });

const WS = window.WorldState = {
    version: "1.1.0",
    reloadDefinitions() {
        definitions.clear();
        for (const entry of Array.isArray(window.$dataWorldStates) ? window.$dataWorldStates : []) {
            if (!entry?.id || !Number(entry.switchId)) continue;
            definitions.set(String(entry.id), { category: "General", description: "", ...entry, id: String(entry.id), switchId: Number(entry.switchId) });
        }
    },
    definition(id) { return definitions.get(String(id)); },
    definitions() { return [...definitions.values()]; },
    get(id) { const def = this.definition(id); if (!def) { console.warn(`WorldState: unknown state '${id}'.`); return false; } return $gameSwitches.value(def.switchId); },
    set(id, value = true) { const def = this.definition(id); if (!def) { console.warn(`WorldState: unknown state '${id}'.`); return false; } $gameSwitches.setValue(def.switchId, !!value); return !!value; },
    toggle(id) { return this.set(id, !this.get(id)); },
    all(category) { return this.definitions().filter(d => !category || d.category === category).map(d => ({ ...d, value: this.get(d.id) })); }
};

const _DataManager_onLoad = DataManager.onLoad;
DataManager.onLoad = function(object) { _DataManager_onLoad.call(this, object); if (object === window.$dataWorldStates) WS.reloadDefinitions(); };
PluginManager.registerCommand(pluginName, "setState", a => WS.set(a.stateId, a.value === "true"));
PluginManager.registerCommand(pluginName, "toggleState", a => WS.toggle(a.stateId));
if (window.ConditionSystem) ConditionSystem.register("worldState", condition => ({ actual: WS.get(condition.target) }));
})();
