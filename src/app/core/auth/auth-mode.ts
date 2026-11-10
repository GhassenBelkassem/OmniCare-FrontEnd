import type { AuthMode } from './auth-mode.models';

/** Production authentication mode. Replaced only by the isolated static-demo build. */
export const AUTH_MODE: AuthMode = Object.freeze({
  staticDemo: false,
  workspaces: [],
  canSelectWorkspace: () => false,
  createWorkspaceSession: () => {
    throw new Error('Standalone workspace authentication is not available in this build.');
  },
});
