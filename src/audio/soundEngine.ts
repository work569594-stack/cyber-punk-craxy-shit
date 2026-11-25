import { SoundscapeId } from '../types/universe';

interface SoundscapeProfile {
  baseHz: number;
  harmonicHz: number;
  detuneCents: number;
  filterHz: number;
  noiseGain: number;
  pulseIntervalMs: number;
}

const PROFILES: Record<SoundscapeId, SoundscapeProfile> = {
  ROOT_ACCESS: { baseHz: 46.25, harmonicHz: 69.3, detuneCents: 8, filterHz: 170, noiseGain: 0.012, pulseIntervalMs: 6200 },
  GHOSTNET: { baseHz: 51.91, harmonicHz: 77.78, detuneCents: 14, filterHz: 210, noiseGain: 0.016, pulseIntervalMs: 4800 },
  BLACKBOX: { baseHz: 41.2, harmonicHz: 61.74, detuneCents: 11, filterHz: 150, noiseGain: 0.014, pulseIntervalMs: 6800 },
  ARCHIVE: { baseHz: 49.0, harmonicHz: 73.42, detuneCents: 6, filterHz: 140, noiseGain: 0.01, pulseIntervalMs: 7600 },
  NULL_SPACE: { baseHz: 36.71, harmonicHz: 38.0, detuneCents: 4, filterHz: 95, noiseGain: 0.005, pulseIntervalMs: 9800 },
  GHOST_LAYER: { baseHz: 43.65, harmonicHz: 63.5, detuneCents: 22, filterHz: 230, noiseGain: 0.02, pulseIntervalMs: 3900 },
  ROOT_07: { baseHz: 55.0, harmonicHz: 82.41, detuneCents: 9, filterHz: 200, noiseGain: 0.013, pulseIntervalMs: 5400 },
};

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private sfxFilter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noiseGainNode: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private pulseTimer: number | null = null;

  private initialized = false;
  private muted = false;
  private masterVolume = 0.65;
  private ambientVolume = 0.55;
  private sfxVolume = 0.7;
  private activeSoundscape: SoundscapeId = 'ROOT_ACCESS';

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = this.ambientVolume * 0.34;

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume * 0.28;

    // Warm dark lowpass on all SFX so no harsh high harmonics reach the ear
    this.sfxFilter = ctx.createBiquadFilter();
    this.sfxFilter.type = 'lowpass';
    this.sfxFilter.frequency.value = 620;
    this.sfxFilter.Q.value = 0.7;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 64;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = PROFILES[this.activeSoundscape].filterHz;
    this.filter.Q.value = 0.9;

    // Deep ominous sub-earth analog drones (triangle + sine only, no harsh sawtooth buzz)
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'triangle';
    this.osc1.frequency.value = PROFILES[this.activeSoundscape].baseHz;

    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'sine';
    this.osc2.frequency.value = PROFILES[this.activeSoundscape].harmonicHz;
    this.osc2.detune.value = PROFILES[this.activeSoundscape].detuneCents;

    this.subOsc = ctx.createOscillator();
    this.subOsc.type = 'sine';
    this.subOsc.frequency.value = PROFILES[this.activeSoundscape].baseHz * 0.5;

    // Brown-weighted muffled ventilation / subterranean air rumble
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      output[i] = lastOut * 2.2;
    }
    this.noiseBuffer = noiseBuffer;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 340;
    noiseFilter.Q.value = 0.5;

    this.noiseGainNode = ctx.createGain();
    this.noiseGainNode.gain.value = PROFILES[this.activeSoundscape].noiseGain;

    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.subOsc.connect(this.filter);
    this.filter.connect(this.ambientGain);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(this.noiseGainNode);
    this.noiseGainNode.connect(this.ambientGain);

    this.ambientGain.connect(this.masterGain);
    this.sfxGain.connect(this.sfxFilter);
    this.sfxFilter.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.osc1.start();
    this.osc2.start();
    this.subOsc.start();
    noiseSource.start();

    this.initialized = true;
    this.schedulePulse();
  }

  private schedulePulse(): void {
    if (this.pulseTimer) {
      window.clearInterval(this.pulseTimer);
    }
    const profile = PROFILES[this.activeSoundscape];
    this.pulseTimer = window.setInterval(() => {
      if (!this.initialized || this.muted || !this.ctx || !this.ambientGain) return;
      if (this.ctx.state !== 'running') return;
      // Distant subterranean sonar swell (low frequency, gentle envelope)
      const now = this.ctx.currentTime;
      const pingOsc = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();
      pingOsc.type = 'sine';
      pingOsc.frequency.setValueAtTime(profile.harmonicHz * 1.5, now);
      pingOsc.frequency.exponentialRampToValueAtTime(profile.baseHz, now + 2.4);

      pingGain.gain.setValueAtTime(0.0001, now);
      pingGain.gain.linearRampToValueAtTime(0.024, now + 0.45);
      pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);

      pingOsc.connect(pingGain);
      pingGain.connect(this.ambientGain);
      pingOsc.start(now);
      pingOsc.stop(now + 2.7);
    }, profile.pulseIntervalMs);
  }

  public setSoundscape(id: SoundscapeId): void {
    this.activeSoundscape = id;
    if (!this.initialized || !this.ctx) return;
    const profile = PROFILES[id];
    const now = this.ctx.currentTime;

    this.osc1?.frequency.setTargetAtTime(profile.baseHz, now, 1.1);
    this.osc2?.frequency.setTargetAtTime(profile.harmonicHz, now, 1.1);
    this.osc2?.detune.setTargetAtTime(profile.detuneCents, now, 1.1);
    this.subOsc?.frequency.setTargetAtTime(profile.baseHz * 0.5, now, 1.1);
    this.filter?.frequency.setTargetAtTime(profile.filterHz, now, 1.2);
    this.noiseGainNode?.gain.setTargetAtTime(profile.noiseGain, now, 1.0);
    this.schedulePulse();
  }

  public setVolumes(opts: { master?: number; ambient?: number; sfx?: number; muted?: boolean }): void {
    if (typeof opts.master === 'number') this.masterVolume = opts.master;
    if (typeof opts.ambient === 'number') this.ambientVolume = opts.ambient;
    if (typeof opts.sfx === 'number') this.sfxVolume = opts.sfx;
    if (typeof opts.muted === 'boolean') this.muted = opts.muted;

    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.masterGain?.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, now, 0.08);
    this.ambientGain?.gain.setTargetAtTime(this.ambientVolume * 0.34, now, 0.08);
    this.sfxGain?.gain.setTargetAtTime(this.sfxVolume * 0.28, now, 0.08);
  }

  // Soft muted mechanical relay tick — gentle on ears, dark tactile presence
  public playClick(): void {
    if (!this.initialized || this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.022);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.032);
  }

  // Deep resonant sub-bass relay lock
  public playExecute(): void {
    if (!this.initialized || this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(48, now + 0.18);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.14, now + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    const overtone = this.ctx.createOscillator();
    const overGain = this.ctx.createGain();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(164.8, now);
    overtone.frequency.exponentialRampToValueAtTime(130.8, now + 0.16);
    overGain.gain.setValueAtTime(0.001, now);
    overGain.gain.linearRampToValueAtTime(0.045, now + 0.015);
    overGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);

    sub.connect(subGain);
    overtone.connect(overGain);
    subGain.connect(this.sfxGain);
    overGain.connect(this.sfxGain);

    sub.start(now);
    overtone.start(now);
    sub.stop(now + 0.24);
    overtone.stop(now + 0.21);
  }

  // Cold haunting minor resonance swell for breakthroughs & unlocks
  public playUnlock(): void {
    if (!this.initialized || this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [110, 164.81, 207.65]; // A2, E3, G#3 eerie minor-major7 atmosphere
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.11;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.linearRampToValueAtTime(freq * 0.992, start + 0.85);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.085, start + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.95);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 1.0);
    });
  }

  // Unsettling spectral detuned groan + whispered cold air swell
  public playAnomaly(): void {
    if (!this.initialized || this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    oscA.type = 'sine';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(76, now);
    oscA.frequency.exponentialRampToValueAtTime(51, now + 0.72);
    oscB.frequency.setValueAtTime(80.5, now); // slow eerie beating against oscA
    oscB.frequency.exponentialRampToValueAtTime(53.5, now + 0.72);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);

    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(this.sfxGain);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 0.82);
    oscB.stop(now + 0.82);

    if (this.noiseBuffer) {
      const breath = this.ctx.createBufferSource();
      breath.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(260, now);
      bp.Q.value = 1.6;
      const bGain = this.ctx.createGain();
      bGain.gain.setValueAtTime(0.0001, now);
      bGain.gain.linearRampToValueAtTime(0.08, now + 0.16);
      bGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      breath.connect(bp);
      bp.connect(bGain);
      bGain.connect(this.sfxGain);
      breath.start(now);
      breath.stop(now + 0.7);
    }
  }

  // Heavy low-frequency power brownout thud (zero harsh buzzing)
  public playError(): void {
    if (!this.initialized || this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(84, now);
    osc1.frequency.exponentialRampToValueAtTime(42, now + 0.22);
    osc2.frequency.setValueAtTime(119, now); // muted tritone shadow
    osc2.frequency.exponentialRampToValueAtTime(59, now + 0.22);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.27);
    osc2.stop(now + 0.27);
  }

  public getSpectrumData(): Uint8Array {
    if (!this.analyser || !this.initialized) {
      return new Uint8Array(16).fill(4);
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export const soundEngine = new ProceduralSoundEngine();
