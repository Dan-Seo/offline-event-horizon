/** Synthesized sound only. No downloads, samples, or autoplay. */
export class Ambience {
  private context?: AudioContext;
  private master?: GainNode;
  private rain?: GainNode;
  private tone?: GainNode;
  private filter?: BiquadFilterNode;
  enabled = false;
  async setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled && !this.context) this.create();
    if (this.context?.state === "suspended" && enabled)
      await this.context.resume();
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        enabled ? 0.16 : 0,
        this.context.currentTime,
        0.8,
      );
  }
  private create() {
    const ctx = new AudioContext();
    this.context = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;
    const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = brown * 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    this.filter = filter;
    const rain = ctx.createGain();
    rain.gain.value = 0.55;
    this.rain = rain;
    source.connect(filter).connect(rain).connect(master);
    source.start();
    const tone = ctx.createGain();
    tone.gain.value = 0.08;
    this.tone = tone;
    tone.connect(master);
    [55, 82.41, 110.1, 164.81].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.35 / (i + 1);
      o.connect(g).connect(tone);
      o.start();
    });
  }
  update(t: number) {
    if (!this.context || !this.rain || !this.tone || !this.filter) return;
    const now = this.context.currentTime;
    const space = Math.min(1, Math.max(0, (t - 75) / 70));
    const life = Math.min(1, Math.max(0, (t - 225) / 35));
    const quiet = Math.min(1, Math.max(0, (t - 268) / 28));
    this.rain.gain.setTargetAtTime(
      (0.55 * (1 - space) + life * 0.16) * (1 - quiet * 0.65),
      now,
      2,
    );
    this.filter.frequency.setTargetAtTime(
      1800 * (1 - space) + 350 + life * 600,
      now,
      2,
    );
    this.tone.gain.setTargetAtTime(
      (0.07 + Math.sin(space * Math.PI) * 0.13) * (1 - quiet * 0.86),
      now,
      2,
    );
  }
  suspend() {
    void this.context?.suspend();
  }
  resume() {
    if (this.enabled) void this.context?.resume();
  }
  dispose() {
    if (this.context && this.context.state !== "closed")
      void this.context.close();
    this.context = undefined;
  }
}
