/*:
 * @target MZ
 * @plugindesc v1.0.0 Default RPG Maker MZ interface for Chronicle.
 * @author Steven Newton
 * @base Chronicle
 * @orderAfter Chronicle
 *
 * @param menuCommandName
 * @text Menu Command Name
 * @type string
 * @default Chronicle
 *
 * @param debugMode
 * @text Show Debug Values
 * @type boolean
 * @default false
 *
 * @help
 * Presentation-only companion for Chronicle. Load after Chronicle.
 * Replace this plugin to reskin the encyclopedia without changing discovery,
 * save data, commands, relationship/reputation integration, or event logic.
 */
(() => {
"use strict";
const pluginName = "ChronicleUI_Default";
const params = PluginManager.parameters(pluginName);
const menuName = String(params.menuCommandName || "Chronicle");
const debugMode = params.debugMode === "true";
const C = window.Chronicle;
if (!C) throw new Error("ChronicleUI_Default requires Chronicle core above it.");
const typeOrder = ["people", "factions", "lore"];
function debugLabel(entry) {
    if (!debugMode) return "";
    if (entry.relationshipId && window.Relationships) return `Affinity: ${Relationships.affinity(entry.relationshipId)} • Tier: ${Relationships.tierId(entry.relationshipId)}`;
    if (entry.reputationId && window.Reputation) return `Reputation: ${Reputation.value(entry.reputationId)} • Tier: ${Reputation.tierId(entry.reputationId)}`;
    return "";
}

const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
Window_MenuCommand.prototype.addOriginalCommands = function() { _Window_MenuCommand_addOriginalCommands.call(this); this.addCommand(menuName, "chronicle", true); };
const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
Scene_Menu.prototype.createCommandWindow = function() { _Scene_Menu_createCommandWindow.call(this); this._commandWindow.setHandler("chronicle", () => SceneManager.push(Scene_Chronicle)); };

class Window_ChronicleTabs extends Window_HorzCommand {
    maxCols() { return 3; }
    makeCommandList() { this.addCommand("People", "people"); this.addCommand("Factions", "factions"); this.addCommand("Lore", "lore"); }
}
class Window_ChronicleList extends Window_Selectable {
    initialize(rect) { super.initialize(rect); this._type = "people"; this._data = []; this.refresh(); this.select(0); }
    maxItems() { return this._data.length; }
    item() { return this._data[this.index()] || null; }
    setType(type) { if (this._type === type) return; this._type = type; this.refresh(); this.select(this.maxItems() ? 0 : -1); this.callUpdateHelp(); }
    refresh() { this._data = C.visible(this._type); super.refresh(); }
    drawItem(index) { const e = this._data[index], r = this.itemLineRect(index); this.drawText(e.displayName, r.x, r.y, r.width); }
    updateHelp() { this._helpWindow?.setEntry(this.item()); }
}
class Window_ChronicleDetails extends Window_Base {
    initialize(rect) { super.initialize(rect); this._entry = null; this._offset = 0; this._maxOffset = 0; this.active = false; }
    setEntry(entry) { if (this._entry !== entry) { this._entry = entry; this._offset = 0; this.refresh(); } }
    activate() { this.active = true; this.refresh(); }
    deactivate() { this.active = false; this.refresh(); }
    update() {
        super.update(); if (!this.active) return;
        if (Input.isRepeated("down") || Input.isRepeated("pagedown") || TouchInput.wheelY >= 20) this.setOffset(this._offset + this.lineHeight());
        if (Input.isRepeated("up") || Input.isRepeated("pageup") || TouchInput.wheelY <= -20) this.setOffset(this._offset - this.lineHeight());
    }
    setOffset(value) { const next = Math.max(0, Math.min(this._maxOffset, value)); if (next !== this._offset) { this._offset = next; this.refresh(); } }
    refresh() {
        this.contents.clear(); const base = this._entry; if (!base) { this.drawText("No discovered entries.", 0, 24, this.innerWidth, "center"); return; }
        const e = C.current(base.id); let y = -this._offset;
        y = this.drawHeader(e, y); y = this.drawBody(e, y);
        this._maxOffset = Math.max(0, y + this._offset - this.innerHeight + this.lineHeight());
        if (this._maxOffset > 0) this.drawText(this.active ? "↑/↓ Scroll • Cancel Return" : "OK: Read / Scroll", 0, this.innerHeight - this.lineHeight(), this.innerWidth, "right");
    }
    drawHeader(e, y) {
        const imageHeight = 150;
        this.drawArtwork(e, 0, Math.max(0, y), 150, imageHeight);
        const x = 166, width = this.innerWidth - x;
        this.changeTextColor(ColorManager.systemColor()); this.drawText(e.displayName, x, y, width); this.resetTextColor(); y += this.lineHeight();
        if (e.title) { this.drawText(e.title, x, y, width); y += this.lineHeight(); }
        const social = C.socialLabel(e); if (social) { this.changeTextColor(ColorManager.textColor(6)); this.drawText(social, x, y, width); this.resetTextColor(); y += this.lineHeight(); }
        const debug = debugLabel(e); if (debug) { this.changeTextColor(ColorManager.textColor(18)); this.drawText(debug, x, y, width); this.resetTextColor(); y += this.lineHeight(); }
        return Math.max(y + 12, -this._offset + imageHeight + 16);
    }
    drawArtwork(e, x, y, width, height) {
        if (y + height < 0 || y > this.innerHeight) return;
        if (e.portraitName) {
            const bitmap = ImageManager.loadPicture(e.portraitName); if (!bitmap.isReady()) { bitmap.addLoadListener(() => this.refresh()); return; }
            const scale = Math.min(width / bitmap.width, height / bitmap.height); const sw = width / scale, sh = height / scale;
            this.contents.blt(bitmap, Math.max(0, (bitmap.width - sw) / 2), Math.max(0, (bitmap.height - sh) / 2), Math.min(sw, bitmap.width), Math.min(sh, bitmap.height), x, y, width, height); return;
        }
        const characterId = e.characterId || e.relationshipId;
        const face = window.CharacterPresentation?.resolve(characterId, e.expression || "neutral");
        if (face) { const bitmap = ImageManager.loadFace(face.faceName); if (!bitmap.isReady()) { bitmap.addLoadListener(() => this.refresh()); return; } const pw = ImageManager.faceWidth, ph = ImageManager.faceHeight, sx = (face.faceIndex % 4) * pw, sy = Math.floor(face.faceIndex / 4) * ph; this.contents.blt(bitmap, sx, sy, pw, ph, x, y, width, height); }
    }
    drawBody(e, y) {
        y = this.drawWrapped(e.description, 8, y, this.innerWidth - 16); y += 12;
        const sections = e.sections.filter(s => C.sectionVisible(e.id, s));
        for (const section of sections) {
            this.changeTextColor(ColorManager.systemColor()); this.drawText(section.title || "Known Information", 8, y, this.innerWidth - 16); this.resetTextColor(); y += this.lineHeight();
            y = this.drawWrapped(`• ${section.text}`, 18, y, this.innerWidth - 28); y += 8;
        }
        return y;
    }
    drawWrapped(text, x, y, width) {
        let line = ""; for (const word of String(text || "").split(/\s+/)) { const test = line ? `${line} ${word}` : word; if (line && this.textWidth(test) > width) { this.drawText(line, x, y, width); y += this.lineHeight(); line = word; } else line = test; }
        if (line) { this.drawText(line, x, y, width); y += this.lineHeight(); } return y;
    }
}
class Scene_Chronicle extends Scene_MenuBase {
    create() {
        super.create(); const th = this.calcWindowHeight(1, true), y = this.mainAreaTop() + th, h = Graphics.boxHeight - y, lw = Math.floor(Graphics.boxWidth * 0.3);
        this._tabs = new Window_ChronicleTabs(new Rectangle(0, this.mainAreaTop(), Graphics.boxWidth, th));
        this._list = new Window_ChronicleList(new Rectangle(0, y, lw, h)); this._details = new Window_ChronicleDetails(new Rectangle(lw, y, Graphics.boxWidth - lw, h));
        this._list.setHelpWindow(this._details); for (const type of typeOrder) this._tabs.setHandler(type, () => this.activateList());
        this._tabs.setHandler("cancel", this.popScene.bind(this)); this._list.setHandler("ok", () => this.activateDetails()); this._list.setHandler("cancel", () => this.activateTabs());
        this.addWindow(this._tabs); this.addWindow(this._list); this.addWindow(this._details); this._lastTab = -1; this._tabs.activate(); this._tabs.select(0); this.syncTab();
    }
    update() { super.update(); this.syncTab(); if (this._details.active && Input.isTriggered("cancel")) this.activateList(); }
    syncTab() { if (this._lastTab !== this._tabs.index()) { this._lastTab = this._tabs.index(); this._list.setType(this._tabs.currentSymbol()); this._list.callUpdateHelp(); } }
    activateList() { this._tabs.deactivate(); this._details.deactivate(); this._list.activate(); if (this._list.index() < 0 && this._list.maxItems()) this._list.select(0); }
    activateDetails() { if (!this._list.item()) return; this._list.deactivate(); this._details.activate(); }
    activateTabs() { this._list.deactivate(); this._details.deactivate(); this._tabs.activate(); }
}
window.Scene_Chronicle = Scene_Chronicle;
})();


