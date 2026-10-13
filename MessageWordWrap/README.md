# Message Word Wrap for RPG Maker MZ

Version **1.0.0**. MZ's message window does not wrap text; long lines run off
the edge. This plugin wraps every message, including Show Text and
DialogueSystem, before it is displayed.

- Uses the real available width: the text area minus the face, when one is shown.
- Keeps explicit line breaks and wraps each line separately.
- Measures text codes (`\C[n]`, `\I[n]`, `\V[n]`, …) correctly.
- Pages advance normally when text is taller than the window.

Parameters: **Enabled**, **Right Margin (px)**, and **Break Words Wider Than a
Line** (also handles unspaced text such as Japanese).

Load it anywhere after the core engine plugins; it only extends
`Window_Message.startMessage`. Script API:
`MessageWordWrap.wrapLines(windowMessage, lines)`.
