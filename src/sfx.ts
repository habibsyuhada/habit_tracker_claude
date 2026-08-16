import type { Toast } from './types';

/**
 * Efek suara chiptune kecil yang disintesis langsung lewat WebAudio —
 * tanpa file audio, tetap offline dan nol tambahan ukuran aset.
 */

let ctx: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  startIn: number,
  duration: number,
  type: OscillatorType = 'square',
  volume = 0.04
): void {
  const ac = ensureContext();
  if (!ac) return;
  const t0 = ac.currentTime + startIn;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}

export function sfxForToast(kind: Toast['kind']): void {
  try {
    switch (kind) {
      case 'xp':
        tone(660, 0, 0.09);
        tone(880, 0.07, 0.12);
        break;
      case 'gold':
        tone(988, 0, 0.08, 'triangle', 0.06);
        tone(1319, 0.06, 0.14, 'triangle', 0.06);
        break;
      case 'level':
        tone(523, 0, 0.1);
        tone(659, 0.09, 0.1);
        tone(784, 0.18, 0.1);
        tone(1047, 0.27, 0.22);
        break;
      case 'hp':
        tone(196, 0, 0.18, 'sawtooth', 0.05);
        tone(147, 0.12, 0.22, 'sawtooth', 0.05);
        break;
      case 'danger':
        tone(220, 0, 0.16, 'sawtooth', 0.05);
        tone(208, 0.14, 0.16, 'sawtooth', 0.05);
        tone(196, 0.28, 0.3, 'sawtooth', 0.05);
        break;
      default:
        break;
    }
  } catch {
    // audio tidak tersedia — diam saja
  }
}
