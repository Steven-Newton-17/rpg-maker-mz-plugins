/*:
 * @target MZ
 * @plugindesc v1.0.0 Generic, read-only condition evaluation with nested logic and diagnostics.
 * @author Steven Newton
 *
 * @param debugByDefault
 * @text Debug Logging by Default
 * @type boolean
 * @default false
 *
 * @command setDebug
 * @text Set Debug Logging
 * @arg enabled
 * @type boolean
 * @default true
 *
 * @help
 * ConditionSystem evaluates JSON-compatible conditions without changing game
 * state. Other plugins can register resolvers through the public API.
 *
 * Examples:
 *   ConditionSystem.check({type:"gold",operator:">=",value:1000})
 *   ConditionSystem.evaluate({all:[conditionA, conditionB]})
 */
(() => {
"use strict";
const pluginName = "ConditionSystem";
const params = PluginManager.parameters(pluginName);
const resolvers = new Map();
let debugEnabled = params.debugByDefault === "true";
const supportedOperators = new Set(["==", "!=", ">", ">=", "<", "<=", "contains", "notContains", "in", "notIn", "exists", "notExists"]);

const CS = window.ConditionSystem = {
    version: "1.0.0",
    register(type, resolver) {
        if (!type || typeof resolver !== "function") return false;
        resolvers.set(String(type), resolver);
        return true;
    },
    unregister(type) { return resolvers.delete(String(type)); },
    hasResolver(type) { return resolvers.has(String(type)); },
    getRegisteredTypes() { return [...resolvers.keys()].sort(); },
    setDebug(enabled) { debugEnabled = !!enabled; },
    isDebug() { return debugEnabled; },
    compare(actual, operator = "==", expected) {
        switch (operator) {
            case "==": return actual === expected;
            case "!=": return actual !== expected;
            case ">": return actual > expected;
            case ">=": return actual >= expected;
            case "<": return actual < expected;
            case "<=": return actual <= expected;
            case "contains":
                if (typeof actual === "string" || Array.isArray(actual)) return actual.includes(expected);
                if (actual instanceof Set || actual instanceof Map) return actual.has(expected);
                if (actual && typeof actual === "object") return Object.prototype.hasOwnProperty.call(actual, expected);
                return false;
            case "notContains": return !this.compare(actual, "contains", expected);
            case "in":
                if (typeof expected === "string" || Array.isArray(expected)) return expected.includes(actual);
                if (expected instanceof Set || expected instanceof Map) return expected.has(actual);
                return false;
            case "notIn": return !this.compare(actual, "in", expected);
            case "exists": return actual !== undefined && actual !== null;
            case "notExists": return actual === undefined || actual === null;
            default: return false;
        }
    },
    evaluate(condition) {
        if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
            return this._error("MALFORMED_CONDITION", "Condition must be an object.", condition);
        }
        if (Object.prototype.hasOwnProperty.call(condition, "all")) return this._logical("all", condition.all);
        if (Object.prototype.hasOwnProperty.call(condition, "any")) return this._logical("any", condition.any);
        if (Object.prototype.hasOwnProperty.call(condition, "not")) {
            const child = this.evaluate(condition.not);
            const result = { passed: !child.passed, logic: "not", children: [child] };
            this._debug(result, condition);
            return result;
        }
        if (!condition.type) return this._error("MALFORMED_CONDITION", "Condition has no type.", condition);
        const type = String(condition.type);
        const resolver = resolvers.get(type);
        if (!resolver) return this._error("UNKNOWN_CONDITION_TYPE", `Unknown condition type: ${type}`, condition);
        const operator = condition.operator || "==";
        if (!supportedOperators.has(operator)) return this._error("UNSUPPORTED_OPERATOR", `Unsupported operator: ${operator}`, condition, { type, operator });
        const base = { type, target: condition.target, property: condition.property, operator, expected: condition.value };
        try {
            const raw = resolver(condition, this);
            let normalized;
            if (typeof raw === "boolean") normalized = { passed: raw };
            else if (raw && typeof raw === "object") normalized = { ...raw };
            else normalized = { actual: raw };
            if (normalized.error) normalized.passed = false;
            else if (typeof normalized.passed !== "boolean") normalized.passed = this.compare(normalized.actual, operator, condition.value);
            const result = { ...base, ...normalized, passed: !!normalized.passed };
            this._debug(result, condition);
            return result;
        } catch (error) {
            return this._error("RESOLVER_ERROR", error?.message || String(error), condition, { type });
        }
    },
    check(condition) { return this.evaluate(condition).passed; },
    evaluateAll(conditions) { return this._logical("all", conditions); },
    evaluateAny(conditions) { return this._logical("any", conditions); },
    describe(condition) {
        const result = this.evaluate(condition);
        if (result.logic) return `${result.logic.toUpperCase()}: ${result.passed ? "PASS" : "FAIL"}`;
        if (result.error) return `${result.errorCode}: ${result.message}`;
        return `${result.type}${result.target !== undefined ? `(${result.target})` : ""}: ${String(result.actual)} ${result.operator} ${String(result.expected)} -> ${result.passed ? "PASS" : "FAIL"}`;
    },
    _logical(logic, conditions) {
        if (!Array.isArray(conditions)) return this._error("MALFORMED_LOGIC_GROUP", `${logic} must contain an array.`, conditions);
        const children = conditions.map(condition => this.evaluate(condition));
        const passed = logic === "all" ? children.every(child => child.passed) : children.some(child => child.passed);
        const result = { passed, logic, children };
        this._debug(result, { [logic]: conditions });
        return result;
    },
    _error(errorCode, message, condition, extra = {}) {
        const result = { passed: false, error: true, errorCode, message, condition, ...extra };
        if (debugEnabled) console.warn(`[ConditionSystem] ${message}`, condition);
        return result;
    },
    _debug(result, condition) {
        if (!debugEnabled) return;
        console.groupCollapsed(`[ConditionSystem] ${result.passed ? "PASS" : "FAIL"} ${result.logic || result.type || "condition"}`);
        console.log("Condition:", condition);
        console.log("Result:", result);
        console.groupEnd();
    }
};

PluginManager.registerCommand(pluginName, "setDebug", args => CS.setDebug(args.enabled === "true"));

const requireTarget = c => c.target !== undefined && c.target !== null && c.target !== "";
CS.register("switch", c => requireTarget(c) ? ({ actual: $gameSwitches.value(Number(c.target)) }) : ({ error: true, errorCode: "MISSING_TARGET", message: "Switch condition requires a target." }));
CS.register("variable", c => requireTarget(c) ? ({ actual: $gameVariables.value(Number(c.target)) }) : ({ error: true, errorCode: "MISSING_TARGET", message: "Variable condition requires a target." }));
for (const [type, databaseName] of [["item", "$dataItems"], ["weapon", "$dataWeapons"], ["armor", "$dataArmors"]]) {
    CS.register(type, c => {
        if (!requireTarget(c)) return { error: true, errorCode: "MISSING_TARGET", message: `${type} condition requires a target.` };
        const database = window[databaseName];
        const entry = database?.[Number(c.target)];
        const count = entry ? $gameParty.numItems(entry) : 0;
        return { actual: c.property === "exists" ? count > 0 : count, itemId: Number(c.target) };
    });
}
CS.register("gold", () => ({ actual: $gameParty.gold() }));
CS.register("partyMember", c => requireTarget(c) ? ({ actual: $gameParty.members().some(actor => actor.actorId() === Number(c.target)) }) : ({ error: true, errorCode: "MISSING_TARGET", message: "partyMember requires an actor target." }));
CS.register("actorLevel", c => requireTarget(c) ? ({ actual: $gameActors.actor(Number(c.target))?.level ?? null }) : ({ error: true, errorCode: "MISSING_TARGET", message: "actorLevel requires an actor target." }));
CS.register("actorClass", c => requireTarget(c) ? ({ actual: $gameActors.actor(Number(c.target))?._classId ?? null }) : ({ error: true, errorCode: "MISSING_TARGET", message: "actorClass requires an actor target." }));
CS.register("actorSkill", c => {
    if (!requireTarget(c)) return { error: true, errorCode: "MISSING_TARGET", message: "actorSkill requires an actor target." };
    const actor = $gameActors.actor(Number(c.target));
    const skillId = Number(c.property ?? c.skillId);
    return { actual: !!actor?.isLearnedSkill(skillId), skillId };
});
CS.register("actorState", c => {
    if (!requireTarget(c)) return { error: true, errorCode: "MISSING_TARGET", message: "actorState requires an actor target." };
    const actor = $gameActors.actor(Number(c.target));
    const stateId = Number(c.property ?? c.stateId);
    return { actual: !!actor?.isStateAffected(stateId), stateId };
});
})();
