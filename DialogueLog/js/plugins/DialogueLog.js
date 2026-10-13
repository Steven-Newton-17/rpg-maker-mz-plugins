/*:
 * @target MZ
 * @plugindesc v1.0.0 Conversation log in the menu; in playtests also a coverage page of lines never heard.
 * @author Steven Newton
 * @orderAfter DialogueSystem
 *
 * @param menuCommandName
 * @text Menu Command Name
 * @type string
 * @default Log
 *
 * @param maxEntries
 * @text Lines Kept
 * @desc How many recent lines (and choices) the log keeps in the save.
 * @type number
 * @min 50
 * @default 400
 *
 * @param coverageIgnore
 * @text Coverage Ignores
 * @desc Conversations whose id matches this pattern are left out of coverage (drafts, tests, examples).
 * @type string
 * @default ^d_|test|^example
 *
 * @help
 * Requires DialogueSystem 1.6 or later (load it above this plugin).
 *
 * Log: every spoken line and every choice Ava picks is written to the log (kept in the save), newest at the
 * bottom. Open it from the menu. Up/Down scroll, Page Up/Down (Q/W) jump, Escape closes.
 *
 * Coverage (playtests only, Shift switches pages): how many lines of each conversation Ava has heard, and which
 * lines nobody has heard yet in this save. Use it after a playthrough to find dialogue you missed.
 * Conversations whose id matches the Coverage Ignores pattern (drafts, tests, examples) are left out.
 *
 * Script: DialogueLog.entries(), DialogueLog.coverage()
 */
(() => {
"use strict";
const pluginName = "DialogueLog";
const params = PluginManager.parameters(pluginName);
const menuCommandName = String(params.menuCommandName || "Log");
const maxEntries = Math.max(50, Number(params.maxEntries) || 400);
const ignore = (() => { try { return new RegExp(String(params.coverageIgnore ?? "^d_|test|^example")); } catch { return /^d_|test|^example/; } })();
const DS = window.DialogueSystem;
if (!DS) throw new Error("DialogueLog requires DialogueSystem above it.");

/* ---------- recording ---------- */
const plain = text => String(text ?? "").replace(/\\[A-Za-z]+\[[^\]]*\]/g, "").replace(/\\[{}.|!><^$]/g, "").replace(/\\\\/g, "\\");
const store = () => ($gameSystem._dialogueLog ||= { entries: [], conversation: 0 });
const push = entry => { const log = store(); log.entries.push(entry); if (log.entries.length > maxEntries) log.entries.splice(0, log.entries.length - maxEntries); };
const speakerName = node => {
    if (node.displayName != null) return String(node.displayName);
    if (node.speaker && window.CharacterPresentation) return CharacterPresentation.resolve(node.speaker, node.expression)?.displayName || "";
    return "";
};

DS.on("dialogueStart", () => { if (window.$gameSystem) store().conversation++; });
DS.on("nodeEnter", ({ dialogueId, nodeId, node }) => {
    if (!window.$gameSystem) return;
    const lines = (Array.isArray(node.text) ? node.text : [node.text ?? ""]).map(plain);
    if (!lines.some(line => line.trim())) return;
    push({ c: store().conversation, d: dialogueId, n: nodeId, who: speakerName(node), text: lines.join(" ").replace(/\s+/g, " ").trim() });
});
DS.on("choiceSelected", ({ dialogueId, choice }) => {
    if (!window.$gameSystem || !choice) return;
    push({ c: store().conversation, d: dialogueId, choice: true, text: plain(choice.text) });
});

/* ---------- coverage ---------- */
const spoken = node => (Array.isArray(node.text) ? node.text : [node.text ?? ""]).some(line => String(line).trim());
function coverage() {
    const rows = [];
    let heard = 0, total = 0;
    for (const dialogue of DS.dialogues()) {
        if (ignore.test(dialogue.id)) continue;
        const nodes = Object.entries(dialogue.nodes || {}).filter(([, node]) => spoken(node));
        if (!nodes.length) continue;
        const missing = nodes.filter(([id]) => !DS.heard(dialogue.id, id));
        heard += nodes.length - missing.length; total += nodes.length;
        if (missing.length) rows.push({ id: dialogue.id, name: dialogue.name || dialogue.id, total: nodes.length, missing: missing.map(([id, node]) => ({ id, text: plain([].concat(node.text).join(" ")) })) });
    }
    rows.sort((a, b) => a.id.localeCompare(b.id));
    return { heard, total, rows };
}

window.DialogueLog = { version: "1.0.0", entries: () => store().entries.slice(), coverage };

/* ---------- menu ---------- */
const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
Window_MenuCommand.prototype.addOriginalCommands = function() {
    _Window_MenuCommand_addOriginalCommands.call(this);
    this.addCommand(menuCommandName, "dialogueLog", true);
};
const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
Scene_Menu.prototype.createCommandWindow = function() {
    _Scene_Menu_createCommandWindow.call(this);
    this._commandWindow.setHandler("dialogueLog", () => SceneManager.push(Scene_DialogueLog));
};

/* ---------- window: a scrolling list of pre-wrapped rows ---------- */
class Window_DialogueLog extends Window_Base {
    initialize(rect) { super.initialize(rect); this._rows = []; this._top = 0; }
    rowHeight() { return this.lineHeight(); }
    visibleRows() { return Math.floor(this.innerHeight / this.rowHeight()); }
    maxTop() { return Math.max(0, this._rows.length - this.visibleRows()); }
    /** rows: [{ text, color?, indent?, name?, rule? }]; a row with a name draws it first in the system color */
    setRows(rows, atBottom) { this._rows = rows; this._top = atBottom ? this.maxTop() : 0; this.refresh(); }
    wrap(text, width) {
        const out = []; let line = "";
        for (const word of String(text).split(" ")) {
            const test = line ? line + " " + word : word;
            if (line && this.textWidth(test) > width) { out.push(line); line = word; } else line = test;
        }
        if (line) out.push(line);
        return out.length ? out : [""];
    }
    scrollBy(delta) {
        const next = Math.max(0, Math.min(this.maxTop(), this._top + delta));
        if (next !== this._top) { this._top = next; this.refresh(); SoundManager.playCursor(); }
    }
    refresh() {
        this.contents.clear();
        const h = this.rowHeight();
        this._rows.slice(this._top, this._top + this.visibleRows()).forEach((row, i) => {
            const y = i * h;
            if (row.rule) { this.contents.paintOpacity = 64; this.contents.fillRect(0, y + h / 2, this.innerWidth, 2, ColorManager.normalColor()); this.contents.paintOpacity = 255; return; }
            let x = row.indent || 0;
            if (row.name) { this.changeTextColor(ColorManager.systemColor()); this.drawText(row.name, x, y, this.innerWidth); x += this.textWidth(row.name + "  "); }
            this.changeTextColor(row.color ?? ColorManager.normalColor());
            this.drawText(row.text, x, y, this.innerWidth - x);
        });
        this.resetTextColor();
        if (this._top > 0) this.drawText("▲", 0, 0, this.innerWidth, "right");
        if (this._top < this.maxTop()) this.drawText("▼", 0, (this.visibleRows() - 1) * h, this.innerWidth, "right");
    }
}

class Scene_DialogueLog extends Scene_MenuBase {
    create() {
        super.create();
        const help = this.helpAreaHeight();
        this._helpWindow = new Window_Help(new Rectangle(0, this.mainAreaTop(), Graphics.boxWidth, help));
        this.addWindow(this._helpWindow);
        const top = this.mainAreaTop() + help;
        this._logWindow = new Window_DialogueLog(new Rectangle(0, top, Graphics.boxWidth, Graphics.boxHeight - top));
        this.addWindow(this._logWindow);
        this._page = "log";
        this.show();
    }
    helpAreaHeight() { return this.calcWindowHeight(1, false); }
    canCover() { return $gameTemp.isPlaytest(); }
    show() {
        const w = this._logWindow, width = w.innerWidth - 24;
        const rows = [];
        if (this._page === "log") {
            this._helpWindow.setText(menuCommandName + (this.canCover() ? "      (Shift: coverage)" : ""));
            let last = null;
            for (const entry of store().entries) {
                if (last !== null && entry.c !== last) rows.push({ rule: true });
                last = entry.c;
                if (entry.choice) { for (const line of w.wrap("▸ " + entry.text, width)) rows.push({ text: line, color: ColorManager.textColor(24), indent: 12 }); continue; }
                // the name sits in front of the first line; wrapped lines line up under the text
                const lead = entry.who ? w.textWidth(entry.who + "  ") : 0;
                w.wrap(entry.text, width - lead).forEach((line, i) => rows.push(i ? { text: line, indent: lead } : { name: entry.who, text: line }));
            }
            if (!rows.length) rows.push({ text: "Nothing said yet.", color: ColorManager.textColor(8) });
            w.setRows(rows, true);
        } else {
            const cov = coverage(), pct = cov.total ? Math.round(cov.heard / cov.total * 100) : 100;
            this._helpWindow.setText(`Coverage: heard ${cov.heard} of ${cov.total} lines (${pct}%)      (Shift: log)`);
            for (const row of cov.rows) {
                rows.push({ text: `${row.id} — ${row.missing.length} of ${row.total} not heard`, color: ColorManager.systemColor() });
                for (const miss of row.missing) for (const [i, line] of w.wrap(`${miss.id}: ${miss.text}`, width).entries()) rows.push({ text: line, indent: i ? 36 : 12, color: ColorManager.textColor(8) });
            }
            if (!rows.length) rows.push({ text: "Every line has been heard in this save.", color: ColorManager.textColor(3) });
            w.setRows(rows, false);
        }
    }
    update() {
        super.update();
        const w = this._logWindow, page = Math.max(1, w.visibleRows() - 1);
        if (Input.isRepeated("down")) w.scrollBy(1);
        else if (Input.isRepeated("up")) w.scrollBy(-1);
        else if (Input.isTriggered("pagedown")) w.scrollBy(page);
        else if (Input.isTriggered("pageup")) w.scrollBy(-page);
        else if (TouchInput.wheelY) w.scrollBy(TouchInput.wheelY > 0 ? 3 : -3);
        if (this.canCover() && Input.isTriggered("shift")) { this._page = this._page === "log" ? "coverage" : "log"; SoundManager.playCursor(); this.show(); }
        if (Input.isTriggered("cancel") || TouchInput.isCancelled()) { SoundManager.playCancel(); this.popScene(); }
    }
}
window.Scene_DialogueLog = Scene_DialogueLog;
})();
