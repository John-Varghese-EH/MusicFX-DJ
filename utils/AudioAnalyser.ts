/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/** Simple class for getting the current audio level and frequency data. */
export class AudioAnalyser extends EventTarget {
  readonly node: AnalyserNode;
  private readonly freqData: Uint8Array;
  private rafId: number | null = null;
  constructor(context: AudioContext) {
    super();
    this.node = context.createAnalyser();
    this.node.fftSize = 256; // More bins for visualization
    this.node.smoothingTimeConstant = 0.3; // Smoother visualization
    this.freqData = new Uint8Array(this.node.frequencyBinCount);
    this.loop = this.loop.bind(this);
  }
  
  private getData() {
    this.node.getByteFrequencyData(this.freqData);
    const level = this.freqData.reduce((a, b) => a + b, 0) / this.freqData.length / 0xff;
    return { level, frequencyData: this.freqData };
  }

  loop() {
    this.rafId = requestAnimationFrame(this.loop);
    const { level, frequencyData } = this.getData();
    this.dispatchEvent(new CustomEvent('audio-data-changed', { detail: { level, frequencyData } }));
  }

  start = this.loop;
  
  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
