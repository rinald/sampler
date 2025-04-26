type Sample = {
  id: string
  buffer: AudioBuffer
  name: string
}

type CompositionTrack = {
  id: string
  sampleId: string
  startTime: number
  repetitions: number
  volume: number
  pitchSemitones: number
  reverbAmount: number
  delayTime: number
  delayFeedback: number
}

export type { CompositionTrack, Sample }
