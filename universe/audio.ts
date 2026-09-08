/** Synthesized sound only. No downloads, samples, or autoplay. */
export class Ambience {
  private context?: AudioContext;
  private master?: GainNode;
  private air?: GainNode;
  private tone?: GainNode;
  private filter?: BiquadFilterNode;
  private lastQuiet?: boolean;
  enabled = false;
  async toggle() {
    await this.setEnabled(!this.enabled);
    return this.enabled;
  }
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
    const air = ctx.createGain();
    air.gain.value = 0.12;
    this.air = air;
    source.connect(filter).connect(air).connect(master);
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
  update(quiet: boolean) {
    if (
      !this.context ||
      !this.air ||
      !this.tone ||
      !this.filter ||
      quiet === this.lastQuiet
    )
      return;
    this.lastQuiet = quiet;
    const now = this.context.currentTime;
    this.air.gain.setTargetAtTime(quiet ? 0.045 : 0.12, now, 2);
    this.filter.frequency.setTargetAtTime(quiet ? 550 : 950, now, 2);
    this.tone.gain.setTargetAtTime(quiet ? 0.012 : 0.042, now, 2);
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
