# Expand Thinking

Keeps the agent **Thinking**, **Thought**, and **Thoughts** rows expanded in Cursor chat. The IDE chat and the Agents window both stay open. A row you collapse yourself stays collapsed until Cursor replaces that block.

Cursor has no setting for this. The chat UI is part of the desktop app, so this extension patches the local install:

- `out/vs/code/electron-sandbox/workbench/workbench.html`, adding a script tag beside `workbench.js`
- `expand-thinking.js` in that same folder
- the matching checksum in `product.json`

A backup is saved as `workbench.html.expand-thinking.bak`. On later startups the extension reapplies the patch if a Cursor update removed it.

## Install

Copy this folder into Cursor’s extensions directory and name it `local.cursor-expand-thinking-0.1.0`:

- Windows: `%USERPROFILE%\.cursor\extensions\local.cursor-expand-thinking-0.1.0`
- macOS and Linux: `~/.cursor/extensions/local.cursor-expand-thinking-0.1.0`

Reload Cursor. The extension turns itself on at startup.

The install folder has to be writable. A per-user install usually is. If Enable reports that it could not write, relaunch Cursor with permission to write the app folder and run **Expand Thinking: Enable** from the Command Palette. On macOS or Linux that means a process allowed to modify the app, not a second copy of the extension.

After the first patch, quit Cursor completely and start it again. A window reload still shows “installation appears to be corrupt” because the running process is holding the old checksum.

## Commands

- **Expand Thinking: Enable** patches the running install.
- **Expand Thinking: Disable** restores `workbench.html` from the backup, updates the checksum, and removes the injected script.

## Where it works

The same code runs on Windows, macOS, and Linux, using whichever Cursor install launched it. It needs a writable app folder, so a Linux package under `/usr`, a Snap, or most AppImages will fail until that folder can be written.

It only affects desktop Cursor. It does nothing in VS Code. One running install does not patch a second install that never loads the extension.

A Cursor update that renames the workbench file or the Thinking row labels will stop the expansion until the script is updated. Other collapsible rows, such as edits and terminal output, are left alone.

## Development

```sh
node --test test/*.test.js
```

## License

Copyright (C) 2026 the Expand Thinking authors

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

The full license is in [LICENSE](LICENSE).
