// Conversão na hora (ffmpeg → HLS) para arquivos que o navegador não toca: MKV, AVI, HEVC/10-bit, Opus, AC3...
// Vídeo H.264 de 8 bits só é reempacotado (quase sem CPU); o resto vira H.264. Áudio sempre AAC estéreo.
// Uma conversão por usuário; o ffmpeg pausa quando está 3 min à frente do que está sendo assistido.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HttpError } from './db.js';
import { assertPublic, DEFAULT_UA, safeFetch } from './net.js';

const ROOT = path.join(os.tmpdir(), 'kesh-convert');
const SEG = 6;
const MAX_SESSIONS = 4;
const MAX_ENCODES = 2; // conversões de vídeo (as que gastam CPU)
const AHEAD_SEGMENTS = 30; // ~3 min à frente → pausa
const IDLE_MS = 3 * 60_000;
const sessions = new Map();
const probes = new Map();

fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });

function run(args, timeoutMs) {
  return new Promise((resolve) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => {
      if (err.length < 20000) err += d;
    });
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.on('close', () => {
      clearTimeout(t);
      resolve(err);
    });
    p.on('error', () => resolve(''));
  });
}

// O ffmpeg abre o link original da lista (servidores Xtream redirecionam para um CDN com token de uso único;
// abrir o destino de novo falha). Só http/https.
const headerArgs = (ua, ref) => ['-protocol_whitelist', 'http,https,tcp,tls', '-user_agent', ua || DEFAULT_UA, ...(ref ? ['-headers', `Referer: ${ref}\r\n`] : [])];

/** Lê o começo do arquivo (1 pedido) e tenta descobrir codec e duração sem o ffmpeg: MKV e AVI. */
async function quickProbe(url, ua, ref) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const { res } = await safeFetch(url, { headers: { Range: 'bytes=0-262143' }, ua, ref, signal: ctrl.signal, timeoutMs: 20000 });
    if (!res.ok && res.status !== 206) {
      res.body?.cancel().catch(() => {});
      throw new HttpError(502, `A fonte respondeu ${res.status}`);
    }
    const chunks = [];
    let size = 0;
    for await (const c of res.body) {
      chunks.push(c);
      size += c.length;
      if (size >= 262144) break;
    }
    ctrl.abort();
    return parseHeader(Buffer.concat(chunks));
  } finally {
    clearTimeout(timer);
  }
}

export function parseHeader(buf) {
  const ascii = buf.toString('latin1');
  if (buf.readUInt32BE(0) === 0x1a45dfa3) {
    // Matroska: CodecID em texto; duração = Duration (0x4489, float) × TimecodeScale (0x2AD7B1, ns).
    const v = ascii.match(/V_[A-Z0-9_/]+/);
    if (!v) return null;
    let scale = 1e6;
    const ts = buf.indexOf(Buffer.from([0x2a, 0xd7, 0xb1]));
    if (ts >= 0) {
      const len = buf[ts + 3] & 0x7f;
      if (len >= 1 && len <= 8) scale = buf.readUIntBE(ts + 4, Math.min(len, 6));
    }
    let duration = 0;
    const d = buf.indexOf(Buffer.from([0x44, 0x89]));
    if (d >= 0) {
      const len = buf[d + 2] & 0x7f;
      const raw = len === 8 ? buf.readDoubleBE(d + 3) : len === 4 ? buf.readFloatBE(d + 3) : 0;
      duration = (raw * scale) / 1e9;
    }
    const vcodec = /AVC/.test(v[0]) ? 'h264' : /HEVC/.test(v[0]) ? 'hevc' : v[0].toLowerCase();
    return { vcodec, pix: '', duration, hasAudio: /A_[A-Z]/.test(ascii), linear: true };
  }
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'AVI ') {
    const avih = ascii.indexOf('avih');
    const vids = ascii.indexOf('vids');
    if (avih < 0 || vids < 0) return null;
    const usPerFrame = buf.readUInt32LE(avih + 8);
    const frames = buf.readUInt32LE(avih + 24);
    const strf = ascii.indexOf('strf', vids);
    const fourcc = strf > 0 ? ascii.slice(strf + 24, strf + 28) : ascii.slice(vids + 4, vids + 8);
    return { vcodec: /h264|avc1|x264/i.test(fourcc) ? 'h264' : fourcc.toLowerCase(), pix: '', duration: (usPerFrame * frames) / 1e6, hasAudio: ascii.includes('auds'), linear: true };
  }
  return null;
}

/** Codecs e duração (cache de 1 h): primeiro pelo cabeçalho, senão pelo ffmpeg. */
async function probe(url, ua, ref) {
  const hit = probes.get(url);
  if (hit && hit.at > Date.now() - 3600_000) return hit;
  let info = await quickProbe(url, ua, ref).catch((e) => {
    if (e instanceof HttpError) throw e;
    return null;
  });
  if (!info || !info.duration) {
    const err = await run(['-hide_banner', '-nostdin', ...headerArgs(ua, ref), '-i', url], 40000);
    const d = err.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
    const video = err.match(/Stream #\d+:\d+[^:]*: Video: (\w+)/);
    if (!video) throw new HttpError(422, 'Não consegui ler este arquivo (fora do ar ou formato desconhecido)');
    info = {
      vcodec: video[1],
      pix: (err.match(/Video: [^\n]*?\b(yuv\w+|nv12|gray\w*)/) || [])[1] || '',
      duration: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0,
      hasAudio: /Stream #\d+:\d+[^:]*: Audio:/.test(err),
    };
  }
  info.at = Date.now();
  if (probes.size > 500) probes.clear();
  probes.set(url, info);
  return info;
}

function stop(sid) {
  const s = sessions.get(sid);
  if (!s) return;
  sessions.delete(sid);
  try {
    if (s.paused) s.proc.kill('SIGCONT');
    s.proc.kill('SIGKILL');
  } catch {
    /* já saiu */
  }
  fs.rm(s.dir, { recursive: true, force: true }, () => {});
}

export function stopUserConversion(userId, sid) {
  const s = sessions.get(sid);
  if (s && s.userId === userId) stop(sid);
}

export async function startConversion({ url, ua, ref, offset, userId }) {
  for (const [sid, s] of sessions) if (s.userId === userId) stop(sid);
  if (sessions.size >= MAX_SESSIONS) throw new HttpError(503, 'Servidor ocupado com outras conversões. Tente em instantes.');
  await assertPublic(url);
  const info = await probe(url, ua, ref);
  const copy = info.vcodec === 'h264' && (!info.pix || /^(yuv420p|yuvj420p|nv12)$/.test(info.pix));
  if (!copy && [...sessions.values()].filter((s) => !s.copy).length >= MAX_ENCODES)
    throw new HttpError(503, 'Já há conversões de vídeo em andamento. Tente em instantes.');

  const sid = crypto.randomBytes(16).toString('hex');
  const dir = path.join(ROOT, sid);
  fs.mkdirSync(dir);
  const start = Math.max(0, Math.min(Number(offset) || 0, Math.max(0, info.duration - 5)));
  const video = copy
    ? ['-c:v', 'copy']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-vf', "scale='min(1920,iw)':-2", '-force_key_frames', `expr:gte(t,n_forced*${SEG})`, '-threads', '3'];
  const args = [
    '-hide_banner', '-loglevel', 'error', '-nostdin',
    ...headerArgs(ua, ref),
    '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
    // MKV/AVI do início não precisam do índice do fim do arquivo: lê em sequência (1 pedido em vez de 3).
    // MP4 (às vezes com nome .avi) precisa: o índice (moov) costuma ficar no fim.
    ...(start ? ['-ss', String(start)] : info.linear ? ['-seekable', '0'] : []),
    '-i', url,
    '-map', '0:v:0', ...(info.hasAudio ? ['-map', '0:a:0'] : []), '-sn',
    ...video,
    ...(info.hasAudio ? ['-c:a', 'aac', '-ac', '2', '-b:a', '160k'] : []),
    '-max_muxing_queue_size', '2048',
    '-f', 'hls', '-hls_time', String(SEG), '-hls_list_size', '0', '-hls_playlist_type', 'event',
    '-hls_segment_filename', path.join(dir, 's%05d.ts'), path.join(dir, 'index.m3u8'),
  ];
  const proc = spawn('nice', ['-n', '10', 'ffmpeg', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
  const s = { sid, dir, proc, userId, copy, last: Date.now(), wanted: 0, paused: false, done: false, error: '' };
  proc.stderr.on('data', (d) => {
    if (s.error.length < 4000) s.error += d;
  });
  proc.on('close', (code) => {
    s.done = true;
    if (code && sessions.has(sid)) console.warn('ffmpeg', code, s.error.slice(-500));
  });
  proc.on('error', (e) => {
    s.done = true;
    s.error = e.message;
  });
  sessions.set(sid, s);
  return { sid, duration: info.duration, offset: start, converting: !copy };
}

const segCount = (dir) => {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).length;
  } catch {
    return 0;
  }
};

/** Arquivos da conversão (playlist e segmentos). O id da sessão (128 bits) é o que dá acesso. */
export async function serveConversion(req, res) {
  const s = sessions.get(String(req.params.sid));
  if (!s) throw new HttpError(404, 'Conversão encerrada');
  s.last = Date.now();
  const file = String(req.params.file);
  if (file === 'index.m3u8') {
    const p = path.join(s.dir, file);
    // Espera o primeiro segmento (até 45 s): o player não gosta de playlist vazia.
    for (let i = 0; i < 150 && !s.done && !(fs.existsSync(p) && segCount(s.dir) > 0); i++) await new Promise((r) => setTimeout(r, 300));
    if (!sessions.has(s.sid)) throw new HttpError(404, 'Conversão encerrada');
    if (!fs.existsSync(p)) throw new HttpError(422, s.error.trim().split('\n').pop() || 'A conversão não começou');
    let text = fs.readFileSync(p, 'utf8');
    // Começa do início (playlist EVENT seria tratada como ao vivo).
    text = text.replace('#EXTM3U', '#EXTM3U\n#EXT-X-START:TIME-OFFSET=0,PRECISE=YES');
    return res.set({ 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' }).send(text);
  }
  const m = file.match(/^s(\d{5})\.ts$/);
  if (!m) throw new HttpError(404, 'Arquivo não encontrado');
  s.wanted = Math.max(s.wanted, Number(m[1]));
  const p = path.join(s.dir, file);
  if (!fs.existsSync(p)) throw new HttpError(404, 'Segmento ainda não pronto');
  res.set({ 'Content-Type': 'video/mp2t', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
}

// Pausa/retoma o ffmpeg conforme a distância do que está sendo assistido; encerra sessões abandonadas.
setInterval(() => {
  const now = Date.now();
  for (const [sid, s] of sessions) {
    if (now - s.last > IDLE_MS) {
      stop(sid);
      continue;
    }
    if (s.done) continue;
    const ahead = segCount(s.dir) - s.wanted;
    try {
      if (!s.paused && ahead > AHEAD_SEGMENTS) {
        s.proc.kill('SIGSTOP');
        s.paused = true;
      } else if (s.paused && ahead < AHEAD_SEGMENTS / 2) {
        s.proc.kill('SIGCONT');
        s.paused = false;
      }
    } catch {
      /* processo saiu */
    }
  }
}, 1000).unref();
