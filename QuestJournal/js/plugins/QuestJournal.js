/*:
 * @target MZ
 * @plugindesc v1.3.0 Quest state, objectives, persistence, and condition adapter.
 * @author Steven Newton
 *
 * @param questDataFile
 * @text Quest Data File
 * @type string
 * @default Quests.json
 * @desc JSON file in the project's data folder.
 *
 * @command acceptQuest
 * @text Accept Quest
 * @arg questId
 * @type string
 * @default quest_id
 *
 * @command completeQuest
 * @text Complete Quest
 * @arg questId
 * @type string
 * @default quest_id
 *
 * @command failQuest
 * @text Fail Quest
 * @arg questId
 * @type string
 * @default quest_id
 *
 * @command setProgress
 * @text Set Objective Progress
 * @arg questId
 * @type string
 * @default quest_id
 * @arg objectiveIndex
 * @text Objective Number
 * @type number
 * @min 1
 * @default 1
 * @arg value
 * @type number
 * @min 0
 * @default 0
 *
 * @command completeObjective
 * @text Complete Objective
 * @arg questId
 * @type string
 * @default quest_id
 * @arg objectiveIndex
 * @text Objective Number
 * @type number
 * @min 1
 * @default 1
 *
 * @command revealObjective
 * @text Reveal Objective
 * @arg questId
 * @type string
 * @default quest_id
 * @arg objectiveIndex
 * @text Objective Number
 * @type number
 * @min 1
 * @default 1
 *
 * @help
 * Put quest definitions in data/Quests.json. See the component README.
 *
 * Script API:
 *   QuestJournal.register(definition)
 *   QuestJournal.accept(id)
 *   QuestJournal.complete(id)
 *   QuestJournal.fail(id)
 *   QuestJournal.setProgress(id, zeroBasedObjectiveIndex, value)
 *   QuestJournal.completeObjective(id, zeroBasedObjectiveIndex)
 *   QuestJournal.revealObjective(id, zeroBasedObjectiveIndex)
 *
 * Quest state persists in $gameSystem._questJournalStates.
 */
(() => {
"use strict";

const pluginName = "QuestJournal";
const parameters = PluginManager.parameters(pluginName);
const questDataFile = String(parameters.questDataFile || "Quests.json");
const defs = new Map();

window.$dataQuests = null;
DataManager._databaseFiles.push({ name: "$dataQuests", src: questDataFile });

const Q = window.QuestJournal = {
    version: "1.3.1",
    register(quest) {
        if (!quest || !quest.id) throw new Error("QuestJournal: every quest requires a unique id.");
        const normalized = {
            title: String(quest.id),
            description: "",
            objectives: [],
            reward: "None",
            ...quest,
            id: String(quest.id)
        };
        normalized.objectives = Array.isArray(normalized.objectives) ? normalized.objectives : [];
        defs.set(normalized.id, normalized);
        return normalized;
    },
    reloadDefinitions() {
        defs.clear();
        const source = Array.isArray(window.$dataQuests)
            ? window.$dataQuests
            : window.$dataQuests && Array.isArray(window.$dataQuests.quests)
                ? window.$dataQuests.quests
                : [];
        source.forEach(quest => this.register(quest));
    },
    definitions() { return [...defs.values()]; },
    definition(id) { return defs.get(String(id)); },
    state(id) {
        if (!$gameSystem) return { status: "hidden", progress: [] };
        $gameSystem._questJournalStates ||= {};
        const state = $gameSystem._questJournalStates[id] ||= { status: "hidden", progress: [] };
        state.progress ||= [];
        state.completedObjectives ||= [];
        state.revealedObjectives ||= [];
        return state;
    },
    accept(id) {
        const q = this.definition(id);
        if (!q) return console.warn(`QuestJournal: unknown quest '${id}'.`);
        if (q.acceptSwitchId) $gameSwitches.setValue(Number(q.acceptSwitchId), true);
        this.state(q.id).status = "active";
    },
    complete(id) {
        const q = this.definition(id);
        if (!q) return console.warn(`QuestJournal: unknown quest '${id}'.`);
        if (q.completeSwitchId) $gameSwitches.setValue(Number(q.completeSwitchId), true);
        if (q.failureSwitchId) $gameSwitches.setValue(Number(q.failureSwitchId), false);
        this.state(q.id).status = "completed";
    },
    fail(id) {
        const q = this.definition(id);
        if (!q) return console.warn(`QuestJournal: unknown quest '${id}'.`);
        if (q.failureSwitchId) $gameSwitches.setValue(Number(q.failureSwitchId), true);
        this.state(q.id).status = "failed";
    },
    setProgress(id, index, value) {
        if (!this.definition(id)) return console.warn(`QuestJournal: unknown quest '${id}'.`);
        this.state(String(id)).progress[index] = Math.max(0, Number(value) || 0);
    },
    completeObjective(id, index) {
        if (!this.definition(id)) return console.warn(`QuestJournal: unknown quest '${id}'.`);
        this.state(String(id)).completedObjectives[Math.max(0, Number(index) || 0)] = true;
    },
    revealObjective(id, index) {
        if (!this.definition(id)) return console.warn(`QuestJournal: unknown quest '${id}'.`);
        this.state(String(id)).revealedObjectives[Math.max(0, Number(index) || 0)] = true;
    },
    objectiveVisible(q, index) {
        const objective = q.objectives[index] || {};
        return !objective.hidden || !!this.state(q.id).revealedObjectives[index];
    },
    objectiveDone(q, index) {
        const objective = q.objectives[index] || {};
        const target = Number(objective.target) || 0;
        return this.status(q) === "completed" || !!this.state(q.id).completedObjectives[index] || (target > 0 && this.progress(q, index) >= target);
    },
    description(q) {
        const status = this.status(q);
        if (status === "completed" && q.completeDescription) return q.completeDescription;
        if (status === "failed" && q.failedDescription) return q.failedDescription;
        return q.activeDescription || q.description || "";
    },
    progress(q, index) {
        const objective = q.objectives[index] || {};
        return objective.variableId
            ? Number($gameVariables.value(Number(objective.variableId))) || 0
            : Number(this.state(q.id).progress[index]) || 0;
    },
    status(q) {
        if (q.failureSwitchId && $gameSwitches.value(Number(q.failureSwitchId))) return "failed";
        if (q.completeSwitchId && $gameSwitches.value(Number(q.completeSwitchId))) return "completed";
        if (q.acceptSwitchId && $gameSwitches.value(Number(q.acceptSwitchId))) return "active";
        return this.state(q.id).status;
    },
    statusOf(id) {
        const q = this.definition(id);
        return q ? this.status(q) : "unknown";
    },
    isObjectiveComplete(id, index) {
        const q = this.definition(id);
        return q ? this.objectiveDone(q, Math.max(0, Number(index) || 0)) : false;
    },
    visible(filter) {
        return this.definitions().filter(q => {
            const status = this.status(q);
            return status !== "hidden" && (filter === "all" || status === filter);
        });
    }
};

const _DataManager_onLoad = DataManager.onLoad;
DataManager.onLoad = function(object) {
    _DataManager_onLoad.call(this, object);
    if (object === window.$dataQuests) Q.reloadDefinitions();
};

const _Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() {
    _Game_System_initialize.call(this);
    this._questJournalStates = {};
};

function registerCommands(name) {
    PluginManager.registerCommand(name, "acceptQuest", args => Q.accept(String(args.questId)));
    PluginManager.registerCommand(name, "completeQuest", args => Q.complete(String(args.questId)));
    PluginManager.registerCommand(name, "failQuest", args => Q.fail(String(args.questId)));
    PluginManager.registerCommand(name, "setProgress", args => {
        Q.setProgress(String(args.questId), Math.max(0, Number(args.objectiveIndex) - 1), Number(args.value));
    });
    PluginManager.registerCommand(name, "completeObjective", args => {
        Q.completeObjective(String(args.questId), Math.max(0, Number(args.objectiveIndex) - 1));
    });
    PluginManager.registerCommand(name, "revealObjective", args => {
        Q.revealObjective(String(args.questId), Math.max(0, Number(args.objectiveIndex) - 1));
    });
}
registerCommands(pluginName);

if (window.ConditionSystem) {
    ConditionSystem.register("quest", condition => ({
        actual: condition.property === "objective"
            ? Q.isObjectiveComplete(condition.target, condition.index ?? condition.objectiveIndex ?? 0)
            : Q.statusOf(condition.target)
    }));
}

})();
