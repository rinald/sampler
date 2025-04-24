"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Save,
  Upload,
  Volume2,
  VolumeX,
  Trash2,
  Repeat,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import AudioWaveform from "@/components/audio-waveform"
import StudioWorkspace from "@/components/studio-workspace"
import { useToast } from "@/hooks/use-toast"

export default function AudioSampler() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<[number, number] | null>(
    null
  )
  const [samples, setSamples] = useState<
    { id: string; buffer: AudioBuffer; name: string }[]
  >([])
  const [repeatSelection, setRepeatSelection] = useState(false)
  const [respectSelection, setRespectSelection] = useState(true)
  const [selectionJustCreated, setSelectionJustCreated] = useState(false)

  const audioContext = useRef<AudioContext | null>(null)
  const audioSource = useRef<AudioBufferSourceNode | null>(null)
  const gainNode = useRef<GainNode | null>(null)
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const audioContextStartTimeRef = useRef<number>(0)
  const { toast } = useToast()

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== "undefined" && !audioContext.current) {
      audioContext.current = new window.AudioContext()
      gainNode.current = audioContext.current.createGain()
      gainNode.current.connect(audioContext.current.destination)
    }

    return () => {
      if (audioContext.current) {
        audioContext.current.close()
      }
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current)
      }
    }
  }, [])

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file || !audioContext.current) return

    try {
      const arrayBuffer = await file.arrayBuffer()
      const decodedBuffer =
        await audioContext.current.decodeAudioData(arrayBuffer)
      setAudioBuffer(decodedBuffer)
      setDuration(decodedBuffer.duration)
      toast({
        title: "Audio loaded successfully",
        description: `Loaded: ${file.name}`,
      })
    } catch (error) {
      toast({
        title: "Error loading audio",
        description: "Could not decode the audio file",
        variant: "destructive",
      })
      console.error("Error decoding audio data", error)
    }
  }

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Clean up any existing playback
  const stopExistingPlayback = () => {
    if (audioSource.current) {
      try {
        audioSource.current.stop()
      } catch (e) {
        console.log(e)
      }
      audioSource.current = null
    }

    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current)
      timeUpdateInterval.current = null
    }

    setIsPlaying(false)
  }

  // Start playback from a specific position
  const startPlayback = (fromPosition: number) => {
    if (!audioBuffer || !audioContext.current || !gainNode.current) return

    // Create a new audio source
    const source = audioContext.current.createBufferSource()
    source.buffer = audioBuffer
    source.connect(gainNode.current)

    // Store references for time tracking
    startTimeRef.current = fromPosition
    audioContextStartTimeRef.current = audioContext.current.currentTime

    // Determine if we should respect selection boundaries
    const shouldRespectSelection = selectedRegion && respectSelection

    // If respecting selection and starting position is outside selection, adjust it
    if (shouldRespectSelection) {
      const [selStart, selEnd] = selectedRegion
      if (fromPosition < selStart || fromPosition > selEnd) {
        fromPosition = selStart
        startTimeRef.current = fromPosition
      }
    }

    // Start playback
    source.start(0, fromPosition)
    audioSource.current = source
    setIsPlaying(true)

    // Set up time update interval
    timeUpdateInterval.current = setInterval(() => {
      if (audioContext.current) {
        const elapsed =
          audioContext.current.currentTime - audioContextStartTimeRef.current
        const newPosition = startTimeRef.current + elapsed

        // Check if we've reached the end of the selection or audio
        if (shouldRespectSelection && newPosition >= selectedRegion[1]) {
          if (repeatSelection) {
            // If repeat is enabled, loop back to start of selection
            stopExistingPlayback()
            setTimeout(() => startPlayback(selectedRegion[0]), 50)
          } else {
            // Otherwise stop playback
            stopExistingPlayback()
            setCurrentTime(selectedRegion[0])
          }
        } else if (newPosition >= audioBuffer.duration) {
          // Reached end of audio
          stopExistingPlayback()
          setCurrentTime(0)
        } else {
          // Update current time
          setCurrentTime(newPosition)
        }
      }
    }, 50)

    // Set up onended handler
    source.onended = () => {
      stopExistingPlayback()
    }
  }

  // Play/pause audio
  const togglePlayback = () => {
    if (!audioBuffer) return

    // If already playing, stop playback
    if (isPlaying) {
      stopExistingPlayback()
      return
    }

    // Clean up any existing playback first
    stopExistingPlayback()

    // Determine start position
    let startPosition = currentTime

    // If there's a selection and we're respecting it and outside it,
    // start from the beginning of the selection
    if (
      selectedRegion &&
      respectSelection &&
      (startPosition < selectedRegion[0] || startPosition >= selectedRegion[1])
    ) {
      startPosition = selectedRegion[0]
    }

    // Start playback
    startPlayback(startPosition)
  }

  // Update volume
  useEffect(() => {
    if (gainNode.current) {
      gainNode.current.gain.value = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Handle seeking (when user clicks on waveform)
  const handleSeek = (newTime: number, fromWaveformClick = false) => {
    // If clicking directly on the waveform outside the selection
    if (fromWaveformClick && selectedRegion) {
      const [start, end] = selectedRegion
      if (newTime < start || newTime > end) {
        // Turn off respect selection when clicking outside the selection
        setRespectSelection(false)
      }
    }

    setCurrentTime(newTime)

    // If playing, restart from new position
    if (isPlaying) {
      stopExistingPlayback()
      // Small delay to ensure clean restart
      setTimeout(() => startPlayback(newTime), 50)
    }
  }

  // Extract sample from selection
  const extractSample = () => {
    if (!audioBuffer || !selectedRegion || !audioContext.current) return

    const [start, end] = selectedRegion
    const sampleDuration = end - start
    const sampleBuffer = audioContext.current.createBuffer(
      audioBuffer.numberOfChannels,
      Math.floor(sampleDuration * audioBuffer.sampleRate),
      audioBuffer.sampleRate
    )

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = new Float32Array(sampleBuffer.length)
      audioBuffer.copyFromChannel(
        channelData,
        channel,
        Math.floor(start * audioBuffer.sampleRate)
      )
      sampleBuffer.copyToChannel(channelData, channel)
    }

    const newSample = {
      id: Date.now().toString(),
      buffer: sampleBuffer,
      name: `Sample ${samples.length + 1}`,
    }

    setSamples([...samples, newSample])

    toast({
      title: "Sample extracted",
      description: `Created: ${newSample.name}`,
    })
  }

  // Handle selection change
  const handleSelectionChange = (region: [number, number] | null) => {
    setSelectedRegion(region)

    // When creating a new selection, mark it as just created
    if (region) {
      setSelectionJustCreated(true)
    }
  }

  // Reset the selection just created flag after a short delay
  useEffect(() => {
    if (selectionJustCreated) {
      const timer = setTimeout(() => {
        setSelectionJustCreated(false)
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [selectionJustCreated])

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Audio Sample Workstation</CardTitle>
          <CardDescription>
            Upload, visualize, and manipulate audio samples
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!audioBuffer ? (
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Drag and drop your audio file here
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Or click to browse
              </p>
              <Button variant="outline">Select Audio File</Button>
              <input
                id="file-upload"
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) =>
                  e.target.files && handleFileUpload(e.target.files[0])
                }
              />
            </div>
          ) : (
            <Tabs defaultValue="waveform">
              <TabsList className="mb-4">
                <TabsTrigger value="waveform">Waveform</TabsTrigger>
                <TabsTrigger value="studio">Studio</TabsTrigger>
              </TabsList>

              <TabsContent value="waveform" className="space-y-4">
                <AudioWaveform
                  audioBuffer={audioBuffer}
                  currentTime={currentTime}
                  setCurrentTime={(time) => handleSeek(time, true)}
                  isPlaying={isPlaying}
                  selectedRegion={selectedRegion}
                  setSelectedRegion={handleSelectionChange}
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleSeek(0)}
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="icon"
                      onClick={togglePlayback}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleSeek(duration)}
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIsMuted(!isMuted)}
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Slider
                      className="w-24"
                      value={[volume]}
                      max={1}
                      step={0.01}
                      onValueChange={(value) => setVolume(value[0])}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      onClick={extractSample}
                      disabled={!selectedRegion}
                    >
                      <Scissors className="h-4 w-4 mr-2" />
                      Extract Selection
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedRegion(null)
                        setRespectSelection(true)
                      }}
                      disabled={!selectedRegion}
                    >
                      Clear Selection
                    </Button>
                  </div>

                  {selectedRegion && (
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="respect-selection"
                          checked={respectSelection}
                          onCheckedChange={(checked) => {
                            setRespectSelection(checked)
                            // If turning on respect selection and current time is outside selection,
                            // move to the beginning of the selection
                            if (checked && selectedRegion) {
                              const [start, end] = selectedRegion
                              if (currentTime < start || currentTime > end) {
                                setCurrentTime(start)
                              }
                            }
                          }}
                        />
                        <Label
                          htmlFor="respect-selection"
                          className="cursor-pointer"
                        >
                          Limit to Selection
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="repeat-mode"
                          checked={repeatSelection}
                          onCheckedChange={setRepeatSelection}
                          disabled={!respectSelection}
                        />
                        <Label
                          htmlFor="repeat-mode"
                          className={`flex items-center cursor-pointer ${!respectSelection ? "text-muted-foreground" : ""}`}
                        >
                          <Repeat className="h-4 w-4 mr-1" />
                          Repeat
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="studio">
                <StudioWorkspace
                  samples={samples}
                  setSamples={setSamples}
                  audioContext={audioContext}
                  gainNode={gainNode}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              stopExistingPlayback()
              setAudioBuffer(null)
              setSelectedRegion(null)
              setCurrentTime(0)
              setRespectSelection(true)
            }}
            disabled={!audioBuffer}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Audio
          </Button>

          <Button
            disabled={!audioBuffer}
            onClick={() => {
              // Export functionality would go here
              toast({
                title: "Export not implemented",
                description:
                  "This would export your audio in a real application",
              })
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// Helper function to format time in MM:SS format
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}
