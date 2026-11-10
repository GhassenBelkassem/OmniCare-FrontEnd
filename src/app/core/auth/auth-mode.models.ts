import type { DashboardRole, LoginSession } from './auth.models';

export interface StandaloneWorkspace {
  readonly role: DashboardRole;
  readonly group: string;
  readonly label: string;
  readonly description: string;
}

export interface AuthMode {
  readonly staticDemo: boolean;
  readonly workspaces: readonly StandaloneWorkspace[];
  readonly canSelectWorkspace: (role: DashboardRole) => boolean;
  readonly createWorkspaceSession: (role: DashboardRole) => LoginSession;
}
