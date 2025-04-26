import { create } from "zustand"

import type { CompositionTrack, Sample } from "@/types/studio"

type StudioState = {
  samples: Sample[]
  currentSample: Sample | null
  tracks: CompositionTrack[]
  currentTrack: CompositionTrack | null
}

type StudioActions = {
  setSamples: (newSamples: Sample[]) => void
  setCurrentSample: (sample: Sample | null) => void
  setCurrentTrack: (track: CompositionTrack | null) => void
  updateTrack: (key: keyof CompositionTrack, value: string | number) => void
  resetTrack: () => void
  setTracks: (tracks: CompositionTrack[]) => void
}

const useStudioStore = create<StudioState & StudioActions>((set) => ({
  samples: [],
  currentSample: null,
  tracks: [],
  currentTrack: null,
  setSamples: (newSamples) => set({ samples: newSamples }),
  setCurrentSample: (sample) => set({ currentSample: sample }),
  setCurrentTrack: (track) => set({ currentTrack: track }),
  updateTrack: (key, value) =>
    set(({ currentTrack }) => ({
      currentTrack: {
        ...currentTrack!,
        [key]: value,
      },
    })),
  resetTrack: () => set({ currentTrack: null }),
  setTracks: (tracks) => set({ tracks }),
}))

export default useStudioStore
