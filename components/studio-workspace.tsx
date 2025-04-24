"use client"

import type React from "react"

import { useState, useRef, type MutableRefObject, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Play,
  Pause,
  X,
  Plus,
  Edit,
  Trash2,
  Repeat,
  Volume2,
  Settings,
  MoveHorizontal,
  Music,
  AudioWaveformIcon as Waveform,
  Layers,
  Clock,
  Download,
  Move,
  Waves,
} from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import SampleWaveform from "@/components/sample-waveform"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ExportDialog, type ExportFormat } from "@/components/export-dialog"
import {
  audioBufferToWav,
  audioBufferToMp3,
  audioBufferToFlac,
  downloadBlob,
} from "@/utils/audio-export"

interface Sample {
  id: string
  buffer: AudioBuffer
  name: string
}

// Update the CompositionTrack interface to include our new effects
interface CompositionTrack {
  id: string
  sampleId: string
  startTime: number
  repetitions: number
  volume: number
  // Replace playbackRate with semitone-based pitch
  pitchSemitones: number
  reverbAmount: number
  // Add delay effect
  delayTime: number
  delayFeedback: number
}

interface StudioWorkspaceProps {
  samples: Sample[]
  setSamples: (samples: Sample[]) => void
  audioContext: MutableRefObject<AudioContext | null>
  gainNode: MutableRefObject<GainNode | null>
}

export default function StudioWorkspace({
  samples,
  setSamples,
  audioContext,
  gainNode,
}: StudioWorkspaceProps) {
  const [tracks, setTracks] = useState<CompositionTrack[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [editingSample, setEditingSample] = useState<Sample | null>(null)
  const [newSampleName, setNewSampleName] = useState("")
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)
  const [compositionDuration, setCompositionDuration] = useState(0)
  const [editingTrack, setEditingTrack] = useState<CompositionTrack | null>(
    null
  )
  const [currentTime, setCurrentTime] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [activeTab, setActiveTab] = useState("library")
  const [impulseResponse, setImpulseResponse] = useState<AudioBuffer | null>(
    null
  )
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartTime, setDragStartTime] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [timelineOffset, setTimelineOffset] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [panStartX, setPanStartX] = useState(0)
  const [panStartOffset, setPanStartOffset] = useState(0)

  const audioSources = useRef<AudioBufferSourceNode[]>([])
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const timelineRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Create impulse response for reverb
  useEffect(() => {
    if (!audioContext.current) return

    // Create impulse response for reverb
    const sampleRate = audioContext.current.sampleRate
    const length = 2 * sampleRate // 2 seconds
    const impulse = audioContext.current.createBuffer(2, length, sampleRate)
    const leftChannel = impulse.getChannelData(0)
    const rightChannel = impulse.getChannelData(1)

    // Exponential decay for reverb
    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.5)) // 0.5 second decay
      // Random noise with decay
      leftChannel[i] = (Math.random() * 2 - 1) * decay
      rightChannel[i] = (Math.random() * 2 - 1) * decay
    }

    setImpulseResponse(impulse)
  }, [])

  // Initialize tracks with default effect values
  const createTrack = (sampleId: string): CompositionTrack => {
    return {
      id: Date.now().toString(),
      sampleId,
      startTime: 0,
      repetitions: 1,
      volume: 0.8,
      pitchSemitones: 0,
      reverbAmount: 0.0,
      delayTime: 0.0,
      delayFeedback: 0.0,
    }
  }

  // Convert semitones to playback rate
  const semitonesToPlaybackRate = (semitones: number): number => {
    return Math.pow(2, semitones / 12)
  }

  // Apply pitch effect
  const applyPitchEffect = (
    track: CompositionTrack,
    source: AudioBufferSourceNode
  ) => {
    // Convert semitones to playback rate
    source.playbackRate.value = semitonesToPlaybackRate(track.pitchSemitones)
  }

  // Play a single sample
  const playSample = (sample: Sample) => {
    if (!audioContext.current || !gainNode.current) return

    // Stop any currently playing sample
    audioSources.current.forEach((source) => {
      try {
        source.stop()
      } catch (e) {
        console.log(e)
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

    const newTrack = createTrack(selectedSampleId)
    setTracks([...tracks, newTrack])
    updateCompositionDuration([...tracks, newTrack])

    toast({
      title: "Track added",
      description: "Sample added to the timeline",
    })
  }

  // Remove a track from the composition
  const removeTrack = (trackId: string) => {
    const updatedTracks = tracks.filter((track) => track.id !== trackId)
    setTracks(updatedTracks)
    updateCompositionDuration(updatedTracks)

    toast({
      title: "Track removed",
      description: "Sample removed from the timeline",
    })
  }

  // Update track properties
  const updateTrack = (trackId: string, updates: Partial<CompositionTrack>) => {
    const updatedTracks = tracks.map((track) =>
      track.id === trackId ? { ...track, ...updates } : track
    )
    setTracks(updatedTracks)
    updateCompositionDuration(updatedTracks)
  }

  // Clean up any existing playback
  const stopPlayback = () => {
    audioSources.current.forEach((source) => {
      try {
        source.stop()
      } catch (e) {
        console.log(e)
      }
    })
    audioSources.current = []

    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current)
      timeUpdateInterval.current = null
    }

    setIsPlaying(false)
  }

  // Play the entire composition
  const playComposition = () => {
    if (!audioContext.current || !gainNode.current || tracks.length === 0)
      return

    // Stop any currently playing sources
    stopPlayback()

    // Start new playback
    const startTime = audioContext.current.currentTime
    startTimeRef.current = startTime

    // Start playback from current time
    const playbackStartTime = currentTime

    tracks.forEach((track) => {
      const sample = samples.find((s) => s.id === track.sampleId)
      if (!sample || !audioContext.current || !gainNode.current) return

      // Calculate playback rate from semitones
      const playbackRate = semitonesToPlaybackRate(track.pitchSemitones)

      // Skip tracks that start after the current time
      if (track.startTime > playbackStartTime) {
        for (let i = 0; i < track.repetitions; i++) {
          const source = audioContext.current.createBufferSource()
          source.buffer = sample.buffer

          // Apply pitch effect
          applyPitchEffect(track, source)

          // Create effect nodes
          const trackGain = audioContext.current.createGain()
          trackGain.gain.value = track.volume

          // Create reverb if needed
          let reverbNode: ConvolverNode | null = null
          let dryGain: GainNode | null = null
          let wetGain: GainNode | null = null

          if (track.reverbAmount > 0 && impulseResponse) {
            // Create reverb (convolver) node
            reverbNode = audioContext.current.createConvolver()
            reverbNode.buffer = impulseResponse

            // Create dry/wet mix
            dryGain = audioContext.current.createGain()
            wetGain = audioContext.current.createGain()

            // Set dry/wet mix based on reverb amount
            dryGain.gain.value = 1 - track.reverbAmount
            wetGain.gain.value = track.reverbAmount
          }

          // Create delay if needed
          let delayNode: DelayNode | null = null
          let delayFeedbackGain: GainNode | null = null
          let delayDryGain: GainNode | null = null
          let delayWetGain: GainNode | null = null

          if (track.delayTime > 0) {
            // Create delay node
            delayNode = audioContext.current.createDelay(2.0) // Max 2 seconds delay
            delayNode.delayTime.value = track.delayTime

            // Create feedback loop for delay
            delayFeedbackGain = audioContext.current.createGain()
            delayFeedbackGain.gain.value = track.delayFeedback

            // Create dry/wet mix for delay
            delayDryGain = audioContext.current.createGain()
            delayWetGain = audioContext.current.createGain()

            // Set dry/wet mix based on feedback amount
            delayDryGain.gain.value = 1.0
            delayWetGain.gain.value = 0.8
          }

          // Connect nodes - this gets complex with multiple effects
          // First, create a chain of connections
          const currentNode: AudioNode = source

          // Apply delay if needed
          if (
            track.delayTime > 0 &&
            delayNode &&
            delayFeedbackGain &&
            delayDryGain &&
            delayWetGain
          ) {
            // Split signal for dry/wet mix
            currentNode.connect(delayDryGain)
            currentNode.connect(delayNode)

            // Create feedback loop
            delayNode.connect(delayFeedbackGain)
            delayFeedbackGain.connect(delayNode)

            // Connect wet path
            delayNode.connect(delayWetGain)

            // Mix dry and wet paths
            delayDryGain.connect(trackGain)
            delayWetGain.connect(trackGain)
          } else {
            // No delay, connect directly to next stage
            currentNode.connect(trackGain)
          }

          // Apply reverb if needed
          if (track.reverbAmount > 0 && reverbNode && dryGain && wetGain) {
            // If we didn't apply delay, we need to split the signal here
            if (!(track.delayTime > 0)) {
              // Disconnect source from trackGain to avoid double signal
              source.disconnect(trackGain)

              // Split the signal for dry/wet mix
              source.connect(dryGain)
              source.connect(reverbNode)

              // Connect dry and wet paths to the track gain node
              dryGain.connect(trackGain)
              reverbNode.connect(wetGain)
              wetGain.connect(trackGain)

              // Make sure trackGain is connected to the destination
              trackGain.connect(gainNode.current)
            } else {
              // If we already applied delay, the signal is already going through trackGain
              // We need to split from there

              // Create a new gain node for the final output
              const finalGain = audioContext.current.createGain()
              finalGain.gain.value = 1.0

              // Disconnect trackGain from its current destination
              trackGain.disconnect()

              // Split the signal
              trackGain.connect(dryGain)
              trackGain.connect(reverbNode)

              // Connect dry and wet paths to the final gain node
              dryGain.connect(finalGain)
              reverbNode.connect(wetGain)
              wetGain.connect(finalGain)

              // Connect final gain to destination
              finalGain.connect(gainNode.current)
            }
          } else {
            // No reverb, connect directly to destination
            trackGain.connect(gainNode.current)
          }

          const trackStartTime =
            track.startTime + i * (sample.buffer.duration / playbackRate)
          const scheduledStartTime =
            startTime + (trackStartTime - playbackStartTime)

          if (scheduledStartTime >= startTime) {
            source.start(scheduledStartTime)
            audioSources.current.push(source)
          }
        }
      } else {
        // For tracks that start before the current time
        const sampleDuration = sample.buffer.duration / playbackRate
        const trackEndTime =
          track.startTime + sampleDuration * track.repetitions

        // Only play if the track extends beyond the current time
        if (trackEndTime > playbackStartTime) {
          // Find which repetition we're in
          const repetitionIndex = Math.floor(
            (playbackStartTime - track.startTime) / sampleDuration
          )

          if (repetitionIndex < track.repetitions) {
            // Calculate offset within the sample
            const repetitionStartTime =
              track.startTime + repetitionIndex * sampleDuration
            const offsetInSample =
              (playbackStartTime - repetitionStartTime) * playbackRate

            // Play remaining repetitions
            for (let i = repetitionIndex; i < track.repetitions; i++) {
              const source = audioContext.current.createBufferSource()
              source.buffer = sample.buffer

              // Apply pitch effect
              applyPitchEffect(track, source)

              // Create effect nodes
              const trackGain = audioContext.current.createGain()
              trackGain.gain.value = track.volume

              // Create reverb if needed
              let reverbNode: ConvolverNode | null = null
              let dryGain: GainNode | null = null
              let wetGain: GainNode | null = null

              if (track.reverbAmount > 0 && impulseResponse) {
                // Create reverb (convolver) node
                reverbNode = audioContext.current.createConvolver()
                reverbNode.buffer = impulseResponse

                // Create dry/wet mix
                dryGain = audioContext.current.createGain()
                wetGain = audioContext.current.createGain()

                // Set dry/wet mix based on reverb amount
                dryGain.gain.value = 1 - track.reverbAmount
                wetGain.gain.value = track.reverbAmount
              }

              // Create delay if needed
              let delayNode: DelayNode | null = null
              let delayFeedbackGain: GainNode | null = null
              let delayDryGain: GainNode | null = null
              let delayWetGain: GainNode | null = null

              if (track.delayTime > 0) {
                // Create delay node
                delayNode = audioContext.current.createDelay(2.0) // Max 2 seconds delay
                delayNode.delayTime.value = track.delayTime

                // Create feedback loop for delay
                delayFeedbackGain = audioContext.current.createGain()
                delayFeedbackGain.gain.value = track.delayFeedback

                // Create dry/wet mix for delay
                delayDryGain = audioContext.current.createGain()
                delayWetGain = audioContext.current.createGain()

                // Set dry/wet mix based on feedback amount
                delayDryGain.gain.value = 1.0
                delayWetGain.gain.value = 0.8
              }

              // Connect nodes - this gets complex with multiple effects
              // First, create a chain of connections
              const currentNode: AudioNode = source

              // Apply delay if needed
              if (
                track.delayTime > 0 &&
                delayNode &&
                delayFeedbackGain &&
                delayDryGain &&
                delayWetGain
              ) {
                // Split signal for dry/wet mix
                currentNode.connect(delayDryGain)
                currentNode.connect(delayNode)

                // Create feedback loop
                delayNode.connect(delayFeedbackGain)
                delayFeedbackGain.connect(delayNode)

                // Connect wet path
                delayNode.connect(delayWetGain)

                // Mix dry and wet paths
                delayDryGain.connect(trackGain)
                delayWetGain.connect(trackGain)
              } else {
                // No delay, connect directly to next stage
                currentNode.connect(trackGain)
              }

              // Apply reverb if needed
              if (track.reverbAmount > 0 && reverbNode && dryGain && wetGain) {
                // If we didn't apply delay, we need to split the signal here
                if (!(track.delayTime > 0)) {
                  // Disconnect source from trackGain to avoid double signal
                  source.disconnect(trackGain)

                  // Split the signal for dry/wet mix
                  source.connect(dryGain)
                  source.connect(reverbNode)

                  // Connect dry and wet paths to the track gain node
                  dryGain.connect(trackGain)
                  reverbNode.connect(wetGain)
                  wetGain.connect(trackGain)

                  // Make sure trackGain is connected to the destination
                  trackGain.connect(gainNode.current)
                } else {
                  // If we already applied delay, the signal is already going through trackGain
                  // We need to split from there

                  // Create a new gain node for the final output
                  const finalGain = audioContext.current.createGain()
                  finalGain.gain.value = 1.0

                  // Disconnect trackGain from its current destination
                  trackGain.disconnect()

                  // Split the signal
                  trackGain.connect(dryGain)
                  trackGain.connect(reverbNode)

                  // Connect dry and wet paths to the final gain node
                  dryGain.connect(finalGain)
                  reverbNode.connect(wetGain)
                  wetGain.connect(finalGain)

                  // Connect final gain to destination
                  finalGain.connect(gainNode.current)
                }
              } else {
                // No reverb, connect directly to destination
                trackGain.connect(gainNode.current)
              }

              if (i === repetitionIndex) {
                // First repetition - start from offset
                source.start(startTime, offsetInSample)
              } else {
                // Subsequent repetitions - start from beginning
                const nextRepStartTime =
                  repetitionStartTime +
                  (i - repetitionIndex) * sampleDuration +
                  offsetInSample / playbackRate
                const scheduledStartTime =
                  startTime + (nextRepStartTime - playbackStartTime)
                source.start(scheduledStartTime)
              }

              audioSources.current.push(source)
            }
          }
        }
      }
    })

    setIsPlaying(true)

    // Update current time during playback
    timeUpdateInterval.current = setInterval(() => {
      if (audioContext.current) {
        const elapsed = audioContext.current.currentTime - startTimeRef.current
        const newTime = currentTime + elapsed

        if (newTime >= compositionDuration) {
          stopPlayback()
          setCurrentTime(0)
        } else {
          setCurrentTime(newTime)
        }
      }
    }, 50)
  }

  // Update the composition duration when tracks change
  const updateCompositionDuration = (updatedTracks: CompositionTrack[]) => {
    let maxEndTime = 0

    updatedTracks.forEach((track) => {
      const sample = samples.find((s) => s.id === track.sampleId)
      if (!sample) return

      // Adjust duration based on pitch
      const playbackRate = semitonesToPlaybackRate(track.pitchSemitones)
      const adjustedDuration = sample.buffer.duration / playbackRate
      const trackEndTime =
        track.startTime + adjustedDuration * track.repetitions
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

    toast({
      title: "Sample deleted",
      description: "Sample removed from library",
    })
  }

  // Save edited sample name
  const saveSampleName = () => {
    if (!editingSample || !newSampleName.trim()) return

    const updatedSamples = samples.map((sample) =>
      sample.id === editingSample.id
        ? { ...sample, name: newSampleName.trim() }
        : sample
    )

    setSamples(updatedSamples)
    setEditingSample(null)
    setNewSampleName("")

    toast({
      title: "Sample renamed",
      description: `Sample renamed to "${newSampleName.trim()}"`,
    })
  }

  // Format time in seconds to MM:SS format
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Handle track position change
  const handleTrackPositionChange = (trackId: string, newPosition: number) => {
    updateTrack(trackId, { startTime: Math.max(0, newPosition) })
  }

  // Open track editor
  const openTrackEditor = (track: CompositionTrack) => {
    setEditingTrack(track)
  }

  // Get sample color based on its index
  const getSampleColor = (sampleId: string) => {
    const colors = [
      "bg-blue-100 border-blue-300",
      "bg-green-100 border-green-300",
      "bg-purple-100 border-purple-300",
      "bg-amber-100 border-amber-300",
      "bg-rose-100 border-rose-300",
      "bg-cyan-100 border-cyan-300",
    ]

    const index = samples.findIndex((s) => s.id === sampleId)
    return colors[index % colors.length]
  }

  // Calculate track width based on duration, repetitions, and zoom
  const calculateTrackWidth = (
    sampleId: string,
    repetitions: number,
    pitchSemitones: number
  ) => {
    const sample = samples.find((s) => s.id === sampleId)
    if (!sample) return 0

    // Adjust duration based on pitch
    const playbackRate = semitonesToPlaybackRate(pitchSemitones)
    const adjustedDuration = sample.buffer.duration / playbackRate
    const totalDuration = adjustedDuration * repetitions
    return totalDuration * 100 * zoomLevel // 100px per second * zoom level
  }

  // Calculate track position based on start time and zoom
  const calculateTrackPosition = (startTime: number) => {
    return startTime * 100 * zoomLevel // 100px per second * zoom level
  }

  // Calculate playhead position
  const calculatePlayheadPosition = () => {
    return currentTime * 100 * zoomLevel // 100px per second * zoom level
  }

  // Seek to position in timeline
  const seekToPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || isPanning) return // Don't seek if we're dragging a track or panning

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left + timelineOffset

    // Calculate time based on click position and zoom level
    const newTime = clickX / (100 * zoomLevel)
    setCurrentTime(Math.max(0, Math.min(newTime, compositionDuration)))

    if (isPlaying) {
      stopPlayback()
      setTimeout(() => playComposition(), 50)
    }
  }

  // Export the composition to the selected format
  const exportComposition = async (format: ExportFormat, quality: number) => {
    if (!audioContext.current || tracks.length === 0) return

    // Create an offline audio context for rendering
    const offlineContext = new OfflineAudioContext(
      2, // Stereo output
      Math.ceil(compositionDuration * audioContext.current.sampleRate),
      audioContext.current.sampleRate
    )

    // Create a copy of the impulse response for the offline context
    let offlineReverbImpulse = null
    if (impulseResponse) {
      // Create a new buffer with the same specifications
      offlineReverbImpulse = offlineContext.createBuffer(
        impulseResponse.numberOfChannels,
        impulseResponse.length,
        impulseResponse.sampleRate
      )

      // Copy the data from each channel
      for (
        let channel = 0;
        channel < impulseResponse.numberOfChannels;
        channel++
      ) {
        const channelData = impulseResponse.getChannelData(channel)
        offlineReverbImpulse.copyToChannel(channelData, channel)
      }
    }

    // Render the audio
    const renderedBuffer = await offlineContext.startRendering()

    // Convert to the selected format
    let blob: Blob
    let extension: string

    switch (format) {
      case "mp3":
        blob = await audioBufferToMp3(renderedBuffer, quality)
        extension = "mp3"
        break
      case "flac":
        blob = await audioBufferToFlac(renderedBuffer, quality)
        extension = "flac"
        break
      case "wav":
      default:
        blob = audioBufferToWav(renderedBuffer, quality)
        extension = "wav"
        break
    }

    // Generate a filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .substring(0, 19)
    const filename = `composition-${timestamp}.${extension}`

    // Download the file
    downloadBlob(blob, filename)

    toast({
      title: "Export complete",
      description: `Saved as ${filename}`,
    })
  }

  // Check if a track has any effects applied
  const hasEffects = (track: CompositionTrack) => {
    return (
      track.pitchSemitones !== 0 ||
      track.reverbAmount > 0 ||
      track.delayTime > 0
    )
  }

  // Get a list of active effects for a track
  const getActiveEffects = (track: CompositionTrack) => {
    const effects = []
    if (track.pitchSemitones !== 0) {
      const direction = track.pitchSemitones > 0 ? "+" : ""
      effects.push(`Pitch: ${direction}${track.pitchSemitones} semitones`)
    }
    if (track.reverbAmount > 0)
      effects.push(`Reverb: ${Math.round(track.reverbAmount * 100)}%`)
    if (track.delayTime > 0)
      effects.push(`Delay: ${track.delayTime.toFixed(2)}s`)
    return effects
  }

  // Handle drag start for track positioning
  const handleDragStart = (e: React.MouseEvent, trackId: string) => {
    // Only respond to left mouse button (button 0)
    if (e.button !== 0) return

    e.stopPropagation()

    if (isPlaying) {
      stopPlayback()
    }

    const track = tracks.find((t) => t.id === trackId)
    if (!track) return

    setDraggingTrackId(trackId)
    setDragStartX(e.clientX)
    setDragStartTime(track.startTime)
    setIsDragging(true)

    // Add event listeners for drag and drop
    document.addEventListener("mousemove", handleDragMove)
    document.addEventListener("mouseup", handleDragEnd)
  }

  // Handle drag movement
  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging || !draggingTrackId || !timelineRef.current) return

    const track = tracks.find((t) => t.id === draggingTrackId)
    if (!track) return

    const deltaX = e.clientX - dragStartX
    const pixelsPerSecond = 100 * zoomLevel

    // Convert pixel movement to time
    const deltaTime = deltaX / pixelsPerSecond
    let newStartTime = Math.max(0, dragStartTime + deltaTime)

    // Snap to grid if shift key is not pressed (0.5 second intervals)
    if (!e.shiftKey) {
      newStartTime = Math.round(newStartTime * 2) / 2
    }

    updateTrack(draggingTrackId, { startTime: newStartTime })
  }

  // Handle drag end
  const handleDragEnd = () => {
    if (isDragging && draggingTrackId) {
      setIsDragging(false)
      setDraggingTrackId(null)

      // Remove event listeners
      document.removeEventListener("mousemove", handleDragMove)
      document.removeEventListener("mouseup", handleDragEnd)

      toast({
        title: "Track moved",
        description: "Sample position updated",
      })
    }
  }

  // Add this function to calculate timestamp intervals based on zoom level
  const getTimeStampInterval = () => {
    if (zoomLevel >= 2) return 0.5 // Show timestamps every 0.5 seconds when zoomed in a lot
    if (zoomLevel >= 1) return 1 // Show timestamps every 1 second at normal zoom
    if (zoomLevel >= 0.5) return 2 // Show timestamps every 2 seconds when zoomed out
    return 5 // Show timestamps every 5 seconds when zoomed out a lot
  }

  // Add these handlers for middle-click panning
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button (button 1)
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      setPanStartX(e.clientX)
      setPanStartOffset(timelineOffset)

      // Add event listeners for panning
      document.addEventListener("mousemove", handlePanMove)
      document.addEventListener("mouseup", handlePanEnd)
    }
  }

  const handlePanMove = (e: MouseEvent) => {
    if (!isPanning) return

    const deltaX = e.clientX - panStartX
    const newOffset = Math.max(0, panStartOffset - deltaX)
    setTimelineOffset(newOffset)
  }

  const handlePanEnd = () => {
    setIsPanning(false)
    document.removeEventListener("mousemove", handlePanMove)
    document.removeEventListener("mouseup", handlePanEnd)
  }

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleDragMove)
      document.removeEventListener("mouseup", handleDragEnd)
      document.removeEventListener("mousemove", handlePanMove)
      document.removeEventListener("mouseup", handlePanEnd)
    }
  }, [])

  // Format semitones for display
  const formatSemitones = (semitones: number): string => {
    if (semitones === 0) return "0"
    return semitones > 0 ? `+${semitones}` : `${semitones}`
  }

  return (
    <div className="grid gap-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="library">
            <Layers className="h-4 w-4 mr-2" />
            Sample Library
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Waveform className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="effects">
            <Music className="h-4 w-4 mr-2" />
            Effects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Samples</CardTitle>
            </CardHeader>
            <CardContent>
              {samples.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No samples available</p>
                  <p className="text-sm mt-2">
                    Extract samples from the waveform view
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {samples.map((sample) => (
                    <div
                      key={sample.id}
                      className={`flex flex-col p-3 rounded-md border ${
                        selectedSampleId === sample.id
                          ? "ring-2 ring-primary"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{sample.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(sample.buffer.duration)}
                        </div>
                      </div>

                      <SampleWaveform
                        audioBuffer={sample.buffer}
                        height={60}
                        className="mb-2 opacity-90"
                      />

                      <div className="flex items-center justify-between mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => playSample(sample)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Play
                        </Button>

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

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteSample(sample.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={
                              selectedSampleId === sample.id
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => setSelectedSampleId(sample.id)}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button onClick={addTrack} disabled={!selectedSampleId}>
              <Plus className="h-4 w-4 mr-2" />
              Add to Timeline
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Composition Timeline</CardTitle>
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  Duration: {formatTime(compositionDuration)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Current: {formatTime(currentTime)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isPlaying ? "destructive" : "default"}
                      onClick={isPlaying ? stopPlayback : playComposition}
                      disabled={tracks.length === 0}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {isPlaying ? "Stop" : "Play"}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setCurrentTime(0)}
                      disabled={tracks.length === 0}
                    >
                      Reset
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => setExportDialogOpen(true)}
                      disabled={tracks.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="zoom">Zoom:</Label>
                    <Slider
                      id="zoom"
                      className="w-32"
                      min={0.5}
                      max={3}
                      step={0.1}
                      value={[zoomLevel]}
                      onValueChange={(value) => setZoomLevel(value[0])}
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    setTimelineOffset(0)
                    setZoomLevel(1)
                  }}
                  className="ml-2"
                  title="Reset view"
                >
                  Reset View
                </Button>

                {tracks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No tracks in composition</p>
                    <p className="text-sm mt-2">
                      Select a sample and add it to the timeline
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-md p-4 overflow-x-auto">
                    {/* Timeline ruler */}
                    <div className="relative h-6 mb-2 border-b">
                      {Array.from({
                        length:
                          Math.ceil(
                            compositionDuration / getTimeStampInterval()
                          ) + 1,
                      }).map((_, i) => {
                        const time = i * getTimeStampInterval()
                        const xPos = time * 100 * zoomLevel - timelineOffset

                        // Only render timestamps that are in view
                        if (xPos < -50 || xPos > 1500) return null

                        return (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 border-l"
                            style={{ left: `${xPos}px` }}
                          >
                            <div className="text-xs text-muted-foreground ml-1">
                              {time % 1 === 0
                                ? `${time}s`
                                : `${time.toFixed(1)}s`}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Timeline tracks */}
                    <div
                      ref={timelineRef}
                      className="relative"
                      style={{
                        minHeight: `${tracks.length * 80}px`,
                        width: `${Math.max(compositionDuration * 100 * zoomLevel + 100, 500)}px`, // Add extra space
                        transform: `translateX(-${timelineOffset}px)`,
                        cursor: isPanning ? "grabbing" : "default",
                      }}
                      onClick={seekToPosition}
                      onMouseDown={handleTimelineMouseDown}
                      onContextMenu={(e) => e.preventDefault()} // Prevent context menu on right-click
                    >
                      {/* Playhead */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                        style={{ left: `${calculatePlayheadPosition()}px` }}
                      />

                      {/* Tracks */}
                      {tracks.map((track) => {
                        const sample = samples.find(
                          (s) => s.id === track.sampleId
                        )
                        if (!sample) return null

                        return (
                          <div key={track.id} className="relative h-20 mb-2">
                            <div
                              className={`absolute top-0 h-full rounded-md border-2 ${getSampleColor(
                                track.sampleId
                              )} overflow-hidden ${isDragging && draggingTrackId === track.id ? "opacity-70 cursor-grabbing" : "cursor-grab"}`}
                              style={{
                                left: `${calculateTrackPosition(track.startTime)}px`,
                                width: `${calculateTrackWidth(
                                  track.sampleId,
                                  track.repetitions,
                                  track.pitchSemitones
                                )}px`,
                              }}
                            >
                              <div
                                className="p-2 h-full"
                                onMouseDown={(e) =>
                                  handleDragStart(e, track.id)
                                }
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-medium text-sm truncate flex items-center">
                                    <Move className="h-3 w-3 mr-1 text-muted-foreground" />
                                    {sample.name}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {track.repetitions > 1 && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        x{track.repetitions}
                                      </Badge>
                                    )}
                                    {hasEffects(track) && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              FX
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <div className="text-xs">
                                              {getActiveEffects(track).map(
                                                (effect, i) => (
                                                  <div key={i}>{effect}</div>
                                                )
                                              )}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                </div>

                                {/* Simplified waveform visualization */}
                                <div className="h-[40px] overflow-hidden">
                                  <SampleWaveform
                                    audioBuffer={sample.buffer}
                                    height={40}
                                    className={`opacity-90 ${
                                      track.reverbAmount > 0 ? "opacity-70" : ""
                                    } transition-opacity`}
                                  />

                                  {/* Repetition markers */}
                                  {track.repetitions > 1 && (
                                    <div className="flex h-1 mt-1">
                                      {Array.from({
                                        length: track.repetitions,
                                      }).map((_, i) => (
                                        <div
                                          key={i}
                                          className="flex-1 border-r last:border-r-0 border-dashed border-black/20"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="absolute bottom-1 right-1 flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 bg-white/80 hover:bg-white"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openTrackEditor(track)
                                    }}
                                  >
                                    <Settings className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 bg-white/80 hover:bg-white"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeTrack(track.id)
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 hover:bg-white opacity-0 hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const trackStartTime = track.startTime
                                    setCurrentTime(trackStartTime)
                                    if (isPlaying) {
                                      stopPlayback()
                                      setTimeout(() => playComposition(), 50)
                                    }
                                  }}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="effects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Track Effects</CardTitle>
            </CardHeader>
            <CardContent>
              {tracks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No tracks to apply effects to</p>
                  <p className="text-sm mt-2">
                    Add samples to your composition first
                  </p>
                </div>
              ) : (
                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                  {tracks.map((track) => {
                    const sample = samples.find((s) => s.id === track.sampleId)
                    if (!sample) return null

                    return (
                      <div key={track.id} className="border rounded-md p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{sample.name}</div>
                            {hasEffects(track) && (
                              <Badge variant="secondary" className="text-xs">
                                Effects Applied
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTrackEditor(track)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Edit Track
                          </Button>
                        </div>

                        <div className="grid gap-6">
                          <div>
                            <Label className="mb-2 block">Volume</Label>
                            <div className="flex items-center gap-4">
                              <Volume2 className="h-4 w-4 text-muted-foreground" />
                              <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={[track.volume]}
                                onValueChange={(value) =>
                                  updateTrack(track.id, { volume: value[0] })
                                }
                              />
                              <span className="text-sm w-12 text-right">
                                {Math.round(track.volume * 100)}%
                              </span>
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <Label className="mb-2 block">
                              Pitch (Semitones)
                            </Label>
                            <div className="flex items-center gap-4">
                              <Music className="h-4 w-4 text-muted-foreground" />
                              <Slider
                                min={-12}
                                max={12}
                                step={1}
                                value={[track.pitchSemitones]}
                                onValueChange={(value) =>
                                  updateTrack(track.id, {
                                    pitchSemitones: value[0],
                                  })
                                }
                              />
                              <span className="text-sm w-12 text-right">
                                {formatSemitones(track.pitchSemitones)}
                              </span>
                            </div>
                          </div>

                          <div>
                            <Label className="mb-2 block">Reverb</Label>
                            <div className="flex items-center gap-4">
                              <Waves className="h-4 w-4 text-muted-foreground" />
                              <Slider
                                min={0}
                                max={1}
                                step={0.05}
                                value={[track.reverbAmount]}
                                onValueChange={(value) =>
                                  updateTrack(track.id, {
                                    reverbAmount: value[0],
                                  })
                                }
                              />
                              <span className="text-sm w-12 text-right">
                                {Math.round(track.reverbAmount * 100)}%
                              </span>
                            </div>
                          </div>

                          <div>
                            <Label className="mb-2 block">Delay</Label>
                            <div className="grid gap-4">
                              <div className="flex items-center gap-4">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                  <Label className="text-xs mb-1 block">
                                    Time
                                  </Label>
                                  <Slider
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    value={[track.delayTime]}
                                    onValueChange={(value) =>
                                      updateTrack(track.id, {
                                        delayTime: value[0],
                                      })
                                    }
                                  />
                                </div>
                                <span className="text-sm w-12 text-right">
                                  {track.delayTime.toFixed(2)}s
                                </span>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="w-4" />{" "}
                                {/* Spacer for alignment */}
                                <div className="flex-1">
                                  <Label className="text-xs mb-1 block">
                                    Feedback
                                  </Label>
                                  <Slider
                                    min={0}
                                    max={0.9}
                                    step={0.05}
                                    value={[track.delayFeedback]}
                                    onValueChange={(value) =>
                                      updateTrack(track.id, {
                                        delayFeedback: value[0],
                                      })
                                    }
                                    disabled={track.delayTime === 0}
                                  />
                                </div>
                                <span className="text-sm w-12 text-right">
                                  {Math.round(track.delayFeedback * 100)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <Label className="mb-2 block">Start Time</Label>
                            <div className="flex items-center gap-4">
                              <MoveHorizontal className="h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                min={0}
                                step={0.1}
                                value={track.startTime}
                                onChange={(e) =>
                                  handleTrackPositionChange(
                                    track.id,
                                    Number.parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                              <span className="text-sm">seconds</span>
                            </div>
                          </div>

                          <div>
                            <Label className="mb-2 block">Repetitions</Label>
                            <div className="flex items-center gap-4">
                              <Repeat className="h-4 w-4 text-muted-foreground" />
                              <Select
                                value={track.repetitions.toString()}
                                onValueChange={(value) =>
                                  updateTrack(track.id, {
                                    repetitions: Number.parseInt(value),
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select repetitions" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                                    <SelectItem
                                      key={num}
                                      value={num.toString()}
                                    >
                                      {num}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Sample Name Dialog */}
      <Dialog
        open={!!editingSample}
        onOpenChange={(open) => !open && setEditingSample(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sample Name</DialogTitle>
            <DialogDescription>
              Change the name of your audio sample
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="sample-name">Name</Label>
              <Input
                id="sample-name"
                value={newSampleName}
                onChange={(e) => setNewSampleName(e.target.value)}
              />
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

      {/* Edit Track Dialog */}
      <Dialog
        open={!!editingTrack}
        onOpenChange={(open) => !open && setEditingTrack(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Track</DialogTitle>
            <DialogDescription>
              Adjust track settings and effects
            </DialogDescription>
          </DialogHeader>
          {editingTrack && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="track-start">Start Time (seconds)</Label>
                <Input
                  id="track-start"
                  type="number"
                  min={0}
                  step={0.1}
                  value={editingTrack.startTime}
                  onChange={(e) =>
                    setEditingTrack({
                      ...editingTrack,
                      startTime: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="track-repetitions">Repetitions</Label>
                <Select
                  value={editingTrack.repetitions.toString()}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      repetitions: Number.parseInt(value),
                    })
                  }
                >
                  <SelectTrigger id="track-repetitions">
                    <SelectValue placeholder="Select repetitions" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="track-volume">Volume</Label>
                <Slider
                  id="track-volume"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[editingTrack.volume]}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      volume: value[0],
                    })
                  }
                />
                <div className="text-right text-sm text-muted-foreground">
                  {Math.round(editingTrack.volume * 100)}%
                </div>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label htmlFor="track-pitch">Pitch (Semitones)</Label>
                <Slider
                  id="track-pitch"
                  min={-12}
                  max={12}
                  step={1}
                  value={[editingTrack.pitchSemitones]}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      pitchSemitones: value[0],
                    })
                  }
                />
                <div className="text-right text-sm text-muted-foreground">
                  {formatSemitones(editingTrack.pitchSemitones)}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="track-reverb">Reverb</Label>
                <Slider
                  id="track-reverb"
                  min={0}
                  max={1}
                  step={0.05}
                  value={[editingTrack.reverbAmount]}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      reverbAmount: value[0],
                    })
                  }
                />
                <div className="text-right text-sm text-muted-foreground">
                  {Math.round(editingTrack.reverbAmount * 100)}%
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="track-delay-time">Delay Time</Label>
                <Slider
                  id="track-delay-time"
                  min={0}
                  max={1}
                  step={0.05}
                  value={[editingTrack.delayTime]}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      delayTime: value[0],
                    })
                  }
                />
                <div className="text-right text-sm text-muted-foreground">
                  {editingTrack.delayTime.toFixed(2)}s
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="track-delay-feedback">Delay Feedback</Label>
                <Slider
                  id="track-delay-feedback"
                  min={0}
                  max={0.9}
                  step={0.05}
                  value={[editingTrack.delayFeedback]}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      delayFeedback: value[0],
                    })
                  }
                  disabled={editingTrack.delayTime === 0}
                />
                <div className="text-right text-sm text-muted-foreground">
                  {Math.round(editingTrack.delayFeedback * 100)}%
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTrack(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingTrack) {
                  updateTrack(editingTrack.id, editingTrack)
                  setEditingTrack(null)
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={exportComposition}
        duration={compositionDuration}
      />
      <div className="text-xs text-muted-foreground mt-1 mb-2">
        Tip: Use middle-click and drag to pan the timeline when zoomed in
      </div>
    </div>
  )
}
