import { Injectable } from '@angular/core';

export type SensitiveStateReset = () => void;
export type SessionCleanupPhase = 'CONNECTION' | 'STATE';

/** Registers only root-scoped state that can outlive a workspace route. */
@Injectable({ providedIn: 'root' })
export class SensitiveStateRegistry {
  private readonly connectionResets = new Set<SensitiveStateReset>();
  private readonly stateResets = new Set<SensitiveStateReset>();

  register(reset: SensitiveStateReset, phase: SessionCleanupPhase = 'STATE'): void {
    (phase === 'CONNECTION' ? this.connectionResets : this.stateResets).add(reset);
  }

  clearAll(): void {
    for (const reset of [...this.connectionResets, ...this.stateResets]) {
      try {
        reset();
      } catch {
        // One feature cleanup must never prevent credentials and other state from being cleared.
      }
    }
  }
}
