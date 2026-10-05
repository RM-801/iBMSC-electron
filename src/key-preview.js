// Audition has one voice, separate from the chart playback scheduler.
export class KeyPreview {
  constructor(context) {
    this.context = context;
    this.generation = 0;
    this.source = null;
  }
  stop() {
    this.generation++;
    const source = this.source;
    this.source = null;
    if (!source) return;
    source.onended = null;
    try { source.stop(); } catch {}
    source.disconnect();
  }
  async play(buffer) {
    this.stop();
    const generation = this.generation;
    if (!buffer) throw Error("请先加载音源文件");
    const audio = await this.context();
    if (generation !== this.generation) return;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.onended = () => {
      if (this.source === source) this.source = null;
      source.disconnect();
    };
    this.source = source;
    try { source.start(); }
    catch (error) { this.stop(); throw error; }
  }
}
