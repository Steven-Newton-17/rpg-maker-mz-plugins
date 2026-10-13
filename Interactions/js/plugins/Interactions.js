/*:
 * @target MZ
 * @plugindesc v2.1.1 Characters and Things on the map run ordered rules; each placed Thing is its own instance with its own state.
 * @author Steven Newton
 *
 * @param interactionDataFile
 * @text Character Rules File
 * @type string
 * @default Interactions.json
 *
 * @param thingDataFile
 * @text Things File
 * @type string
 * @default Things.json
 *
 * @param placementDataFile
 * @text Placements File
 * @type string
 * @default Placements.json
 *
 * @command interact
 * @text Interact
 * @desc Runs the first matching rule of a character or Thing. Leave both IDs empty to use this event's tag.
 * @arg characterId
 * @text Character ID
 * @type string
 * @default
 * @arg thingId
 * @text Thing ID
 * @type string
 * @default
 *
 * @help
 * Definitions and instances
 * A character or Thing is defined once (rules, states, graphics) in the Game Manager. A map event is a placement of it:
 *   <character:id>   a person. People are singletons: a villager is the same villager on every map.
 *   <thing:id>       a Thing (chest, sign, gate, trigger, lever, monster...). Unless the Thing is marked "shared", every
 *                    placement is its own instance with its own state, its own "only once" flags and its own auto-run flag.
 *   <place:p3>       the placement's id on its map, written by the Map Builder; with the map id it names the instance.
 *   <interact:false> opts a tagged event out. A page comment with this tag opts only that page out.
 * A placement may carry its own starting state and its own "appears when" (Placements.json), which add to the definition's.
 *
 * Rules
 * Each definition owns an ordered list of rules. The first rule whose conditions pass runs: its effects, then its dialogue.
 * A rule can be "only once", and (for Things) can let the event's own commands continue.
 * A rule can also list "again" dialogues: the first run plays its dialogue, later runs play the again dialogues
 * (in order, then the last one from then on; or againMode "cycle" / "random"). Use them so people don't repeat themselves.
 *
 * Things
 *   trigger:    action (button), bump (touch, blocks), walkon (step onto it), auto (once)
 *   states:     for example closed / open, each with its own graphic; rules change the state; "animate" shows walking frames
 *   scope:      "instance" (default) or "shared" (one state for the whole game: a winch that other rules read, a door)
 *   appearsWhen: conditions; the event is absent while they fail (characters have this too)
 * Conditions and effects may say target "self" to mean this very instance. Another Thing's state can be read or set by id
 * only when that Thing is shared. Condition type "thing" reads a state; effect type "thingState" sets it.
 *
 * Script API
 *   Interactions.pick("mother")                      // first matching rule for a character
 *   Interactions.pickFor("thing", "chest")           // ... for a shared Thing
 *   Interactions.run("mother")                       // starts a character's dialogue
 *   Interactions.thingState("winch")                 // state of a shared Thing
 *   Interactions.eventState(event)                   // state of one placed Thing
 *   Interactions.setEventState(event, "open")
 *   Interactions.refresh()                           // set every tagged event's page up again now
 *
 * Requires ConditionSystem and DialogueSystem, loaded before this plugin.
 */
(() => {
"use strict";
const pluginName = "Interactions";
const params = PluginManager.parameters(pluginName);
const dataFile = String(params.interactionDataFile || "Interactions.json");
const thingFile = String(params.thingDataFile || "Things.json");
const placementFile = String(params.placementDataFile || "Placements.json");
const TAG_THING = /<thing\s*:\s*([a-z][a-z0-9_]*)>/i;
const TAG_CHARACTER = /<character(?:Id)?\s*:\s*([a-z][a-z0-9_]*)>/i;
const TAG_PLACE = /<place\s*:\s*([a-z][a-z0-9_]*)>/i;
const warned = new Set();
const warnOnce = message => { if (!warned.has(message)) { warned.add(message); console.warn(message); } };

window.$dataInteractions = null;
window.$dataThings = null;
window.$dataPlacements = null;
window.$dataManagedDoors = null;
DataManager._databaseFiles.push({ name: "$dataInteractions", src: dataFile });
DataManager._databaseFiles.push({ name: "$dataThings", src: thingFile });
DataManager._databaseFiles.push({ name: "$dataPlacements", src: placementFile });
DataManager._databaseFiles.push({ name: "$dataManagedDoors", src: "ManagedDoors.json" });
// Optional for projects that use Interactions without the manager's map generator.
const _managedDoorLoadDataFile = DataManager.loadDataFile;
DataManager.loadDataFile = function(name, src) {
    if (name !== "$dataManagedDoors") return _managedDoorLoadDataFile.call(this, name, src);
    window[name] = null;
    const request = new XMLHttpRequest();
    request.open("GET", "data/" + src);
    request.overrideMimeType("application/json");
    const finish = () => {
        try { window[name] = request.status < 400 && request.responseText ? JSON.parse(request.responseText) : {}; }
        catch { window[name] = {}; }
        this.onLoad?.(window[name]);
    };
    request.onload = finish;
    request.onerror = () => { window[name] = {}; this.onLoad?.(window[name]); };
    request.send();
};

/* ---------- saved state ---------- */
const save = () => { $gameSystem._interactions = $gameSystem._interactions || { states: {}, done: {} }; return $gameSystem._interactions; };

/* ---------- subjects ----------
 * { kind, id, key, stateKey, def, placement }
 *   key       identifies the subject for "only once" flags: "thing:chest@9:p2" (an instance) or "thing:winch" (shared)
 *   stateKey  names the state it owns: "chest@9:p2" or "winch"; this is what "self" resolves to
 */
const placementOf = (mapId, place) => (place ? window.$dataPlacements?.[mapId]?.[place] || null : null);
const subject = (kind, id, instance = null, spot = null) => {
    const def = kind === "thing" ? window.$dataThings?.[id] : (window.$dataInteractions?.[id] || (window.CharacterPresentation?.raw(id) ? { rules: [] } : null));
    if (!def) return null;
    const own = kind === "thing" && def.scope !== "shared" && instance;
    const stateKey = own ? `${id}@${instance}` : String(id);
    // the placement's own data (a starting state, an appears-when) applies to a person or a Thing wherever it is placed, shared or not
    return { kind, id: String(id), key: kind + ":" + stateKey, stateKey, def, instance: own ? instance : null, placement: spot ? placementOf(spot.mapId, spot.place) : null };
};

/** Replaces target "self" with the subject's state key (conditions and effects may nest). */
const resolveSelf = (value, subj) => {
    if (Array.isArray(value)) return value.map(item => resolveSelf(item, subj));
    if (value && typeof value === "object") {
        const out = {};
        for (const [key, item] of Object.entries(value)) out[key] = key === "target" && item === "self" ? subj.stateKey : resolveSelf(item, subj);
        return out;
    }
    return value;
};
const passes = (conditions, subj) => !conditions || ConditionSystem.check(resolveSelf(conditions, subj));

const refreshMap = () => {
    if (!window.$gameMap) return;
    // set the page up again right now, so an event never sits without a valid page between frames
    for (const event of $gameMap.events()) {
        if (!tagged(event)) continue;
        event._pageIndex = event._erased ? -1 : event.findProperPageIndex();
        event.setupPage();
    }
    $gameMap.requestRefresh();
};

/* ---------- Thing state, by state key ---------- */
const splitKey = stateKey => { const [id, instance] = String(stateKey).split("@"); return { id, instance: instance || null }; };
const initialState = (def, instance) => {
    const [mapId, place] = instance ? instance.split(":") : [null, null];
    const wanted = placementOf(mapId, place)?.state;
    return def.states.find(state => state.id === wanted)?.id ?? def.states[0].id;
};
const stateOfKey = stateKey => {
    const { id, instance } = splitKey(stateKey);
    const def = window.$dataThings?.[id];
    if (!def?.states?.length) return null;
    if (!instance && def.scope !== "shared") warnOnce(`Interactions: Thing '${id}' is per placement, so its state cannot be read by id from elsewhere. Mark it shared, or use "this one".`);
    const current = save().states[stateKey];
    return def.states.some(state => state.id === current) ? current : initialState(def, instance);
};
const setStateOfKey = (stateKey, state) => {
    const { id } = splitKey(stateKey);
    const def = window.$dataThings?.[id];
    if (!def?.states?.some(item => item.id === state)) { warnOnce(`Interactions: Thing '${id}' has no state '${state}'.`); return false; }
    save().states[stateKey] = state;
    refreshMap();
    return true;
};

const I = window.Interactions = {
    version: "2.1.0",
    refresh() { refreshMap(); },

    // ---- rules ----
    rulesFor(kind, id) { return subject(kind, id)?.def.rules || []; },
    pickSubject(subj) {
        for (const rule of subj.def.rules || []) {
            if (rule.once && save().done[subj.key + "/" + rule.id]) continue;
            if (passes(rule.conditions, subj)) return rule;
        }
        return null;
    },
    pickFor(kind, id, instance) { const subj = subject(kind, id, instance); return subj ? this.pickSubject(subj) : null; },
    appears(subj) { return passes(subj.def.appearsWhen, subj) && passes(subj.placement?.appearsWhen, subj); },

    /** Applies a rule's effects, marks it done, and starts its dialogue. Returns true when a dialogue started. */
    runRule(subj, rule, interpreter) {
        if (rule.effects?.length) DialogueSystem.applyEffects(resolveSelf(rule.effects, subj), { source: "rule", subject: subj.key, selfKey: subj.stateKey, ruleId: rule.id });
        if (rule.once) save().done[subj.key + "/" + rule.id] = true;
        const dialogue = this.dialogueFor(subj, rule);
        let started = false;
        if (dialogue) {
            started = DialogueSystem.start(dialogue);
            if (!started) warnOnce(`Interactions: rule '${rule.name || rule.id}' of '${subj.key}' points at missing dialogue '${dialogue}'.`);
            else interpreter?.setWaitMode("dialogueSystem");
        }
        refreshMap();
        return started;
    },

    /** The dialogue a rule plays this time: its own the first time, then its "again" dialogues. Counts the run. */
    dialogueFor(subj, rule) {
        const runs = save().runs ||= {};
        const key = subj.key + "/" + rule.id;
        const count = runs[key] || 0;
        runs[key] = count + 1;
        const again = Array.isArray(rule.again) ? rule.again.filter(Boolean) : [];
        if (!count || !again.length) return rule.dialogue || null;
        if (rule.againMode === "random") {
            const last = (save().lastAgain ||= {});
            const pool = again.length > 1 ? again.filter(id => id !== last[key]) : again;
            return (last[key] = pool[Math.floor(Math.random() * pool.length)]);
        }
        if (rule.againMode === "cycle") return again[(count - 1) % again.length];
        return again[Math.min(count - 1, again.length - 1)];
    },
    /** How many times a rule has run for a character or a shared Thing. */
    timesRun(kind, id, ruleId) { return save().runs?.[kind + ":" + id + "/" + ruleId] || 0; },

    // ---- characters ----
    rules(characterId) { return this.rulesFor("character", characterId); },
    has(characterId) { return this.rules(characterId).length > 0; },
    pick(characterId) { return this.pickFor("character", characterId); },
    run(characterId, interpreter) {
        const subj = subject("character", characterId), rule = subj && this.pickSubject(subj);
        return rule ? this.runRule(subj, rule, interpreter) : false;
    },

    // ---- Things ----
    thing(id) { return window.$dataThings?.[id] || null; },
    /** State of a shared Thing (or of a placement, by its state key "id@map:place"). */
    thingState(stateKey) { return stateOfKey(stateKey); },
    setThingState(stateKey, state) { return setStateOfKey(stateKey, state); },
    /** State of one placed Thing. */
    eventState(event) { const subj = subjectOf(event); return subj?.kind === "thing" ? stateOfKey(subj.stateKey) : null; },
    setEventState(event, state) { const subj = subjectOf(event); return subj?.kind === "thing" ? setStateOfKey(subj.stateKey, state) : false; },
    stateKeyOf(event) { return subjectOf(event)?.stateKey || null; }
};

/* ---------- condition and effect adapters ---------- */
ConditionSystem.register("thing", condition => ({ actual: stateOfKey(condition.target) }));
DialogueSystem.registerEffect("thingState", effect => setStateOfKey(effect.target, effect.state ?? effect.value));
DialogueSystem.on("dialogueEnd", refreshMap);

/* ---------- binding to map events ---------- */
const noteOf = event => String(event?.event?.()?.note || "");
const tagOf = event => {
    const note = noteOf(event);
    if (/<interact\s*:\s*false>/i.test(note)) return null;
    const thing = note.match(TAG_THING)?.[1];
    const place = note.match(TAG_PLACE)?.[1] || null;
    if (thing) return { kind: "thing", id: thing, place };
    const character = note.match(TAG_CHARACTER)?.[1];
    return character ? { kind: "character", id: character, place } : null;
};
const tagged = event => !!tagOf(event);
/** An event's subject. A placed Thing's instance is its map and placement id (or, for an untagged hand-made event, its event number). */
const subjectOf = event => {
    const tag = tagOf(event);
    if (!tag) return null;
    const mapId = event._mapId ?? $gameMap.mapId();
    return subject(tag.kind, tag.id, tag.kind === "thing" ? `${mapId}:${tag.place || "e" + event.eventId()}` : null, { mapId, place: tag.place });
};

PluginManager.registerCommand(pluginName, "interact", function(args) {
    const event = $gameMap.event(this.eventId());
    const own = subjectOf(event);
    const explicit = String(args.thingId || "").trim() ? subject("thing", String(args.thingId).trim())
        : String(args.characterId || "").trim() ? subject("character", String(args.characterId).trim()) : null;
    const subj = explicit || own;
    if (!subj) { warnOnce("Interactions: the Interact command needs an ID or a <thing:id> / <character:id> event tag."); return; }
    const rule = I.pickSubject(subj);
    if (!rule) return; // nothing matches: the event's own commands (if any) carry on
    I.runRule(subj, rule, this);
    if (subj.def.trigger === "auto") { save().done[subj.key + "/auto"] = true; if (event) event._trigger = null; }
    if (rule.then !== "continue" && !rule.dialogue && window.MapDoors?.data(event?.event()) && window.$gameMessage) {
        $gameMessage.add(MapDoors.data(event.event()).closedText || "It's closed."); this.setWaitMode("message");
    }
    if (rule.then !== "continue") this._index = this._list.length; // stop: skip the event's own commands
});

// An open prop page can keep its Thing identity without running its interaction again.
const pageOptsOut = page => !!page?.list?.some(command => (command.code === 108 || command.code === 408) && /<interact\s*:\s*false>/i.test(String(command.parameters?.[0] || "")));

// A tagged event gets an Interact command in front of its own commands (Things always; characters only when empty).
const END = { code: 0, indent: 0, parameters: [] };
const listCache = new WeakMap();
const _Game_Event_list = Game_Event.prototype.list;
Game_Event.prototype.list = function() {
    const page = this.page();
    if (!page || pageOptsOut(page)) return _Game_Event_list.call(this);
    const subj = subjectOf(this);
    const natives = page.list.length > 1;
    if (!subj || (subj.kind === "character" && (natives || !subj.def.rules?.length))) return page.list;
    let cached = listCache.get(page.list);
    if (!cached) {
        const command = { code: 357, indent: 0, parameters: [pluginName, "interact", "Interact", { characterId: "", thingId: "" }] };
        cached = natives ? [command, ...page.list] : [command, END];
        listCache.set(page.list, cached);
    }
    return cached;
};

// Absent while appearsWhen fails (the definition's, then this placement's).
const _Game_Event_findProperPageIndex = Game_Event.prototype.findProperPageIndex;
Game_Event.prototype.findProperPageIndex = function() {
    const subj = subjectOf(this);
    if (subj && !I.appears(subj)) return -1;
    return _Game_Event_findProperPageIndex.call(this);
};

// Managed doors: sprite-sized collision, local conditions, and optional closing on map entry.
window.MapDoors = {
    restoreBuilt(mapId) {
        const built = window.$dataManagedDoors?.[mapId]?.events;
        if (!built || !window.$dataMap?.events) return;
        const events = $dataMap.events;
        const keyOf = record => /<(door|detail|doorThreshold):([a-z][a-z0-9_]*)>/.exec(String(record?.note || ""))?.[0];
        for (const record of built) {
            const key = keyOf(record);
            if (!key) continue;
            const previous = events.find(e => keyOf(e) === key);
            // A manually authored entrance belongs to the editor, rather than this catalog.
            if (previous && !String(previous.note || "").includes("<mapgen>")) continue;
            let id = previous?.id || record.id;
            if (!previous && events[id]) { id = 1; while (events[id]) id++; }
            events[id] = { ...JSON.parse(JSON.stringify(record)), id };
            if (DataManager.extractMetadata) DataManager.extractMetadata(events[id]);
        }
    },
    data(record) {
        if (record?.door) return record.door;
        const tag = /<mapDoor:([^>]+)>/.exec(String(record?.note || ""));
        try { return tag ? JSON.parse(decodeURIComponent(tag[1])) : null; } catch { return null; }
    },
    threshold(record) {
        const tag = /<mapDoorThreshold:([^>]+)>/.exec(String(record?.note || ""));
        try { return tag ? JSON.parse(decodeURIComponent(tag[1])) : null; } catch { return null; }
    },
    owner(record) {
        const key = this.threshold(record)?.owner;
        return key ? window.$dataMap?.events?.find(e => e && this.data(e)?.key === key) : null;
    },
    thresholdOpen(record, mapId) {
        const owner = this.owner(record);
        return !!owner && (this.data(owner)?.alwaysOpen || $gameSelfSwitches.value([mapId, owner.id, "A"]));
    },
    canOpen(eventId) {
        const event = $gameMap.event(eventId), when = this.data(event?.event())?.openWhen;
        if (!when) return true;
        const self = window.Interactions?.stateKeyOf(event);
        const resolve = value => Array.isArray(value) ? value.map(resolve) : value && typeof value === "object"
            ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "target" && v === "self" && self ? self : resolve(v)])) : value;
        return ConditionSystem.check(resolve(when));
    }
};
const _doorEventPos = Game_Event.prototype.pos;
Game_Event.prototype.pos = function(x, y) {
    const owner = MapDoors.owner(this.event());
    const footprint = owner ? { ...MapDoors.data(owner), depth: 1 } : MapDoors.data(this.event());
    if (!footprint) return _doorEventPos.call(this, x, y);
    const width = Math.max(1, Math.min(12, Number(footprint.width) || 1)), depth = Math.max(1, Math.min(8, Number(footprint.depth) || 1));
    const left = this.x - Math.floor(width / 2), top = this.y - depth + 1;
    return x >= left && x < left + width && y >= top && y < top + depth;
};
const _doorFindPage = Game_Event.prototype.findProperPageIndex;
Game_Event.prototype.findProperPageIndex = function() {
    if (MapDoors.threshold(this.event()) && !MapDoors.thresholdOpen(this.event(), this._mapId)) return -1;
    return _doorFindPage.call(this);
};
if (typeof Game_Player !== "undefined") {
    const _doorPlayerPassable = Game_Player.prototype.isMapPassable;
    Game_Player.prototype.isMapPassable = function(x, y, d) {
        const nx = $gameMap.roundXWithDirection(x, d), ny = $gameMap.roundYWithDirection(y, d);
        for (const threshold of $gameMap.events()) {
            if (MapDoors.data(threshold.event())?.alwaysOpen &&
                (threshold.pos(nx, ny) || (threshold.pos(x, y) && $gameMap.isPassable(nx, ny, 10 - d)))) return true;
            if (!MapDoors.thresholdOpen(threshold.event(), $gameMap.mapId()) || !threshold.pos(nx, ny)) continue;
            const owner = $gameMap.event(MapDoors.owner(threshold.event()).id);
            // Permit entry onto an open door's own tile even when its facade is an impassable wall.
            // Also support older maps with the threshold immediately behind the doorway.
            if (owner?.pos(nx, ny) || owner?.pos(x, y)) return true;
        }
        return _doorPlayerPassable.call(this, x, y, d);
    };
}
if (typeof Game_Map !== "undefined") {
    const _doorMapSetup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        MapDoors.restoreBuilt(mapId);
        // Reset before events are created, so their first frame and collision are already closed.
        for (const record of window.$dataMap?.events || []) if (MapDoors.data(record)?.closeOnEntry)
            $gameSelfSwitches.setValue([mapId, record.id, "A"], false);
        _doorMapSetup.call(this, mapId);
    };
}

const DIRECTION_OK = new Set([2, 4, 6, 8]);
const _Game_Event_setupPageSettings = Game_Event.prototype.setupPageSettings;
Game_Event.prototype.setupPageSettings = function() {
    _Game_Event_setupPageSettings.call(this);
    if (pageOptsOut(this.page())) return;
    const subj = subjectOf(this);
    if (!subj) return;
    const emptyPage = this.page().list.length <= 1;
    if (subj.kind === "character") { if (emptyPage && subj.def.rules?.length) this._priorityType = 1; return; }
    const def = subj.def;
    const triggers = { action: [0, 1], bump: [1, 1], walkon: [1, 0], auto: [3, 0] };
    let [trigger, priority] = triggers[def.trigger] || [null, null];
    // a door sits on a wall tile you cannot step onto: its page is "same as characters" and is touched from outside. A gate on it must keep that.
    if (def.trigger === "walkon" && this.page().priorityType === 1) priority = 1;
    if (trigger !== null) {
        this._trigger = (def.trigger === "auto" && save().done[subj.key + "/auto"]) ? null : trigger;
        this._priorityType = priority;
    }
    const state = def.states?.find(item => item.id === stateOfKey(subj.stateKey));
    const graphic = state?.graphic;
    if (Number(graphic?.tileId) > 0) {
        // an object tile from Tileset B to E: stands still, no walking frames
        this.setTileImage(Number(graphic.tileId));
        this.setStepAnime(false); this.setWalkAnime(false); this.setDirectionFix(true);
    } else if (graphic?.characterName) {
        this.setImage(String(graphic.characterName), Number(graphic.characterIndex) || 0);
        if (DIRECTION_OK.has(Number(graphic.direction))) {
            // the previous state fixed the direction; unlock it so the new state's direction can apply
            this._originalDirection = Number(graphic.direction); this.setDirectionFix(false); this.setDirection(Number(graphic.direction));
        }
        const pattern = Number.isInteger(graphic.pattern) ? graphic.pattern : 1;
        this.setPattern(pattern); this._originalPattern = pattern;
        // objects stand still; a state marked "animate" (a monster that moves) shows its walking frames and turns as it goes
        const animate = !!graphic.animate;
        this.setStepAnime(false); this.setWalkAnime(animate); this.setDirectionFix(!animate);
    }
};
})();
