/*:
 * @target MZ
 * @plugindesc v1.3.0 Automatically wires character packages to map events and dialogue.
 * @author Steven Newton
 *
 * @param characterDataFile
 * @text Character Data File
 * @type string
 * @default Characters.json
 *
 * @param defaultCharacterId
 * @text Placeholder Character ID
 * @desc Character whose face sheet and map sprite stand in for any character that is not registered or has no art.
 * @type string
 * @default default_character
 *
 * @command setSpeaker
 * @text Set Speaker for Next Message
 * @arg characterId
 * @type string
 * @default ava
 * @arg expression
 * @type string
 * @default neutral
 *
 * @command clearSpeaker
 * @text Clear Pending Speaker
 *
 * @command setStage
 * @text Set Character Life Stage
 * @desc Switches a staged character (for example child, teen, adult) to another appearance and refreshes the map.
 * @arg characterId
 * @type string
 * @default ava
 * @arg stage
 * @type string
 * @default teen
 *
 * @help
 * Add <character:ava> to a map event's Note field to assign the walking
 * sprite registered for ava. Add <characterAutoSprite:false> to opt out.
 *
 * Set a speaker, then use an ordinary Show Text command. The next message
 * receives the registered name, face file, and expression index.
 *
 * Life stages: a character record may define "stages" (for example child, teen,
 * adult), each with its own sprite, battler, and face sheet. The current stage
 * is saved with the game. Use the Set Character Life Stage command (or
 * CharacterPresentation.setStage) to change it; tagged events, the player, and
 * party members update immediately. A character starts in its defaultStage.
 *
 * Actors: add <character:ava> to an Actor's Note to drive that actor's walking
 * sprite, face, and battler from the character's current stage. Add
 * <characterAutoActor:false> to opt out.
 *
 * Placeholder: a speaker or tagged event whose ID is not registered (or has
 * no walking sprite) borrows the placeholder character's face and sprite, so
 * dialogue can be written before art exists. The speaker keeps its own name.
 *
 * Script API:
 * CharacterPresentation.setSpeaker("ava", "happy")
 * CharacterPresentation.resolve("ava", "happy")
 * CharacterPresentation.definition("ava")      // current stage merged in
 * CharacterPresentation.setStage("ava", "teen")
 * CharacterPresentation.stageOf("ava")
 * CharacterPresentation.stages("ava")          // list of stage names
 */
(() => {
"use strict";
const pluginName = "CharacterPresentation";
const params = PluginManager.parameters(pluginName);
const dataFile = String(params.characterDataFile || "Characters.json");
const placeholderId = String(params.defaultCharacterId || "default_character");
const warned = new Set();
const warnOnce = message => { if (!warned.has(message)) { warned.add(message); console.warn(message); } };
const humanize = id => String(id).split("_").filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const definitions = new Map();
window.$dataCharacters = null;
DataManager._databaseFiles.push({ name: "$dataCharacters", src: dataFile });

const CP = window.CharacterPresentation = {
    version: "1.3.0",
    _pending: null,
    reloadDefinitions() {
        definitions.clear();
        const source = Array.isArray(window.$dataCharacters) ? window.$dataCharacters : [];
        for (const entry of source) {
            if (!entry?.id) continue;
            definitions.set(String(entry.id), {
                displayName: String(entry.id), defaultExpression: "neutral", expressions: {}, ...entry, id: String(entry.id)
            });
        }
    },
    raw(id) { return definitions.get(String(id)); },
    stages(id) { return Object.keys(this.raw(id)?.stages || {}); },
    stageOf(id) {
        const entry = this.raw(id);
        if (!entry?.stages) return null;
        const saved = window.$gameSystem?._characterStages?.[entry.id];
        return entry.stages[saved] ? saved : (entry.defaultStage in entry.stages ? entry.defaultStage : Object.keys(entry.stages)[0]);
    },
    setStage(id, stage) {
        const entry = this.raw(id);
        if (!entry?.stages) { console.warn(`CharacterPresentation: '${id}' has no life stages.`); return false; }
        if (!entry.stages[stage]) { console.warn(`CharacterPresentation: '${id}' has no stage '${stage}'.`); return false; }
        $gameSystem._characterStages = { ...($gameSystem._characterStages || {}), [entry.id]: String(stage) };
        this.refreshAppearance();
        return true;
    },
    /** The record with the current stage's art and expressions merged over the base fields. */
    definition(id) {
        const entry = this.raw(id);
        if (!entry?.stages) return entry;
        const { label, ...stage } = entry.stages[this.stageOf(id)] || {};
        return { ...entry, ...stage };
    },
    definitions() { return [...definitions.keys()].map(id => this.definition(id)); },
    /** Re-applies tagged-event sprites and the player's image after a stage change. */
    refreshAppearance() {
        if (window.$gameMap) {
            for (const event of $gameMap.events()) {
                if (!/<character(?:Id)?s*:/i.test(String(event.event()?.note || ""))) continue;
                event._pageIndex = event._erased ? -1 : event.findProperPageIndex();
                event.setupPage(); // immediate, so the event never lacks a valid page between frames
            }
            $gameMap.requestRefresh();
        }
        if (window.$gamePlayer) $gamePlayer.refresh();
    },
    boundCharacterId(actor) {
        const note = String($dataActors[actor.actorId()]?.note || "");
        if (/<characterAutoActors*:s*false>/i.test(note)) return null;
        return note.match(/<character(?:Id)?s*:s*([a-z][a-z0-9_]*)>/i)?.[1] || null;
    },
    placeholder() { return definitions.get(placeholderId) || null; },
    resolve(id, expression) {
        let character = this.definition(id);
        let usingPlaceholder = false;
        if (!character || !Object.keys(character.expressions || {}).length) {
            const stand = this.placeholder();
            if (!stand) { warnOnce(`CharacterPresentation: unknown character '${id}' and no placeholder '${placeholderId}'.`); return null; }
            warnOnce(`CharacterPresentation: '${id}' has no art; using placeholder '${placeholderId}'.`);
            character = { ...stand, id: String(id), displayName: character?.displayName || humanize(id) };
            usingPlaceholder = true;
        }
        const key = String(expression || character.defaultExpression || "neutral");
        const face = character.expressions?.[key] || character.expressions?.[character.defaultExpression];
        if (!face) { console.warn(`CharacterPresentation: '${id}' has no expression '${key}'.`); return null; }
        return { id: character.id, placeholder: usingPlaceholder, displayName: character.displayName, expression: key, faceName: String(face.faceName || ""), faceIndex: Number(face.faceIndex) || 0, portraitName: String(character.portraitName || "") };
    },
    setSpeaker(id, expression) { this._pending = this.resolve(id, expression); return this._pending; },
    clearSpeaker() { this._pending = null; },
    pendingSpeaker() { return this._pending; },
    consumeSpeaker() { const value = this._pending; this._pending = null; return value; }
};

const _DataManager_onLoad = DataManager.onLoad;
DataManager.onLoad = function(object) {
    _DataManager_onLoad.call(this, object);
    if (object === window.$dataCharacters) CP.reloadDefinitions();
};

PluginManager.registerCommand(pluginName, "setSpeaker", args => CP.setSpeaker(args.characterId, args.expression));
PluginManager.registerCommand(pluginName, "clearSpeaker", () => CP.clearSpeaker());
PluginManager.registerCommand(pluginName, "setStage", args => CP.setStage(args.characterId, args.stage));

// Actors tagged with <character:id> take their walking sprite, face, and battler from the character's current stage.
const withActorCharacter = (method, pick) => {
    const original = Game_Actor.prototype[method];
    Game_Actor.prototype[method] = function() {
        const id = CP.boundCharacterId(this);
        const value = id ? pick(CP.definition(id)) : undefined;
        return value === undefined || value === "" ? original.call(this) : value;
    };
};
const defaultFace = definition => definition?.expressions?.[definition.defaultExpression];
withActorCharacter("characterName", d => d?.mapSprite?.characterName);
withActorCharacter("characterIndex", d => d?.mapSprite?.characterName ? Number(d.mapSprite.characterIndex) || 0 : undefined);
withActorCharacter("faceName", d => defaultFace(d)?.faceName);
withActorCharacter("faceIndex", d => defaultFace(d) ? Number(defaultFace(d).faceIndex) || 0 : undefined);
withActorCharacter("battlerName", d => d?.battlerName);

const _Game_Event_setupPageSettings = Game_Event.prototype.setupPageSettings;
Game_Event.prototype.setupPageSettings = function() {
    _Game_Event_setupPageSettings.call(this);
    const event = this.event();
    const note = String(event?.note || "");
    if (/<characterAutoSprite\s*:\s*false>/i.test(note)) return;
    const match = note.match(/<character(?:Id)?\s*:\s*([a-z][a-z0-9_]*)>/i);
    if (!match) return;
    const character = CP.definition(match[1]);
    let sprite = character?.mapSprite;
    if (!sprite?.characterName) {
        sprite = CP.placeholder()?.mapSprite;
        if (!sprite?.characterName) { warnOnce(`CharacterPresentation: '${match[1]}' has no mapSprite and there is no placeholder.`); return; }
        warnOnce(`CharacterPresentation: '${match[1]}' has no mapSprite; using placeholder '${placeholderId}'.`);
    }
    this.setImage(String(sprite.characterName), Number(sprite.characterIndex) || 0);
};

const _Game_Interpreter_command101 = Game_Interpreter.prototype.command101;
Game_Interpreter.prototype.command101 = function(params) {
    const speaker = CP.consumeSpeaker();
    if (speaker) {
        params = params.slice();
        params[0] = speaker.faceName;
        params[1] = speaker.faceIndex;
        params[4] = speaker.displayName;
    }
    return _Game_Interpreter_command101.call(this, params);
};
})();
