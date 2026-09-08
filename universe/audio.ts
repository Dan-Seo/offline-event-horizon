/** Synthesized sound only. No downloads, samples, or autoplay. */
export class Ambience {
  private context?: AudioContext;
  private master?: GainNode;
  private air?: GainNode;
  private tone?: GainNode;
  private filter?: BiquadFilterNode;
  private lastQuiet?: boolean;
  private lastPlace = "";
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
  update(quiet: boolean, place = "space") {
    if (
      !this.context ||
      !this.air ||
      !this.tone ||
      !this.filter ||
      (quiet === this.lastQuiet && place === this.lastPlace)
    )
      return;
    this.lastQuiet = quiet;
    this.lastPlace = place;
    const now = this.context.currentTime;
    const profile: Record<string, number[]> = {
      "last-light": [0.09, 650, 0.016],
      moonfall: [0.17, 1150, 0.008],
      forest: [0.055, 1700, 0.019],
      veil: [0.095, 850, 0.012],
      "living-sky": [0.038, 1250, 0.027],
      space: [0.012, 350, 0.013],
    };
    const [air, hz, tone] = profile[place] ?? profile.space,
      soft = quiet ? 0.4 : 1;
    this.air.gain.setTargetAtTime(air * soft, now, 5);
    this.filter.frequency.setTargetAtTime(hz * (quiet ? 0.7 : 1), now, 5);
    this.tone.gain.setTargetAtTime(tone * soft, now, 5);
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
