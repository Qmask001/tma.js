import { createSingleton } from '@/misc/createSingleton.js';

import { createMiniAppsEventEmitter } from './createMiniAppsEventEmitter.js';
import type { MiniAppsEventEmitter } from '../types.js';

const [get, resetMiniAppsEventEmitter] = createSingleton(
  (reset) => {
    const [emitter, cleanup] = createMiniAppsEventEmitter();

    // Rewire "off" method and make it reset singleton if no event listeners left.
    const off = emitter.off.bind(emitter);
    emitter.off = (event, listener) => {
      const { count } = emitter;
      off(event, listener);

      // If event emitter now has no listeners, we can perform a reset.
      if (count && !emitter.count) {
        reset();
      }
    };

    return [emitter, cleanup] as const;
  },
  ([, cleanup]) => cleanup(),
);

/**
 * Returns Mini Apps event emitter singleton.
 */
export function miniAppsEventEmitter(): MiniAppsEventEmitter {
  return get()[0];
}

export { resetMiniAppsEventEmitter };
