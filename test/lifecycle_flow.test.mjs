import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Phase 3 Lifecycle Integration: Window Closing, Safe Exit, and Guards', () => {
  let mainSrc;
  let preloadSrc;
  let topBarSrc;
  let welcomeSrc;
  let appSrc;

  before(() => {
    mainSrc = fs.readFileSync(path.join(rootDir, 'packages/tok-electron/src/main.ts'), 'utf-8');
    preloadSrc = fs.readFileSync(path.join(rootDir, 'packages/tok-electron/src/preload.ts'), 'utf-8');
    topBarSrc = fs.readFileSync(path.join(rootDir, 'packages/tok-ui/src/components/TopSystemBar.ts'), 'utf-8');
    welcomeSrc = fs.readFileSync(path.join(rootDir, 'packages/tok-ui/src/components/WelcomeModal.ts'), 'utf-8');
    appSrc = fs.readFileSync(path.join(rootDir, 'packages/tok-ui/src/app.ts'), 'utf-8');
  });

  test('1. IPC contract declares closeWindow and quitApp in preload bridge', () => {
    assert.ok(preloadSrc.includes('closeWindow: () => Promise<void>;'), 'Preload interface must declare closeWindow');
    assert.ok(preloadSrc.includes('quitApp: () => Promise<void>;'), 'Preload interface must declare quitApp');
    assert.ok(preloadSrc.includes("ipcRenderer.invoke('tok:close-window')"), 'tokIpc must invoke tok:close-window');
    assert.ok(preloadSrc.includes("ipcRenderer.invoke('tok:quit-app')"), 'tokIpc must invoke tok:quit-app');
  });

  test('2. Main process registers secure handlers for tok:close-window and tok:quit-app', () => {
    assert.ok(mainSrc.includes("handle('tok:close-window'"), 'Main must handle tok:close-window securely');
    assert.ok(mainSrc.includes("handle('tok:quit-app'"), 'Main must handle tok:quit-app securely');
  });

  test('3. Window close guard checks renderer dirty state and prompts with 3 choices', () => {
    assert.ok(mainSrc.includes("win.on('close'"), 'Main window must listen to close event');
    assert.ok(mainSrc.includes('e.preventDefault()'), 'Close event must be prevented until confirmed');
    assert.ok(mainSrc.includes('isDirty'), 'Close event must query renderer dirty state');
    assert.ok(mainSrc.includes("buttons: ['שמור וצא', 'צא ללא שמירה', 'ביטול']"), 'Close dialog must present 3 choices: save, discard, cancel');
  });

  test('4. Duplicate close requests and deadlocks are prevented with active prompt guard', () => {
    assert.ok(mainSrc.includes('isClosingPromptActive'), 'Main process must guard against concurrent duplicate close dialogs');
    assert.ok(appSrc.includes('isClosingInProgress'), 'Renderer App must guard against re-entrant close requests');
  });

  test('5. TopSystemBar and Menu provide accessible Exit command and shortcut Ctrl+Q', () => {
    assert.ok(topBarSrc.includes("action: 'quit-app'"), 'TopSystemBar MENU_ITEMS must contain quit-app action');
    assert.ok(topBarSrc.includes("shortcut: 'Ctrl+Q'"), 'TopSystemBar must show Ctrl+Q shortcut');
    assert.ok(appSrc.includes("case 'quit-app':"), 'App handleSystemAction must handle quit-app');
    assert.ok(appSrc.includes("case 'exit':"), 'App handleSystemAction must handle exit');
  });

  test('6. Global keyboard listeners support both English (Ctrl+Q) and Hebrew (Ctrl+ק) exit shortcuts', () => {
    assert.ok(appSrc.includes("code === 'KeyQ'"), 'App keydown listener must capture KeyQ');
    assert.ok(appSrc.includes("key === 'ק'"), 'App keydown listener must capture Hebrew letter ק');
  });

  test('7. WelcomeModal allows safe exit and does not trap user when no document is open', () => {
    assert.ok(!welcomeSrc.includes('if (!this.hasOpenDocument) return;'), 'WelcomeModal must not unconditionally block closing');
    assert.ok(welcomeSrc.includes('onExitApp'), 'WelcomeModal must invoke onExitApp callback on close without document');
    assert.ok(welcomeSrc.includes('closeOrExitBtn'), 'WelcomeModal top strip must include close/exit button');
  });

  test('8. Lifecycle state synchronization: window.__tokIsDirty and appInstance', () => {
    assert.ok(appSrc.includes('(window as any).appInstance = this'), 'App must expose appInstance for main window inspection');
    assert.ok(appSrc.includes('(window as any).__tokIsDirty = dirty'), 'setDirty must synchronize __tokIsDirty flag');
  });
});
