/*:
 * @target MZ
 * @plugindesc v1.6.1 Data-driven branching dialogue using ConditionSystem and standard MZ message UI.
 * @author Steven Newton
 *
 * @param dialogueDataFile
 * @text Dialogue Data File
 * @type string
 * @default Dialogues.json
 *
 * @command startDialogue
 * @text Start Dialogue
 * @arg dialogueId
 * @type string
 * @default test_guard
 * @arg nodeId
 * @text Optional Start Node
 * @type string
 * @default
 *
 * @help
 * Requires ConditionSystem. CharacterPresentation is optional but preferred.
 * Script: DialogueSystem.start("test_guard")
 *
 * Stage directions (1.5): a node may have "steps", played in order before its line. A node with steps
 * and no text is pure staging (no empty message box). Who: "player", "character:<id>", "thing:<id>",
 * "event:<n>". Where ("to"): a who string, or { at: who, dx, dy }, or { x, y }.
 *   move     { who, to, speed?, face?, wait? }   walks there (path-finding; snaps if blocked)
 *   locate   { who, to, face? }                  places instantly
 *   face     { who, direction: up|down|left|right } or { who, toward: who }
 *   wait     { seconds } or { frames }
 *   balloon  { who, balloon: ! ? music heart anger sweat frustration silence idea zzz, wait? }
 *   jump     { who, dx?, dy?, wait? }
 *   pose     { who, pose: fallen|normal, keep? }  fallen lies sideways; reset when the dialogue ends unless keep
 *   visible  { who, value: true|false }
 *   camera   { to, speed? }                      pans to a place; to "player" pans back
 *   fade     { mode: out|in, seconds? }  tint { tint: normal|dusk|night|smoke|fire, seconds? }  shake { power?, seconds? }
 *   sound    { name, volume? }
 * Steps that take time wait for themselves unless "wait": false. The player cannot move while a dialogue runs.
 *
 * Memory (1.6): every node Ava hears is remembered in the save. Condition type "dialogue":
 *   { type: "dialogue", target: "<dialogue id>", node?: "<node id>", operator: "==", value: true }  heard it (that line)
 * Choices built from what happened: give choices conditions; node.choiceLimit N shows at most N of the
 * conditional choices that pass (in authored order). Choices without conditions are always shown.
 */
(() => {
"use strict";
const pluginName = "DialogueSystem";
const params = PluginManager.parameters(pluginName);
const dataFile = String(params.dialogueDataFile || "Dialogues.json");
const dialogues = new Map();
const effects = new Map();
const hooks = new Map();
let session = null;
window.$dataDialogues = null;
DataManager._databaseFiles.push({ name: "$dataDialogues", src: dataFile });

const DS = window.DialogueSystem = {
    version: "1.6.0",
    registerDialogue(dialogue) {
        if (!dialogue?.id || !dialogue?.nodes) return false;
        dialogues.set(String(dialogue.id), { start: "start", ...dialogue, id: String(dialogue.id) });
        return true;
    },
    unregisterDialogue(id) { return dialogues.delete(String(id)); },
    dialogue(id) { return dialogues.get(String(id)); },
    dialogues() { return [...dialogues.values()]; },
    reloadDefinitions() {
        dialogues.clear();
        for (const dialogue of Array.isArray(window.$dataDialogues) ? window.$dataDialogues : []) this.registerDialogue(dialogue);
    },
    registerEffect(type, handler) {
        if (!type || typeof handler !== "function") return false;
        effects.set(String(type), handler); return true;
    },
    unregisterEffect(type) { return effects.delete(String(type)); },
    getRegisteredEffectTypes() { return [...effects.keys()].sort(); },
    on(eventName, callback) {
        if (typeof callback !== "function") return false;
        const set = hooks.get(String(eventName)) || new Set(); set.add(callback); hooks.set(String(eventName), set); return true;
    },
    off(eventName, callback) { return hooks.get(String(eventName))?.delete(callback) || false; },
    emit(eventName, payload) {
        for (const callback of hooks.get(String(eventName)) || []) {
            try { callback(payload); } catch (error) { console.error(`[DialogueSystem] Hook '${eventName}' failed.`, error); }
        }
    },
    start(dialogueId, nodeId) {
        if (session) this.end("replaced");
        const dialogue = this.dialogue(dialogueId);
        if (!dialogue) { console.warn(`[DialogueSystem] Unknown dialogue: ${dialogueId}`); return false; }
        session = { dialogue, dialogueId: dialogue.id, nodeId: String(nodeId || dialogue.start), phase: "ready", node: null, choices: [], pendingNext: null };
        this.emit("dialogueStart", { dialogueId: dialogue.id, nodeId: session.nodeId });
        return true;
    },
    end(reason = "completed") {
        if (!session) return;
        const payload = { dialogueId: session.dialogueId, nodeId: session.nodeId, reason };
        const ended = session;
        session = null;
        Stage.finish(ended);
        this.emit("dialogueEnd", payload);
    },
    isRunning() { return !!session; },
    /** Heard lines: { dialogueId: { nodeId: true } }, saved with the game. */
    heardLog() { return ($gameSystem._dialogueHeard ||= {}); },
    remember(dialogueId, nodeId) { (this.heardLog()[dialogueId] ||= {})[nodeId] = true; },
    heard(dialogueId, nodeId) { const log = window.$gameSystem ? this.heardLog()[String(dialogueId)] : null; return !!log && (nodeId ? !!log[String(nodeId)] : true); },
    currentSession() { return session; },
    choiceEnabled(index) { return session?.phase === "choice" ? !!session.choices[index]?.enabled : true; },
    evaluateChoices(node) {
        const result = [];
        const limit = Number(node.choiceLimit) || 0;
        let conditional = 0;
        for (const choice of Array.isArray(node.choices) ? node.choices : []) {
            const evaluation = choice.conditions ? ConditionSystem.evaluate(choice.conditions) : { passed: true };
            if (!evaluation.passed && (choice.unavailableMode || "hidden") === "hidden") continue;
            if (limit && choice.conditions && evaluation.passed && ++conditional > limit) continue;
            const enabled = evaluation.passed;
            const label = !enabled && choice.requirementLabel ? `[${choice.requirementLabel}] ` : "";
            result.push({ definition: choice, enabled, evaluation, displayText: `${label}${choice.text || "..."}` });
        }
        return result;
    },
    applyEffects(list, context = {}) {
        for (const effect of Array.isArray(list) ? list : []) {
            const handler = effects.get(String(effect?.type));
            if (!handler) { console.warn(`[DialogueSystem] Unknown effect type: ${effect?.type}`); continue; }
            try { handler(effect, context); } catch (error) { console.error(`[DialogueSystem] Effect '${effect.type}' failed.`, error); }
        }
    },
    update() {
        if (!session || $gameMessage.isBusy()) return;
        if (session.phase === "staging") { if (session.stage.update()) this._present(session.node); }
        else if (session.phase === "ready") this._enterNode(session.nodeId);
        else if (session.phase === "waiting") this._transition(session.pendingNext);
        else if (session.phase === "message") this._transition(session.pendingNext);
    },
    _enterNode(nodeId, visited = new Set()) {
        if (!session) return;
        if (!nodeId) return this.end("no-next-node");
        if (visited.has(nodeId)) return this.end("fallback-loop");
        visited.add(nodeId);
        const node = session.dialogue.nodes?.[nodeId];
        if (!node) { console.warn(`[DialogueSystem] Missing node '${nodeId}' in '${session.dialogueId}'.`); return this.end("missing-node"); }
        if (node.conditions && !ConditionSystem.check(node.conditions)) {
            if (node.fallback) return this._enterNode(String(node.fallback), visited);
            return this.end("node-condition-failed");
        }
        session.nodeId = String(nodeId); session.node = node;
        this.remember(session.dialogueId, session.nodeId);
        this.emit("nodeEnter", { dialogueId: session.dialogueId, nodeId: session.nodeId, node });
        this.applyEffects(node.effects, { dialogueId: session.dialogueId, nodeId: session.nodeId, source: "node" });
        if (Array.isArray(node.steps) && node.steps.length) { session.phase = "staging"; session.stage = Stage.begin(node.steps, session); return; }
        this._present(node);
    },
    _present(node) {
        session.stage = null;
        this._prepareMessage(node);
        session.choices = this.evaluateChoices(node);
        if (session.choices.length) {
            session.phase = "choice";
            const defaultIndex = Math.max(0, session.choices.findIndex(choice => choice.enabled));
            $gameMessage.setChoices(session.choices.map(choice => choice.displayText), defaultIndex, -1);
            $gameMessage.setChoiceCallback(index => this._selectChoice(index));
        } else {
            session.phase = "message";
            session.pendingNext = node.end ? null : node.next;
        }
    },
    _prepareMessage(node) {
        let speaker = null;
        if (node.speaker && window.CharacterPresentation) speaker = CharacterPresentation.resolve(node.speaker, node.expression || node.portrait);
        $gameMessage.setSpeakerName(String(node.displayName ?? speaker?.displayName ?? ""));
        $gameMessage.setFaceImage(String(node.faceName ?? speaker?.faceName ?? ""), Number(node.faceIndex ?? speaker?.faceIndex ?? 0));
        const lines = (Array.isArray(node.text) ? node.text : [node.text ?? ""]).map(String);
        if (!lines.some(line => line.trim()) && !(Array.isArray(node.choices) && node.choices.length)) return;
        for (const line of lines) $gameMessage.add(line);
    },
    _selectChoice(index) {
        if (!session) return;
        const selected = session.choices[index];
        if (!selected?.enabled) return;
        const choice = selected.definition;
        this.emit("choiceSelected", { dialogueId: session.dialogueId, nodeId: session.nodeId, choiceId: choice.id, choice, evaluation: selected.evaluation });
        this.applyEffects(choice.effects, { dialogueId: session.dialogueId, nodeId: session.nodeId, choiceId: choice.id, source: "choice" });
        this.emit("nodeExit", { dialogueId: session.dialogueId, nodeId: session.nodeId, node: session.node });
        session.pendingNext = choice.end ? null : (choice.next ?? session.node.next);
        session.phase = "waiting";
    },
    _transition(nextNode) {
        if (!session) return;
        if (session.node && session.phase !== "waiting") this.emit("nodeExit", { dialogueId: session.dialogueId, nodeId: session.nodeId, node: session.node });
        if (!nextNode) this.end("completed");
        else { session.phase = "ready"; session.pendingNext = null; session.node = null; session.nodeId = String(nextNode); }
    }
};

/* ---------- stage directions ---------- */
const TINTS = { normal: [0, 0, 0, 0], dusk: [68, -34, -34, 0], night: [-68, -68, 0, 68], smoke: [-34, -51, -68, 68], fire: [85, -17, -51, 17] };
const DIRECTIONS = { down: 2, left: 4, right: 6, up: 8, 2: 2, 4: 4, 6: 6, 8: 8 };
const BALLOONS = { "!": 1, exclamation: 1, "?": 2, question: 2, music: 3, heart: 4, anger: 5, sweat: 6, frustration: 7, silence: 8, idea: 9, zzz: 10 };
const tagMatch = (event, kind, id) => new RegExp("<" + (kind === "thing" ? "thing" : "character(?:Id)?") + "\\s*:\\s*" + id + ">", "i").test(String(event.event()?.note || ""));
const Stage = {
    /** The map character a step names, or null. */
    actor(who) {
        if (!who || who === "player") return $gamePlayer;
        const [kind, id] = String(who).split(":");
        if (kind === "event") return $gameMap.event(Number(id)) || null;
        if (!id) return null;
        if (kind === "follower") return $gamePlayer.followers().data().find(f => f.actor()?.actorId() === Number(id)) || null;
        const all = $gameMap.events().filter(event => tagMatch(event, kind, id));
        return all.find(event => event._pageIndex >= 0) || all[0] || null;
    },
    /** A map tile from a "to" value. */
    point(to) {
        if (to && typeof to === "object" && !Array.isArray(to)) {
            if (to.at) { const base = this.actor(to.at); return base ? { x: base.x + (Number(to.dx) || 0), y: base.y + (Number(to.dy) || 0) } : null; }
            if (Number.isFinite(Number(to.x)) && Number.isFinite(Number(to.y))) return { x: Number(to.x), y: Number(to.y) };
            return null;
        }
        const base = this.actor(to);
        return base ? { x: base.x, y: base.y } : null;
    },
    begin(steps, owner) { owner.actors = owner.actors || new Set(); return { steps, index: 0, current: null, owner, update() { return Stage.run(this); } }; },
    /** Advances the steps; returns true when all are done. */
    run(stage) {
        for (let guard = 0; guard < 64; guard++) {
            if (stage.current) { if (!stage.current()) return false; stage.current = null; }
            if (stage.index >= stage.steps.length) return true;
            const step = stage.steps[stage.index++] || {};
            let until = null;
            try { until = this.start(step, stage.owner); } catch (error) { console.error("[DialogueSystem] Step failed.", step, error); }
            if (until && step.wait !== false) stage.current = until;
        }
        return false;
    },
    /** Starts one step; returns a function that is true once the step has finished, or null when it is instant. */
    start(step, owner) {
        const frames = seconds => Math.max(1, Math.round((Number(seconds) || 1) * 60));
        const who = step.who ? this.actor(step.who) : $gamePlayer;
        if (["move", "locate", "face", "balloon", "jump", "pose", "visible"].includes(step.type)) {
            if (!who) { console.warn("[DialogueSystem] Step '" + step.type + "': nobody called '" + step.who + "' on this map."); return null; }
            if (who !== $gamePlayer) owner.actors.add(who);
        }
        const faceAfter = () => { if (step.face) this.face(who, step.face); };
        switch (step.type) {
            case "wait": { let left = step.frames != null ? Number(step.frames) : frames(step.seconds); return () => --left <= 0; }
            case "locate": { const p = this.point(step.to); if (p) who.locate(p.x, p.y); faceAfter(); return null; }
            case "face": { this.face(who, step.toward ? { toward: step.toward } : step.direction); return null; }
            case "move": {
                const p = this.point(step.to);
                if (!p) { console.warn("[DialogueSystem] Step 'move': unknown place.", step.to); return null; }
                const speed = who.moveSpeed(), originalThrough = who.isThrough();
                if (step.through && who !== $gamePlayer) { who._stageThroughOriginal = originalThrough; who.setThrough(true); }
                if (step.speed) who.setMoveSpeed(Number(step.speed));
                let stuck = 0, total = 0;
                return () => {
                    if (who.isMoving()) return false;
                    const done = () => { who.setMoveSpeed(speed); if (step.through && who !== $gamePlayer) { who.setThrough(originalThrough); delete who._stageThroughOriginal; } faceAfter(); return true; };
                    if (who.x === p.x && who.y === p.y) return done();
                    if (++total > 600 || stuck > 20) { who.locate(p.x, p.y); return done(); }
                    const direction = who.findDirectionTo(p.x, p.y);
                    if (direction > 0) { who.moveStraight(direction); if (!who.isMovementSucceeded()) stuck++; } else stuck++;
                    return false;
                };
            }
            case "balloon": { $gameTemp.requestBalloon(who, BALLOONS[step.balloon] || Number(step.balloon) || 1); return () => !who.isBalloonPlaying(); }
            case "jump": { who.jump(Number(step.dx) || 0, Number(step.dy) || 0); return () => !who.isJumping(); }
            case "pose": { who._dialoguePose = step.pose === "normal" ? null : step.pose; who._dialoguePoseKeep = !!step.keep; return null; }
            case "visible": { who.setTransparent(step.value === false); return null; }
            case "camera": {
                const p = step.to === "player" || !step.to ? { x: $gamePlayer.x, y: $gamePlayer.y } : this.point(step.to);
                if (!p) return null;
                const speed = Number(step.speed) || 4;
                const dx = p.x - $gameMap.screenTileX() / 2 + 0.5 - $gameMap.displayX(), dy = p.y - $gameMap.screenTileY() / 2 + 0.5 - $gameMap.displayY();
                const queue = [];
                if (Math.abs(dx) >= 0.5) queue.push([dx > 0 ? 6 : 4, Math.abs(dx)]);
                if (Math.abs(dy) >= 0.5) queue.push([dy > 0 ? 2 : 8, Math.abs(dy)]);
                return () => {
                    if ($gameMap.isScrolling()) return false;
                    const next = queue.shift(); if (!next) return true;
                    $gameMap.startScroll(next[0], next[1], speed); return false;
                };
            }
            case "fade": { const n = frames(step.seconds ?? 0.5); if (step.mode === "in") $gameScreen.startFadeIn(n); else $gameScreen.startFadeOut(n); let left = n; return () => --left <= 0; }
            case "tint": { const n = frames(step.seconds ?? 1); $gameScreen.startTint(TINTS[step.tint] || TINTS.normal, n); let left = n; return () => --left <= 0; }
            case "shake": { const n = frames(step.seconds ?? 0.5); $gameScreen.startShake(Number(step.power) || 5, 5, n); let left = n; return () => --left <= 0; }
            case "sound": { if (step.name) AudioManager.playSe({ name: String(step.name), volume: Number(step.volume ?? 90), pitch: 100, pan: 0 }); return null; }
            default: console.warn("[DialogueSystem] Unknown step type: " + step.type); return null;
        }
    },
    face(who, how) {
        if (!who || !how) return;
        if (typeof how === "object" && how.toward) { const other = this.actor(how.toward); if (other) who.turnTowardCharacter(other); return; }
        const direction = DIRECTIONS[how]; if (direction) who.setDirection(direction);
    },
    /** When a dialogue ends: actors may move on their own again, and temporary poses end. */
    finish(owner) {
        for (const actor of owner?.actors || []) { if (actor._stageThroughOriginal != null) { actor.setThrough(actor._stageThroughOriginal); delete actor._stageThroughOriginal; } if (!actor._dialoguePoseKeep) actor._dialoguePose = null; }
        if ($gamePlayer && !$gamePlayer._dialoguePoseKeep) $gamePlayer._dialoguePose = null;
    },
    acting(character) { return !!session?.actors?.has(character); }
};
DS.Stage = Stage;

// While a dialogue runs the player stays put, and its actors don't wander off.
const _Game_Player_canMove = Game_Player.prototype.canMove;
Game_Player.prototype.canMove = function() { return !DS.isRunning() && _Game_Player_canMove.call(this); };
const _Game_Event_updateSelfMovement = Game_Event.prototype.updateSelfMovement;
Game_Event.prototype.updateSelfMovement = function() { if (!Stage.acting(this)) _Game_Event_updateSelfMovement.call(this); };
const _Sprite_Character_updateOther = Sprite_Character.prototype.updateOther;
Sprite_Character.prototype.updateOther = function() {
    _Sprite_Character_updateOther.call(this);
    if (this._character?._dialoguePose === "fallen") this.rotation = Math.PI / 2;
    else if (this._dialoguePoseShown) this.rotation = 0;
    this._dialoguePoseShown = this._character?._dialoguePose === "fallen";
};

if (window.ConditionSystem?.register) ConditionSystem.register("dialogue", condition => ({ actual: DS.heard(condition.target, condition.node) }));

const _DataManager_onLoad = DataManager.onLoad;
DataManager.onLoad = function(object) { _DataManager_onLoad.call(this, object); if (object === window.$dataDialogues) DS.reloadDefinitions(); };

PluginManager.registerCommand(pluginName, "startDialogue", function(args) {
    if (DS.start(args.dialogueId, args.nodeId || undefined)) this.setWaitMode("dialogueSystem");
});
const _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
Game_Interpreter.prototype.updateWaitMode = function() {
    if (this._waitMode === "dialogueSystem") {
        if (DS.isRunning()) return true;
        this._waitMode = ""; return false;
    }
    return _Game_Interpreter_updateWaitMode.call(this);
};
const _Scene_Base_update = Scene_Base.prototype.update;
Scene_Base.prototype.update = function() { _Scene_Base_update.call(this); DS.update(); };
const _Window_ChoiceList_makeCommandList = Window_ChoiceList.prototype.makeCommandList;
Window_ChoiceList.prototype.makeCommandList = function() {
    _Window_ChoiceList_makeCommandList.call(this);
    if (DS.isRunning()) for (let i = 0; i < this._list.length; i++) this._list[i].enabled = DS.choiceEnabled(i);
};

DS.registerEffect("worldState", effect => {
    if (effect.operation === "toggle") WorldState.toggle(effect.target); else WorldState.set(effect.target, effect.value);
});
DS.registerEffect("quest", effect => {
    const operation = effect.operation || "complete";
    if (operation === "accept" || operation === "start") QuestJournal.accept(effect.target);
    else if (operation === "complete") QuestJournal.complete(effect.target);
    else if (operation === "fail") QuestJournal.fail(effect.target);
    else if (operation === "completeObjective") QuestJournal.completeObjective(effect.target, Number(effect.index) || 0);
    else if (operation === "revealObjective") QuestJournal.revealObjective(effect.target, Number(effect.index) || 0);
    else if (operation === "setProgress") QuestJournal.setProgress(effect.target, Number(effect.index) || 0, effect.value);
});
DS.registerEffect("relationship", effect => {
    if (effect.operation === "set") Relationships.set(effect.target, effect.value);
    else if (effect.operation === "flag") Relationships.setFlag(effect.target, effect.key ?? effect.flagId, effect.value !== false);
    else Relationships.add(effect.target, effect.value);
});
DS.registerEffect("reputation", effect => {
    if (effect.operation === "set") Reputation.set(effect.target, effect.value); else Reputation.add(effect.target, effect.value);
});
DS.registerEffect("switch", effect => {
    const id = Number(effect.target); const value = effect.operation === "toggle" ? !$gameSwitches.value(id) : !!effect.value; $gameSwitches.setValue(id, value);
});
DS.registerEffect("variable", effect => {
    const id = Number(effect.target), current = Number($gameVariables.value(id)) || 0;
    const value = effect.operation === "add" ? current + Number(effect.value || 0) : effect.operation === "subtract" ? current - Number(effect.value || 0) : effect.value;
    $gameVariables.setValue(id, value);
});
DS.registerEffect("chronicle", effect => {
    const operation = effect.operation || "discover";
    if (operation === "discover") Chronicle.discover(effect.target);
    else if (operation === "hide") Chronicle.hide(effect.target);
    else if (operation === "revealSection") Chronicle.revealSection(effect.target, effect.section);
    else if (operation === "hideSection") Chronicle.hideSection(effect.target, effect.section);
    else if (operation === "setStage") Chronicle.setStage(effect.target, effect.stage);
});
for (const [kind, databaseName] of [["Item", "$dataItems"], ["Weapon", "$dataWeapons"], ["Armor", "$dataArmors"]]) {
    const find = effect => window[databaseName]?.[Number(effect.target)];
    const count = effect => Math.max(1, Number(effect.value) || 1);
    DS.registerEffect("give" + kind, effect => { const entry = find(effect); if (entry) $gameParty.gainItem(entry, count(effect)); });
    DS.registerEffect("remove" + kind, effect => { const entry = find(effect); if (entry) $gameParty.loseItem(entry, count(effect)); });
}
DS.registerEffect("party", effect => {
    const id = Number(effect.actor);
    if (effect.operation === "remove") $gameParty.removeActor(id); else $gameParty.addActor(id);
});
DS.registerEffect("lifeStage", effect => { if (window.CharacterPresentation) CharacterPresentation.setStage(effect.target, effect.stage); });
DS.registerEffect("music", effect => {
    if (effect.operation === "stop") AudioManager.stopBgm();
    else if (effect.operation === "fade") AudioManager.fadeOutBgm(Number(effect.seconds) || 2);
    else if (effect.name) AudioManager.playBgm({ name: String(effect.name), volume: Number(effect.volume ?? 90), pitch: 100, pan: 0 });
});
DS.registerEffect("sound", effect => { if (effect.name) AudioManager.playSe({ name: String(effect.name), volume: Number(effect.volume ?? 90), pitch: 100, pan: 0 }); });
DS.registerEffect("screen", effect => {
    const frames = Math.max(1, Math.round((Number(effect.seconds) || 1) * 60));
    if (effect.operation === "fadeOut") $gameScreen.startFadeOut(frames);
    else if (effect.operation === "fadeIn") $gameScreen.startFadeIn(frames);
    else if (effect.operation === "shake") $gameScreen.startShake(Number(effect.power) || 5, 5, frames);
    else $gameScreen.startTint(TINTS[effect.tint] || TINTS.normal, frames);
});
DS.registerEffect("transfer", effect => {
    const direction = [2, 4, 6, 8].includes(Number(effect.direction)) ? Number(effect.direction) : 0; // 0 keeps the current facing
    $gamePlayer.reserveTransfer(Number(effect.map), Number(effect.x) || 0, Number(effect.y) || 0, direction, 0);
});
DS.registerEffect("healParty", () => { for (const actor of $gameParty.members()) actor.recoverAll(); });
DS.registerEffect("gold", effect => {
    const value = Number(effect.value) || 0;
    if (effect.operation === "set") $gameParty.gainGold(value - $gameParty.gold()); else $gameParty.gainGold(value);
});
})();
