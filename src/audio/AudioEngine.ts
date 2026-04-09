export type FrameCallback = (buffer: Float32Array, sampleRate: number) => void

const FFT_SIZE = 2048

export class AudioEngine {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private buffer: Float32Array | null = null
  private rafId: number | null = null
  private onFrame: FrameCallback | null = null

  async start(onFrame: FrameCallback): Promise<void> {
    if (this.context) {
      await this.stop()
    }

    this.onFrame = onFrame

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    })

    this.context = new AudioContext()

    if (this.context.state === 'suspended') {
      await this.context.resume()
    }

    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = FFT_SIZE
    this.analyser.smoothingTimeConstant = 0

    this.source = this.context.createMediaStreamSource(this.stream)
    this.source.connect(this.analyser)

    this.buffer = new Float32Array(this.analyser.fftSize)
    this.scheduleFrame()
  }

  private scheduleFrame(): void {
    this.rafId = requestAnimationFrame(() => {
      if (!this.analyser || !this.buffer || !this.onFrame || !this.context) return
      if (this.context.state !== 'running') {
        this.scheduleFrame()
        return
      }
      this.analyser.getFloatTimeDomainData(this.buffer)
      this.onFrame(this.buffer, this.context.sampleRate)
      this.scheduleFrame()
    })
  }

  async stop(): Promise<void> {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    this.source?.disconnect()
    this.source = null

    this.analyser?.disconnect()
    this.analyser = null

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop()
      }
      this.stream = null
    }

    if (this.context) {
      await this.context.close()
      this.context = null
    }

    this.buffer = null
    this.onFrame = null
  }

  get isRunning(): boolean {
    return this.context?.state === 'running'
  }
}
