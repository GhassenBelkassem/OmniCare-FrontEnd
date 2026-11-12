import type { DashboardRole } from './auth.models';
import { createDemoSession, DEMO_WORKSPACES, isDemoWorkspaceRole } from './demo-auth';
import type { AuthMode } from './auth-mode.models';

/** Compile-time static-demo authentication implementation. */
export const AUTH_MODE: AuthMode = Object.freeze({
  staticDemo: true,
  workspaces: DEMO_WORKSPACES,
  canSelectWorkspace: (role: DashboardRole) => isDemoWorkspaceRole(role),
  createWorkspaceSession: (role: DashboardRole) => {
    if (!isDemoWorkspaceRole(role)) {
      throw new Error('The selected standalone workspace is not available.');
    }
    return createDemoSession(role);
  },
});
