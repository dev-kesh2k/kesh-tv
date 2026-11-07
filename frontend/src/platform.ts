// Onde o app está rodando: navegador, iPhone/iPad, celular Android, app Android (WebView) ou TV.
// Vira classes no <html> (is-tv, is-app, is-ios, is-android) para o visual se adaptar.

export interface Platform {
  tv: boolean;
  app: boolean; // dentro do app Android (WebView do Kesh TV)
  ios: boolean;
  android: boolean;
}

declare global {
  interface Window {
    /** Ponte do app Android (addJavascriptInterface). */
    KeshNative?: { isTv?: () => boolean; version?: () => string };
  }
}

const TV_UA = /Android TV|GoogleTV|\bAFT[A-Z0-9]|BRAVIA|SMART-?TV|SmartTV|Tizen|Web0S|webOS|NetCast|HbbTV|CrKey|Roku|Viera|AQUOS|PhilipsTV|DTV/i;
const TV_OVERRIDE_KEY = 'kesh-tv:modo-tv'; // '1' força TV, '0' força normal

/** Detecção pura (testável): user agent + sinais do app nativo + escolha manual. */
export function detectPlatform(ua: string, nativeIsTv?: boolean | null, override?: string | null): Platform {
  const app = /KeshTV-Android/.test(ua) || nativeIsTv !== undefined;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
  const android = /Android/.test(ua);
  let tv = typeof nativeIsTv === 'boolean' ? nativeIsTv : TV_UA.test(ua);
  if (override === '1') tv = true;
  if (override === '0') tv = false;
  return { tv, app, ios, android };
}

function nativeTv(): boolean | undefined {
  try {
    return window.KeshNative?.isTv ? Boolean(window.KeshNative.isTv()) : undefined;
  } catch {
    return undefined;
  }
}

export const platform: Platform = detectPlatform(navigator.userAgent, nativeTv(), new URLSearchParams(location.search).get('tv') ?? localStorage.getItem(TV_OVERRIDE_KEY));

/** Liga/desliga o modo TV manualmente (null = automático) e recarrega. */
export function setTvMode(value: boolean | null) {
  if (value === null) localStorage.removeItem(TV_OVERRIDE_KEY);
  else localStorage.setItem(TV_OVERRIDE_KEY, value ? '1' : '0');
  location.reload();
}

export const tvModeSetting = (): 'auto' | 'on' | 'off' => {
  const v = localStorage.getItem(TV_OVERRIDE_KEY);
  return v === '1' ? 'on' : v === '0' ? 'off' : 'auto';
};

export function applyPlatformClasses() {
  const c = document.documentElement.classList;
  c.toggle('is-tv', platform.tv);
  c.toggle('is-app', platform.app);
  c.toggle('is-ios', platform.ios);
  c.toggle('is-android', platform.android);
}
