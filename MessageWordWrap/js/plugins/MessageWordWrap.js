/*:
 * @target MZ
 * @plugindesc v1.0.0 Wraps long message lines to the available window width.
 * @author Steven Newton
 *
 * @param enabled
 * @text Enabled
 * @type boolean
 * @default true
 *
 * @param rightMargin
 * @text Right Margin (px)
 * @desc Space kept clear at the right edge of the message text area.
 * @type number
 * @min 0
 * @default 8
 *
 * @param breakLongWords
 * @text Break Words Wider Than a Line
 * @desc Split a single word, or unspaced text such as Japanese, when it cannot fit on its own line.
 * @type boolean
 * @default true
 *
 * @help
 * RPG Maker MZ does not wrap message text, so a long Show Text line runs off
 * the window. This plugin wraps each line at word boundaries using the actual
 * available width: the full text area, or the area beside the face when a face
 * is shown. Explicit line breaks are kept; each line is wrapped separately.
 * Text codes (\C, \I, \V, ...) are measured correctly and never split from the
 * word they belong to. Pages still advance normally when text exceeds the
 * window height.
 *
 * It applies to every message, including Show Text commands and
 * DialogueSystem. No plugin commands.
 *
 * Script API:
 * MessageWordWrap.wrapLines(windowMessage, lines)  // returns wrapped lines
 */
(() => {
"use strict";
const pluginName = "MessageWordWrap";
const params = PluginManager.parameters(pluginName);
const enabled = String(params.enabled ?? "true") !== "false";
const rightMargin = Number(params.rightMargin ?? 8);
const breakLongWords = String(params.breakLongWords ?? "true") !== "false";

function availableWidth(win) {
    return Math.max(32, win.innerWidth - win.newLineX({}) - rightMargin);
}

function measure(win, text) {
    return win.textSizeEx(text).width;
}

/** Splits an over-wide token into pieces that each fit, never separating a \X[..] text code. */
function breakToken(win, token, width) {
    const pieces = [];
    const units = token.match(/\[A-Za-z]+\[[^\]]*\]|\[{}|<>^!.$]|[\s\S]/g) || [];
    let current = "";
    for (const unit of units) {
        if (current && measure(win, current + unit) > width) { pieces.push(current); current = ""; }
        current += unit;
    }
    if (current) pieces.push(current);
    return pieces;
}

function wrapLine(win, line, width) {
    if (!line || measure(win, line) <= width) return [line];
    const space = win.textWidth(" ");
    const result = [];
    let current = "", currentWidth = 0;
    for (const word of line.split(" ")) {
        const wordWidth = measure(win, word);
        if (breakLongWords && wordWidth > width) {
            if (current) { result.push(current); current = ""; currentWidth = 0; }
            const pieces = breakToken(win, word, width);
            for (const piece of pieces.slice(0, -1)) result.push(piece);
            current = pieces[pieces.length - 1] || "";
            currentWidth = measure(win, current);
            continue;
        }
        if (!current) { current = word; currentWidth = wordWidth; }
        else if (currentWidth + space + wordWidth <= width) { current += " " + word; currentWidth += space + wordWidth; }
        else { result.push(current); current = word; currentWidth = wordWidth; }
    }
    if (current || !result.length) result.push(current);
    return result;
}

window.MessageWordWrap = {
    version: "1.0.0",
    wrapLines(win, lines) {
        const width = availableWidth(win);
        return lines.flatMap(line => wrapLine(win, String(line), width));
    }
};

const _Window_Message_startMessage = Window_Message.prototype.startMessage;
Window_Message.prototype.startMessage = function() {
    if (enabled && $gameMessage._texts?.length) {
        $gameMessage._texts = MessageWordWrap.wrapLines(this, $gameMessage._texts);
    }
    _Window_Message_startMessage.call(this);
};
})();
