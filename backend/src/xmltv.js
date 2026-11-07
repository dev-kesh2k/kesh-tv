// Leitor de guia de programação XMLTV em fluxo (arquivos de dezenas de MB, sem carregar tudo na memória).

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const MAX_BUFFER = 4 * 1024 * 1024;

export function decodeXml(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .trim();
}

/** "20261107013000 -0300" (ou sem fuso = UTC) → Date; inválido → null. */
export function parseXmltvTime(s) {
  const m = String(s || '').trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se = '00', tz] = m;
  let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  if (tz) {
    const sign = tz[0] === '-' ? -1 : 1;
    ms -= sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5))) * 60_000;
  }
  return Number.isNaN(ms) ? null : new Date(ms);
}

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decodeXml(m[2] ?? m[3] ?? '') : '';
};
const child = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeXml(m[1]) : '';
};

/**
 * Recebe pedaços de texto (`push`) e devolve os programas completos encontrados:
 * { channel, start, stop, title, desc }. Programas sem canal/horário válido são ignorados.
 */
export function createXmltvParser() {
  let buf = '';
  return {
    push(text) {
      buf += text;
      const out = [];
      let from = 0;
      for (;;) {
        const open = buf.indexOf('<programme', from);
        if (open < 0) {
          // O pedaço pode ter terminado no meio de "<programme": guarda o finalzinho.
          from = Math.max(from, buf.length - 10);
          break;
        }
        const close = buf.indexOf('</programme>', open);
        if (close < 0) {
          from = open;
          break;
        }
        const block = buf.slice(open, close + 12);
        from = close + 12;
        const tagEnd = block.indexOf('>');
        const tag = block.slice(0, tagEnd);
        const start = parseXmltvTime(attr(tag, 'start'));
        const stop = parseXmltvTime(attr(tag, 'stop'));
        const channel = attr(tag, 'channel');
        if (!channel || !start || !stop || stop <= start) continue;
        out.push({ channel: channel.slice(0, 120), start, stop, title: child(block, 'title').slice(0, 300) || 'Sem título', desc: child(block, 'desc').slice(0, 1000) });
      }
      // Guarda só o que pode ser o começo de um programa ainda incompleto.
      buf = buf.slice(from);
      if (buf.length > MAX_BUFFER) buf = buf.slice(-1024);
      return out;
    },
  };
}
