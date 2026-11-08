const vscode = require('vscode');
const { disable, enable } = require('./patch');

const STATE_KEY = 'enabled';

function paths(context) {
  return {
    appRoot: vscode.env.appRoot,
    extensionRoot: context.extensionPath,
  };
}

function isPermissionError(err) {
  return err && (err.code === 'EPERM' || err.code === 'EACCES');
}

async function promptReload(message) {
  const choice = await vscode.window.showInformationMessage(message, 'Reload Window');
  if (choice === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

async function runEnable(context, fromCommand) {
  try {
    const result = await enable(paths(context));
    await context.globalState.update(STATE_KEY, true);
    if (result.changed) {
      await promptReload('Thinking dropdowns will stay expanded after Cursor reloads.');
    } else if (fromCommand) {
      vscode.window.showInformationMessage('Thinking dropdowns are already set to stay expanded.');
    }
  } catch (err) {
    const message = isPermissionError(err)
      ? 'Expand Thinking could not write to the Cursor install. Relaunch Cursor as administrator once, then run Expand Thinking: Enable.'
      : `Expand Thinking could not enable itself: ${err.message}`;
    vscode.window.showErrorMessage(message);
  }
}

async function runDisable(context) {
  try {
    const result = await disable(paths(context));
    await context.globalState.update(STATE_KEY, false);
    if (result.changed) {
      await promptReload('Thinking dropdowns will collapse normally after Cursor reloads.');
    } else {
      vscode.window.showInformationMessage('Expand Thinking is already disabled.');
    }
  } catch (err) {
    const message = isPermissionError(err)
      ? 'Expand Thinking could not restore the Cursor install. Relaunch Cursor as administrator once, then run Expand Thinking: Disable.'
      : `Expand Thinking could not disable itself: ${err.message}`;
    vscode.window.showErrorMessage(message);
  }
}

async function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('cursorExpandThinking.enable', () => runEnable(context, true)),
    vscode.commands.registerCommand('cursorExpandThinking.disable', () => runDisable(context))
  );

  if (context.globalState.get(STATE_KEY) !== false) {
    await runEnable(context, false);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
