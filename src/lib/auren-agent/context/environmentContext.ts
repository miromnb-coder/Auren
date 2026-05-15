import type { AurenEnvironmentContext } from '../core/types';

export function getEnvironmentContext(): AurenEnvironmentContext {
  return {
    now: new Date().toISOString(),
    platform: 'native',
  };
}
