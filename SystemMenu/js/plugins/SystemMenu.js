/*:
 * @target MZ
 * @plugindesc v1.0.0 Groups Save, Load, Options, and Game End under one System menu.
 * @author Steven Newton
 *
 * @param menuCommandName
 * @text Main Menu Command
 * @type string
 * @default System
 *
 * @param saveCommandName
 * @text Save Command
 * @type string
 * @default Save
 *
 * @param loadCommandName
 * @text Load Command
 * @type string
 * @default Load
 *
 * @param optionsCommandName
 * @text Options Command
 * @type string
 * @default Options
 *
 * @param gameEndCommandName
 * @text Game End Command
 * @type string
 * @default Game End
 *
 * @param manualSaveSlots
 * @text Manual Save Slots
 * @type number
 * @min 1
 * @max 999
 * @default 100
 * @desc Autosave remains separate from this number.
 *
 * @help
 * Replaces the main menu's separate Save, Options, and Game End entries with
 * one System entry. Its submenu contains Save, Load, Options, and Game End.
 *
 * This plugin changes menu presentation and the number of available savefiles.
 * It uses RPG Maker MZ's standard scenes and save restrictions.
 */
(() => {
"use strict";

const pluginName = "SystemMenu";
const params = PluginManager.parameters(pluginName);
const labels = {
    system: String(params.menuCommandName || "System"),
    save: String(params.saveCommandName || "Save"),
    load: String(params.loadCommandName || "Load"),
    options: String(params.optionsCommandName || "Options"),
    gameEnd: String(params.gameEndCommandName || "Game End")
};
const manualSaveSlots = Math.max(1, Number(params.manualSaveSlots) || 100);

// MZ reserves savefile ID 0 for autosave. Adding one exposes manual File 100.
DataManager.maxSavefiles = function() {
    return manualSaveSlots + 1;
};

const _Window_MenuCommand_addOriginalCommands =
    Window_MenuCommand.prototype.addOriginalCommands;
Window_MenuCommand.prototype.addOriginalCommands = function() {
    _Window_MenuCommand_addOriginalCommands.call(this);
    this.addCommand(labels.system, "systemMenu", true);
};

Window_MenuCommand.prototype.addOptionsCommand = function() {};
Window_MenuCommand.prototype.addSaveCommand = function() {};
Window_MenuCommand.prototype.addGameEndCommand = function() {};

const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
Scene_Menu.prototype.createCommandWindow = function() {
    _Scene_Menu_createCommandWindow.call(this);
    this._commandWindow.setHandler("systemMenu", () => SceneManager.push(Scene_SystemMenu));
};

class Window_SystemMenuCommand extends Window_Command {
    makeCommandList() {
        this.addCommand(labels.save, "save", $gameSystem.isSaveEnabled());
        this.addCommand(labels.load, "load", DataManager.isAnySavefileExists());
        this.addCommand(labels.options, "options", true);
        this.addCommand(labels.gameEnd, "gameEnd", true);
    }
}

class Scene_SystemMenu extends Scene_MenuBase {
    create() {
        super.create();
        this.createCommandWindow();
    }

    createCommandWindow() {
        const width = this.mainCommandWidth();
        const height = this.calcWindowHeight(4, true);
        const x = Math.floor((Graphics.boxWidth - width) / 2);
        const y = Math.floor((Graphics.boxHeight - height) / 2);
        this._commandWindow = new Window_SystemMenuCommand(
            new Rectangle(x, y, width, height)
        );
        this._commandWindow.setHandler("save", () => SceneManager.push(Scene_Save));
        this._commandWindow.setHandler("load", () => SceneManager.push(Scene_Load));
        this._commandWindow.setHandler("options", () => SceneManager.push(Scene_Options));
        this._commandWindow.setHandler("gameEnd", () => SceneManager.push(Scene_GameEnd));
        this._commandWindow.setHandler("cancel", this.popScene.bind(this));
        this.addWindow(this._commandWindow);
    }
}

window.Scene_SystemMenu = Scene_SystemMenu;
})();
