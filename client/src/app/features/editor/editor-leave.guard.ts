import { CanDeactivateFn } from '@angular/router';
import { EditorShell } from './editor-shell';

/** Saves pending edits before leaving the editor; asks before discarding if saving fails. */
export const editorLeaveGuard: CanDeactivateFn<EditorShell> = async (shell) => {
  if (await shell.store.flush()) return true;
  return window.confirm('Your latest changes could not be saved. Leave anyway and lose them?');
};
