import { EventEmitter } from '@tma.js/event-emitter';
import { compareVersions, type Version } from '@tma.js/utils';
import { isRGB, isColorDark, type RGB } from '@tma.js/colors';
import {
  postEvent as defaultPostEvent,
  supports,
  request,
  type PhoneRequestedStatus,
  type WriteAccessRequestedStatus,
  type InvoiceStatus,
  type PostEvent,
} from '@tma.js/bridge';
import type { Platform } from '@tma.js/launch-params';

import { formatURL } from '../../url.js';
import { State } from '../../state/index.js';
import { createSupportsFunc, createSupportsParamFunc, type SupportsFunc } from '../../supports.js';

import type { ColorScheme } from '../../types.js';
import type { WebAppEvents, WebAppHeaderColor, WebAppState } from './types.js';

/**
 * Provides common Mini Apps functionality not covered by other system
 * components.
 */
export class WebApp {
  private readonly ee = new EventEmitter<WebAppEvents>();

  private readonly state: State<WebAppState>;

  constructor(
    headerColor: WebAppHeaderColor,
    backgroundColor: RGB,
    private readonly currentVersion: Version,
    private readonly currentPlatform: Platform,
    private readonly createRequestId: () => string,
    private readonly postEvent: PostEvent = defaultPostEvent,
  ) {
    this.state = new State({
      backgroundColor,
      headerColor,
    }, this.ee);
    this.supports = createSupportsFunc(currentVersion, {
      openInvoice: 'web_app_open_invoice',
      readTextFromClipboard: 'web_app_read_text_from_clipboard',
      setHeaderColor: 'web_app_set_header_color',
      setBackgroundColor: 'web_app_set_background_color',
      requestPhoneAccess: 'web_app_request_phone',
      requestWriteAccess: 'web_app_request_write_access',
    });
    this.supportsParam = createSupportsParamFunc(currentVersion, {
      'setHeaderColor.color': ['web_app_set_header_color', 'color'],
      'openLink.tryInstantView': ['web_app_open_link', 'try_instant_view'],
    });
  }

  /**
   * Returns current application background color.
   */
  get backgroundColor(): RGB {
    return this.state.get('backgroundColor');
  }

  /**
   * Returns current application color scheme. This value is
   * computed based on the current background color.
   */
  get colorScheme(): ColorScheme {
    return isColorDark(this.backgroundColor) ? 'dark' : 'light';
  }

  /**
   * Closes the Mini App.
   */
  close(): void {
    this.postEvent('web_app_close');
  }

  /**
   * Returns current application header color.
   */
  get headerColor(): WebAppHeaderColor {
    return this.state.get('headerColor');
  }

  /**
   * Returns true if passed version is more than or equal to current
   * Mini App version.
   * @param version - compared version.
   */
  isVersionAtLeast(version: Version): boolean {
    return compareVersions(version, this.version) >= 0;
  }

  /**
   * Opens a link in an external browser. The Mini App will not be closed.
   *
   * Note that this method can be called only in response to the user
   * interaction with the Mini App interface (e.g. click inside the Mini App
   * or on the main button).
   * @param url - URL to be opened.
   * @param tryInstantView
   */
  openLink(url: string, tryInstantView?: boolean): void {
    const formattedUrl = formatURL(url);

    // If method is not supported, we are doing it in legacy way.
    if (!supports('web_app_open_link', this.version)) {
      window.open(formattedUrl, '_blank');
      return;
    }

    // Otherwise, do it normally.
    return this.postEvent('web_app_open_link', {
      url: formattedUrl,
      ...(typeof tryInstantView === 'boolean' ? { try_instant_view: tryInstantView } : {}),
    });
  }

  /**
   * Opens a Telegram link inside Telegram app. The Mini App will be closed.
   * It expects passing link in full format, with hostname "t.me".
   * @param url - URL to be opened.
   * @throws {Error} URL has not allowed hostname.
   */
  openTelegramLink(url: string): void {
    const { hostname, pathname, search } = new URL(formatURL(url));

    if (hostname !== 't.me') {
      throw new Error(`URL has not allowed hostname: ${hostname}. Only "t.me" is allowed`);
    }

    if (!supports('web_app_open_tg_link', this.version)) {
      window.location.href = url;
      return;
    }

    return this.postEvent('web_app_open_tg_link', { path_full: pathname + search });
  }

  /**
   * Opens an invoice using its url. It expects passing link in full format,
   * with hostname "t.me".
   * @param url - invoice URL.
   */
  async openInvoice(url: string): Promise<InvoiceStatus> {
    // TODO: Allow opening with slug.
    const { hostname, pathname } = new URL(formatURL(url));

    if (hostname !== 't.me') {
      throw new Error(`Incorrect hostname: ${hostname}`);
    }
    // Valid examples:
    // "/invoice/my-slug"
    // "/$my-slug"
    const match = pathname.match(/^\/(\$|invoice\/)([A-Za-z0-9\-_=]+)$/);

    if (match === null) {
      throw new Error('Link pathname has incorrect format. Expected to receive "/invoice/slug" or "/$slug"');
    }
    const [, , slug] = match;

    const result = await request('web_app_open_invoice', { slug }, 'invoice_closed', {
      postEvent: this.postEvent,
      capture: ({ slug: eventSlug }) => slug === eventSlug,
    });

    return result.status;
  }

  /**
   * Adds new event listener.
   */
  on = this.ee.on.bind(this.ee);

  /**
   * Removes event listener.
   */
  off = this.ee.off.bind(this.ee);

  /**
   * Returns current Mini App platform.
   */
  get platform(): Platform {
    return this.currentPlatform;
  }

  /**
   * Informs the Telegram app that the Mini App is ready to be displayed.
   *
   * It is recommended to call this method as early as possible, as soon as
   * all essential interface elements loaded. Once this method called,
   * the loading placeholder is hidden and the Mini App shown.
   *
   * If the method not called, the placeholder will be hidden only when
   * the page fully loaded.
   */
  ready(): void {
    this.postEvent('web_app_ready');
  }

  /**
   * Reads text from clipboard and returns string or null. null is returned
   * in cases:
   * - Value in clipboard is not text
   * - Access to clipboard is not allowed
   */
  async readTextFromClipboard(): Promise<string | null> {
    // TODO: Generate request id.
    const { data = null } = await request(
      'web_app_read_text_from_clipboard',
      { req_id: this.createRequestId() },
      'clipboard_text_received',
      { postEvent: this.postEvent },
    );

    return data;
  }

  /**
   * Requests current user phone access.
   */
  async requestPhoneAccess(): Promise<PhoneRequestedStatus> {
    const { status } = await request('web_app_request_phone', 'phone_requested', {
      postEvent: this.postEvent,
    });

    return status;
  }

  /**
   * Requests write message access to current user.
   */
  async requestWriteAccess(): Promise<WriteAccessRequestedStatus> {
    const { status } = await request('web_app_request_write_access', 'write_access_requested', {
      postEvent: this.postEvent,
    });

    return status;
  }

  /**
   * A method used to send data to the bot. When this method called, a
   * service message sent to the bot containing the data of the
   * length up to 4096 bytes, and the Mini App closed. See the field
   * `web_app_data` in the class Message.
   *
   * This method is only available for Mini Apps launched via a Keyboard button.
   * @param data - data to send to bot.
   * @throws {Error} data has incorrect size.
   */
  sendData(data: string): void {
    // Firstly, compute passed text size in bytes.
    const { size } = new Blob([data]);
    if (size === 0 || size > 4096) {
      throw new Error(`Passed data has incorrect size: ${size}`);
    }
    this.postEvent('web_app_data_send', { data });
  }

  /**
   * Updates current application header color.
   * FIXME: Has no effect on desktop, works incorrectly on Android.
   *  Issues:
   *  https://github.com/Telegram-Mini-Apps/tma.js/issues/9
   *  https://github.com/Telegram-Mini-Apps/tma.js/issues/8
   * @param color - color key or RGB color.
   */
  setHeaderColor(color: WebAppHeaderColor) {
    this.postEvent('web_app_set_header_color', isRGB(color) ? { color } : { color_key: color });
    this.state.set('headerColor', color);
  }

  /**
   * Updates current application background color.
   * FIXME: Has no effect on desktop, works incorrectly in Android.
   *  Issues:
   *  https://github.com/Telegram-Mini-Apps/tma.js/issues/9
   *  https://github.com/Telegram-Mini-Apps/tma.js/issues/8
   * @param color - RGB color.
   */
  setBackgroundColor(color: RGB) {
    this.postEvent('web_app_set_background_color', { color });
    this.state.set('backgroundColor', color);
  }

  /**
   * Checks if specified method is supported by current component.
   */
  supports: SupportsFunc<
    | 'openInvoice'
    | 'readTextFromClipboard'
    | 'setHeaderColor'
    | 'setBackgroundColor'
    | 'requestWriteAccess'
    | 'requestPhoneAccess'
  >;

  /**
   * Checks if specified method parameter is supported by current component.
   */
  supportsParam: SupportsFunc<'setHeaderColor.color' | 'openLink.tryInstantView'>;

  /**
   * Current Mini App version. This property is used by other components to check if
   * some functionality is available on current device.
   */
  get version(): Version {
    return this.currentVersion;
  }
}
