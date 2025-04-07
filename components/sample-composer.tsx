"use client"

import { useState, useRef, type MutableRefObject } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, X, Plus, ArrowUp, ArrowDown, Edit, Trash2, Repeat } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface Sample {
  id: string
  buffer: AudioBuffer
  name: string
}

interface CompositionTrack {
  id: string
  sampleId: string
  startTime: number
  repetitions: number
  volume: number
}

interface SampleComposerProps {
  samples: Sample[]
  setSamples: (samples: Sample[]) => void
  audioContext: MutableRefObject<AudioContext | null>
  gainNode: MutableRefObject<GainNode | null>
}

export default function SampleComposer({ samples, setSamples, audioContext, gainNode }: SampleComposerProps) {
  const [tracks, setTracks] = useState<CompositionTrack[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [editingSample, setEditingSample] = useState<Sample | null>(null)
  const [newSampleName, setNewSampleName] = useState("")
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)
  const [compositionDuration, setCompositionDuration] = useState(0)

  const audioSources = useRef<AudioBufferSourceNode[]>([])
  const { toast } = useToast()

  // Play a single sample
  const playSample = (sample: Sample) => {
    if (!audioContext.current || !gainNode.current) return

    // Stop any currently playing sample
    audioSources.current.forEach((source) => {
      try {
        source.stop()
      } catch (e) {
        // Ignore errors from already stopped sources
      }
    })
    audioSources.current = []

    const source = audioContext.current.createBufferSource()
    source.buffer = sample.buffer

    const sampleGain = audioContext.current.createGain()
    sampleGain.gain.value = 0.8

    source.connect(sampleGain)
    sampleGain.connect(gainNode.current)

    source.start()
    audioSources.current.push(source)

    source.onended = () => {
      // Remove this source from the array when it ends
      audioSources.current = audioSources.current.filter((s) => s !== source)
    }
  }

  // Add a track to the composition
  const addTrack = () => {
    if (!selectedSampleId) {
      toast({
        title: "No sample selected",
        description: "Please select a sample first",
        variant: "destructive",
      })
      return
    }

    const newTrack: CompositionTrack = {
      id: Date.now().toString(),
      sampleId: selectedSampleId,
      startTime: 0,
      repetitions: 1,
      volume: 0.8,
    }

    setTracks([...tracks, newTrack])
    updateCompositionDuration([...tracks, newTrack])
  }

  // Remove a track from the composition
  const removeTrack = (trackId: string) => {
    const updatedTracks = tracks.filter((track) => track.id !== trackId)
    setTracks(updatedTracks)
    updateCompositionDuration(updatedTracks)
  }

  // Update track properties
  const updateTrack = (trackId: string, updates: Partial<CompositionTrack>) => {
    const updatedTracks = tracks.map((track) => (track.id === trackId ? { ...track, ...updates } : track))
    setTracks(updatedTracks)
    updateCompositionDuration(updatedTracks)
  }

  // Move track up in the list
  const moveTrackUp = (index: number) => {
    if (index <= 0) return

    const updatedTracks = [...tracks]
    const temp = updatedTracks[index]
    updatedTracks[index] = updatedTracks[index - 1]
    updatedTracks[index - 1] = temp

    setTracks(updatedTracks)
  }

  // Move track down in the list
  const moveTrackDown = (index: number) => {
    if (index >= tracks.length - 1) return

    const updatedTracks = [...tracks]
    const temp = updatedTracks[index]
    updatedTracks[index] = updatedTracks[index + 1]
    updatedTracks[index + 1] = temp

    setTracks(updatedTracks)
  }

  // Play the entire composition
  const playComposition = () => {
    if (!audioContext.current || !gainNode.current || tracks.length === 0) return

    // Stop any currently playing sources
    audioSources.current.forEach((source) => {
      try {
        source.stop()
      } catch (e) {
        // Ignore errors from already stopped sources
      }
    })
    audioSources.current = []

    // Start new playback
    const startTime = audioContext.current.currentTime

    tracks.forEach((track) => {
      const sample = samples.find((s) => s.id === track.sampleId)
      if (!sample || !audioContext.current || !gainNode.current) return

      for (let i = 0; i < track.repetitions; i++) {
        const source = audioContext.current.createBufferSource()
        source.buffer = sample.buffer

        const trackGain = audioContext.current.createGain()
        trackGain.gain.value = track.volume

        source.connect(trackGain)
        trackGain.connect(gainNode.current)

        const playTime = startTime + track.startTime + i * sample.buffer.duration
        source.start(playTime)

        audioSources.current.push(source)
      }
    })

    setIsPlaying(true)

    // Calculate when playback will end
    const endTime = calculateCompositionDuration() * 1000
    setTimeout(() => {
      setIsPlaying(false)
    }, endTime)
  }

  // Stop playback
  const stopPlayback = () => {
    audioSources.current.forEach((source) => {
      try {
        source.stop()
      } catch (e) {
        // Ignore errors from already stopped sources
      }
    })
    audioSources.current = []
    setIsPlaying(false)
  }

  // Calculate the total duration of the composition
  const calculateCompositionDuration = () => {
    let maxEndTime = 0

    tracks.forEach((track) => {
      const sample = samples.find((s) => s.id === track.sampleId)
      if (!sample) return

      const trackEndTime = track.startTime + sample.buffer.duration * track.repetitions
      maxEndTime = Math.max(maxEndTime, trackEndTime)
    })

    return maxEndTime
  }

  // Update the composition duration when tracks change
  const updateCompositionDuration = (updatedTracks: CompositionTrack[]) => {
    let maxEndTime = 0

    updatedTracks.forEach((track) => {
      const sample = samples.find((s) => s.id === track.sampleId)
      if (!sample) return

      const trackEndTime = track.startTime + sample.buffer.duration * track.repetitions
      maxEndTime = Math.max(maxEndTime, trackEndTime)
    })

    setCompositionDuration(maxEndTime)
  }

  // Delete a sample
  const deleteSample = (sampleId: string) => {
    // Check if sample is used in any tracks
    const isUsed = tracks.some((track) => track.sampleId === sampleId)

    if (isUsed) {
      toast({
        title: "Cannot delete sample",
        description: "This sample is used in your composition",
        variant: "destructive",
      })
      return
    }

    const updatedSamples = samples.filter((sample) => sample.id !== sampleId)
    setSamples(updatedSamples)

    if (selectedSampleId === sampleId) {
      setSelectedSampleId(null)
    }
  }

  // Save edited sample name
  const saveSampleName = () => {
    if (!editingSample || !newSampleName.trim()) return

    const updatedSamples = samples.map((sample) =>
      sample.id === editingSample.id ? { ...sample, name: newSampleName.trim() } : sample,
    )

    setSamples(updatedSamples)
    setEditingSample(null)
    setNewSampleName("")
  }

  // Format time in seconds to MM:SS format
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="grid gap-6">
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Available Samples</CardTitle>
          </CardHeader>
          <CardContent>
            {samples.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p>No samples available</p>
                <p className="text-sm mt-2">Extract samples from the waveform view</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {samples.map((sample) => (
                  <div
                    key={sample.id}
                    className={`flex items-center justify-between p-2 rounded-md border ${
                      selectedSampleId === sample.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => playSample(sample)}>
                        <Play className="h-4 w-4" />
                      </Button>
                      <div>
                        <div className="font-medium">{sample.name}</div>
                        <div className="text-xs text-muted-foreground">{formatTime(sample.buffer.duration)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingSample(sample)
                          setNewSampleName(sample.name)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      <Button variant="ghost" size="icon" onClick={() => deleteSample(sample.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSampleId(sample.id)}>
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Composition</CardTitle>
            <div className="text-sm text-muted-foreground">Duration: {formatTime(compositionDuration)}</div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button onClick={addTrack} disabled={!selectedSampleId}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Track
                </Button>
                <Button
                  variant={isPlaying ? "destructive" : "default"}
                  onClick={isPlaying ? stopPlayback : playComposition}
                  disabled={tracks.length === 0}
                >
                  {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  {isPlaying ? "Stop" : "Play"}
                </Button>
              </div>

              {tracks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No tracks in composition</p>
                  <p className="text-sm mt-2">Select a sample and add a track</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {tracks.map((track, index) => {
                    const sample = samples.find((s) => s.id === track.sampleId)
                    if (!sample) return null

                    return (
                      <div key={track.id} className="p-3 border rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{sample.name}</div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveTrackUp(index)}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveTrackDown(index)}
                              disabled={index === tracks.length - 1}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => removeTrack(track.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`start-${track.id}`}>Start Time (s)</Label>
                              <Input
                                id={`start-${track.id}`}
                                type="number"
                                min={0}
                                step={0.1}
                                value={track.startTime}
                                onChange={(e) =>
                                  updateTrack(track.id, { startTime: Number.parseFloat(e.target.value) || 0 })
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor={`repeat-${track.id}`} className="flex items-center gap-1">
                                <Repeat className="h-4 w-4" /> Repetitions
                              </Label>
                              <Input
                                id={`repeat-${track.id}`}
                                type="number"
                                min={1}
                                max={10}
                                value={track.repetitions}
                                onChange={(e) =>
                                  updateTrack(track.id, { repetitions: Number.parseInt(e.target.value) || 1 })
                                }
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor={`volume-${track.id}`}>Volume</Label>
                            <Slider
                              id={`volume-${track.id}`}
                              min={0}
                              max={1}
                              step={0.01}
                              value={[track.volume]}
                              onValueChange={(value) => updateTrack(track.id, { volume: value[0] })}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Sample Name Dialog */}
      <Dialog open={!!editingSample} onOpenChange={(open) => !open && setEditingSample(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sample Name</DialogTitle>
            <DialogDescription>Change the name of your audio sample</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="sample-name">Name</Label>
              <Input id="sample-name" value={newSampleName} onChange={(e) => setNewSampleName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSample(null)}>
              Cancel
            </Button>
            <Button onClick={saveSampleName}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

