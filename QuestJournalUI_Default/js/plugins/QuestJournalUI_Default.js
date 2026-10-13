/*:
 * @target MZ
 * @plugindesc v1.0.1 Default RPG Maker MZ interface for QuestJournal.
 * @author Steven Newton
 * @orderAfter QuestJournal
 *
 * @param menuCommandName
 * @text Menu Command Name
 * @type string
 * @default Quest Log
 *
 * @help
 * Presentation-only companion for QuestJournal. Load after QuestJournal
 * core. Replace this plugin to reskin
 * the journal without changing quest data, saves, commands, or event logic.
 */
(() => {
"use strict";
const pluginName = "QuestJournalUI_Default";
const parameters = PluginManager.parameters(pluginName);
const menuCommandName = String(parameters.menuCommandName || "Quest Log");
const Q = window.QuestJournal;
if (!Q) throw new Error("QuestJournalUI_Default requires QuestJournal core above it.");

const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
Window_MenuCommand.prototype.addOriginalCommands = function() {
    _Window_MenuCommand_addOriginalCommands.call(this);
    this.addCommand(menuCommandName, "questLog", true);
};

const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
Scene_Menu.prototype.createCommandWindow = function() {
    _Scene_Menu_createCommandWindow.call(this);
    this._commandWindow.setHandler("questLog", () => SceneManager.push(Scene_QuestJournal));
};

class Window_QuestTabs extends Window_HorzCommand {
    maxCols() { return 4; }
    makeCommandList() {
        this.addCommand("All", "all");
        this.addCommand("Active", "active");
        this.addCommand("Complete", "completed");
        this.addCommand("Failed", "failed");
    }
}

class Window_QuestList extends Window_Selectable {
    initialize(rect) { super.initialize(rect); this._filter = "all"; this._data = []; this.refresh(); this.select(0); }
    maxItems() { return this._data.length; }
    item() { return this._data[this.index()] || null; }
    setFilter(filter) {
        if (this._filter === filter) return;
        this._filter = filter;
        this.refresh();
        this.select(this.maxItems() ? 0 : -1);
        this.callUpdateHelp();
    }
    refresh() { this._data = Q.visible(this._filter); super.refresh(); }
    drawItem(index) {
        const quest = this._data[index];
        const rect = this.itemLineRect(index);
        const status = Q.status(quest);
        this.changeTextColor(ColorManager.textColor(status === "completed" ? 3 : status === "failed" ? 18 : 6));
        this.drawText(quest.title, rect.x, rect.y, rect.width);
        this.resetTextColor();
    }
    updateHelp() { this._helpWindow?.setQuest(this.item()); }
}

class Window_QuestDetails extends Window_Scrollable {
    initialize(rect) { super.initialize(rect); this._quest = null; this._contentHeight = 0; this.deactivate(); }
    setQuest(quest) { if (this._quest !== quest) { this._quest = quest; this.scrollTo(0,0); this._scrollBaseY=0; this.refresh(); } }
    overallHeight() { return this._contentHeight || this.innerHeight; }
    contentsHeight() { return this.innerHeight + this.lineHeight(); }
    scrollBlockHeight() { return this.lineHeight(); }
    paint() { this.refresh(); }
    update() { super.update(); if(this.active) { if(Input.isRepeated("down"))this.smoothScrollDown(1); if(Input.isRepeated("up"))this.smoothScrollUp(1); if(Input.isRepeated("pagedown"))this.smoothScrollBy(0,this.innerHeight); if(Input.isRepeated("pageup"))this.smoothScrollBy(0,-this.innerHeight); if(Input.isTriggered("cancel")||Input.isTriggered("left"))this.onBack?.(); } }
    refresh() {
        this.contents.clear();
        const q = this._quest;
        if (!q) {
            this.changeTextColor(ColorManager.textColor(8));
            this.drawText("No quests in this category.", 0, 24, this.innerWidth, "center");
            this.resetTextColor();
            return;
        }
        const status = Q.status(q);
        let y = -this.scrollBaseY();
        this.changeTextColor(ColorManager.systemColor());
        this.drawText(q.title, 0, y, this.innerWidth, "center");
        this.resetTextColor();
        y += this.lineHeight() * 1.5;
        this.contents.fontSize=18;this.drawText('OK / →: read · ↑/↓: scroll · Esc: back',8,y,this.innerWidth-16);this.resetFontSettings();y+=this.lineHeight();
        this.drawText("Status:", 8, y, 120);
        this.changeTextColor(ColorManager.textColor(status === "completed" ? 3 : status === "failed" ? 18 : 6));
        this.drawText({ active: "Active", completed: "Complete", failed: "Failed" }[status], 128, y, this.innerWidth - 136);
        this.resetTextColor();
        y += this.lineHeight() * 1.5;
        this.changeTextColor(ColorManager.systemColor());
        this.drawText("Description", 8, y, this.innerWidth - 16);
        this.resetTextColor();
        y += this.lineHeight();
        y = this.drawWrappedText(Q.description(q), 16, y, this.innerWidth - 32);
        y += 12;
        this.changeTextColor(ColorManager.systemColor());
        this.drawText("Objectives", 8, y, this.innerWidth - 16);
        this.resetTextColor();
        y += this.lineHeight();
        q.objectives.forEach((objective, index) => {
            if (!Q.objectiveVisible(q, index)) return;
            const progress = Q.progress(q, index);
            const target = Number(objective.target) || 0;
            const done = Q.objectiveDone(q, index);
            this.changeTextColor(done ? ColorManager.textColor(3) : ColorManager.normalColor());
            const counter = target ? ` (${Math.min(progress, target)}/${target})` : "";
            y = this.drawWrappedText(`${done ? "✓" : "•"} ${objective.text}${counter}`, 16, y, this.innerWidth - 32);
            this.resetTextColor();
            if (target) { this.drawGauge(32, y - 5, this.innerWidth - 64, Math.min(progress / target, 1)); y += 14; }
        });
        y += 12;
        this.changeTextColor(ColorManager.systemColor());
        this.drawText("Reward", 8, y, this.innerWidth - 16);
        this.resetTextColor();
        y += this.lineHeight();
        y = this.drawWrappedText(q.reward, 16, y, this.innerWidth - 32);
        this._contentHeight = y + this.scrollBaseY() + 24;
    }
    drawGauge(x, y, width, rate) {
        this.contents.fillRect(x, y, width, 12, ColorManager.gaugeBackColor());
        this.contents.gradientFillRect(x + 2, y + 2, Math.floor((width - 4) * rate), 8, ColorManager.hpGaugeColor1(), ColorManager.hpGaugeColor2());
    }
    drawWrappedText(text, x, y, width) {
        let line = "";
        for (const word of String(text).split(/\s+/)) {
            const test = line ? `${line} ${word}` : word;
            if (line && this.textWidth(test) > width) { this.drawText(line, x, y, width); y += this.lineHeight(); line = word; }
            else line = test;
        }
        if (line) { this.drawText(line, x, y, width); y += this.lineHeight(); }
        return y;
    }
}

class Scene_QuestJournal extends Scene_MenuBase {
    create() {
        super.create();
        const tabHeight = this.calcWindowHeight(1, true);
        const y = this.mainAreaTop() + tabHeight;
        const height = Graphics.boxHeight - y;
        const listWidth = Math.floor(Graphics.boxWidth * 0.34);
        this._tabs = new Window_QuestTabs(new Rectangle(0, this.mainAreaTop(), Graphics.boxWidth, tabHeight));
        this._list = new Window_QuestList(new Rectangle(0, y, listWidth, height));
        this._details = new Window_QuestDetails(new Rectangle(listWidth, y, Graphics.boxWidth - listWidth, height));
        this._list.setHelpWindow(this._details);
        for (const symbol of ["all", "active", "completed", "failed"]) this._tabs.setHandler(symbol, () => this.activateList());
        this._tabs.setHandler("cancel", this.popScene.bind(this));
        this._list.setHandler("cancel", () => this.activateTabs());
        this._list.setHandler("ok", () => this.activateDetails());
        this._details.onBack = () => {this._details.deactivate();this._list.activate();};
        this.addWindow(this._tabs); this.addWindow(this._list); this.addWindow(this._details);
        this._lastTab = -1;
        this._tabs.activate(); this._tabs.select(0); this.syncTab();
    }
    update() { super.update(); this.syncTab(); if(this._list.active&&Input.isTriggered("right"))this.activateDetails(); }
    activateDetails() { this._list.deactivate(); this._tabs.deactivate(); this._details.activate(); }
    syncTab() {
        if (this._lastTab !== this._tabs.index()) {
            this._lastTab = this._tabs.index();
            this._list.setFilter(this._tabs.currentSymbol());
            this._list.callUpdateHelp();
        }
    }
    activateList() { this._tabs.deactivate(); this._list.activate(); if (this._list.index() < 0 && this._list.maxItems()) this._list.select(0); }
    activateTabs() { this._list.deactivate(); this._tabs.activate(); }
}

window.Scene_QuestJournal = Scene_QuestJournal;
})();

