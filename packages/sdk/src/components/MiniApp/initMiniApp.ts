import { createComponentInitFn } from '@/misc/createComponentInitFn/createComponentInitFn.js';

import { MiniApp } from './MiniApp.js';

/**
 * @returns A new initialized instance of the `MiniApp` class.
 * @see MiniApp
 */
export const initMiniApp = createComponentInitFn(
  'miniApp',
  ({
    themeParams,
    botInline = false,
    state = {
      bgColor: themeParams.bgColor || '#ffffff',
      headerColor: themeParams.headerBgColor || '#000000',
    },
    ...rest
  }) => new MiniApp({ ...rest, ...state, botInline }),
);
