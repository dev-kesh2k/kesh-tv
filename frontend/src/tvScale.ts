// Modo TV: a página é desenhada para 1280 px de largura e a própria TV/WebView amplia até a tela real
// (meta viewport width=1280). Assim o app ocupa a mesma fração da tela em qualquer TV — 32" a 100",
// 720p a 4K — e o layout, as alturas (vh) e os breakpoints funcionam como num computador de 1280 px.
import { platform } from './platform';

export const TV_DESIGN_WIDTH = 1280;

export function installTvScale() {
  if (!platform.tv) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.content = `width=${TV_DESIGN_WIDTH}, user-scalable=no, viewport-fit=cover`;
}
