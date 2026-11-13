/**
 * Manages the Fire & Smoke Emergency Alarm Audio using /alerts/fire_alarm.wav
 * decoded into an unlocked Web Audio API AudioContext + HTMLAudioElement fallback.
 * Using Web Audio AudioBufferSourceNode ensures alarm playback works reliably
 * from timers and async detection callbacks once unlocked by a single user click.
 */
class AlarmAudioController {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private wavBuffer: AudioBuffer | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private isUnlocked = false;
  private fallbackTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      if (typeof Audio !== 'undefined') {
        this.audio = new Audio('/alerts/fire_alarm.wav');
        this.audio.loop = true;
        this.audio.preload = 'auto';
        this.audio.load();
      }
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.preloadWavIntoBuffer().catch(() => {});
    }
    return this.ctx;
  }

  private async preloadWavIntoBuffer(): Promise<void> {
    if (!this.ctx || this.wavBuffer) return;
    const resp = await fetch('/alerts/fire_alarm.wav');
    if (!resp.ok) return;
    const arr = await resp.arrayBuffer();
    this.wavBuffer = await this.ctx.decodeAudioData(arr);
  }

  /**
   * Must be called directly inside a user click handler ("Enable Alarm" button)
   * to unlock browser autoplay for both AudioContext and HTMLAudioElement.
   */
  public async unlockFromUserGesture(): Promise<boolean> {
    let unlockedAny = false;

    // 1. Unlock Web Audio API synchronously in user gesture
    try {
      const ctx = this.ensureAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        // Play a brief soft confirmation chime so user confirms speakers work
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);

        await this.preloadWavIntoBuffer();
        unlockedAny = true;
      }
    } catch {
      // Continue to HTMLAudioElement unlock
    }

    // 2. Separately unlock HTMLAudioElement
    if (this.audio) {
      try {
        this.audio.volume = 0;
        this.audio.currentTime = 0;
        await this.audio.play();
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.volume = 1;
        unlockedAny = true;
      } catch {
        this.audio.volume = 1;
      }
    }

    this.isUnlocked = unlockedAny;
    return unlockedAny;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsUnlocked(): boolean {
    return this.isUnlocked;
  }

  /**
   * Starts playing the alarm sound once (never stacks multiple overlapping instances).
   */
  public async playAlarm(): Promise<boolean> {
    if (this.isPlaying) return true;
    this.isPlaying = true;

    // Preferred path: Play pre-decoded /alerts/fire_alarm.wav through unlocked AudioContext
    try {
      const ctx = this.ensureAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        if (!this.wavBuffer) {
          await this.preloadWavIntoBuffer();
        }
        if (ctx.state === 'running' && this.wavBuffer) {
          const source = ctx.createBufferSource();
          source.buffer = this.wavBuffer;
          source.loop = true;
          source.connect(ctx.destination);
          source.start(0);
          this.activeSource = source;
          return true;
        }
      }
    } catch {
      // Fall through to HTMLAudioElement / oscillator fallback
    }

    // Fallback 1: HTMLAudioElement
    if (this.audio) {
      try {
        this.audio.volume = 1;
        this.audio.muted = false;
        this.audio.currentTime = 0;
        await this.audio.play();
        return true;
      } catch {
        // Fall through to oscillator siren
      }
    }

    // Fallback 2: Direct Web Audio oscillator siren loop
    if (this.ctx && this.ctx.state === 'running') {
      this.startFallbackBeepLoop();
      return true;
    }

    this.isPlaying = false;
    return false;
  }

  private playSingleBeep(): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.setValueAtTime(680, now + 0.25);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.56);
  }

  private startFallbackBeepLoop(): void {
    this.stopFallbackBeepLoop();
    this.playSingleBeep();
    if (typeof window !== 'undefined') {
      this.fallbackTimer = window.setInterval(() => {
        this.playSingleBeep();
      }, 750);
    }
  }

  private stopFallbackBeepLoop(): void {
    if (this.fallbackTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  /**
   * Immediately silences any currently playing alarm sound.
   */
  public silence(): void {
    this.isPlaying = false;
    this.stopFallbackBeepLoop();

    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
        // Ignore already stopped node
      }
      this.activeSource = null;
    }

    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }
}

export const alarmAudio = new AlarmAudioController();
