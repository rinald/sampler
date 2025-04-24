"use client"

import { useState, useRef, type MutableRefObject } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Pause, RotateCcw, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AudioEffectsProps {
  audioBuffer: AudioBuffer
  setAudioBuffer: (buffer: AudioBuffer) => void
  audioContext: MutableRefObject<AudioContext | null>
}

export default function AudioEffects({
  audioBuffer,
  setAudioBuffer,
  audioContext,
}: AudioEffectsProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Effect parameters
  const [gain, setGain] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [lowPass, setLowPass] = useState(20000)
  const [highPass, setHighPass] = useState(20)

  const audioSource = useRef<AudioBufferSourceNode | null>(null)
  const { toast } = useToast()

  // Play audio with current effects
  const playWithEffects = () => {
    if (!audioContext.current || !audioBuffer) return

    if (isPlaying && audioSource.current) {
      audioSource.current.stop()
      audioSource.current = null
      setIsPlaying(false)
      return
    }

    // Stop any existing playback
    if (audioSource.current) {
      try {
        audioSource.current.stop()
      } catch (e) {
        console.log(e)
      }
      audioSource.current = null
    }

    const source = audioContext.current.createBufferSource()
    source.buffer = audioBuffer

    // Create effect nodes
    const gainNode = audioContext.current.createGain()
    gainNode.gain.value = gain

    // Low-pass filter
    const lowPassFilter = audioContext.current.createBiquadFilter()
    lowPassFilter.type = "lowpass"
    lowPassFilter.frequency.value = lowPass

    // High-pass filter
    const highPassFilter = audioContext.current.createBiquadFilter()
    highPassFilter.type = "highpass"
    highPassFilter.frequency.value = highPass

    // Connect nodes
    source.connect(lowPassFilter)
    lowPassFilter.connect(highPassFilter)
    highPassFilter.connect(gainNode)
    gainNode.connect(audioContext.current.destination)

    // Play
    source.start()
    audioSource.current = source
    setIsPlaying(true)

    source.onended = () => {
      setIsPlaying(false)
      audioSource.current = null
    }
  }

  // Apply effects permanently to the buffer
  const applyEffects = async () => {
    if (!audioContext.current || !audioBuffer) return

    setIsProcessing(true)

    try {
      // Create an offline audio context for processing
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      )

      // Create source
      const source = offlineContext.createBufferSource()
      source.buffer = audioBuffer

      // Create effect nodes
      const gainNode = offlineContext.createGain()
      gainNode.gain.value = gain

      // Low-pass filter
      const lowPassFilter = offlineContext.createBiquadFilter()
      lowPassFilter.type = "lowpass"
      lowPassFilter.frequency.value = lowPass

      // High-pass filter
      const highPassFilter = offlineContext.createBiquadFilter()
      highPassFilter.type = "highpass"
      highPassFilter.frequency.value = highPass

      // Connect nodes
      source.connect(lowPassFilter)
      lowPassFilter.connect(highPassFilter)
      highPassFilter.connect(gainNode)
      gainNode.connect(offlineContext.destination)

      // Start source
      source.start()

      // Render
      const renderedBuffer = await offlineContext.startRendering()

      // Update the audio buffer
      setAudioBuffer(renderedBuffer)

      toast({
        title: "Effects applied",
        description: "The audio has been processed with your effects",
      })
    } catch (error) {
      console.error("Error applying effects:", error)
      toast({
        title: "Error applying effects",
        description: "An error occurred while processing the audio",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Reset effects to default values
  const resetEffects = () => {
    setGain(1)
    setPitch(1)
    setLowPass(20000)
    setHighPass(20)
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={isPlaying ? "destructive" : "default"}
            onClick={playWithEffects}
            disabled={isProcessing}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isPlaying ? "Stop" : "Preview"}
          </Button>
          <Button
            variant="outline"
            onClick={resetEffects}
            disabled={isProcessing}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
        <Button onClick={applyEffects} disabled={isProcessing}>
          <Save className="h-4 w-4 mr-2" />
          Apply Effects
        </Button>
      </div>

      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Gain</Label>
                    <span className="text-sm">{gain.toFixed(2)}x</span>
                  </div>
                  <Slider
                    min={0}
                    max={2}
                    step={0.01}
                    value={[gain]}
                    onValueChange={(value) => setGain(value[0])}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pitch</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Pitch Shift</Label>
                    <span className="text-sm">{pitch.toFixed(2)}x</span>
                  </div>
                  <Slider
                    min={0.5}
                    max={2}
                    step={0.01}
                    value={[pitch]}
                    onValueChange={(value) => setPitch(value[0])}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Pitch shifting is a preview feature and may not be
                    applied in the final render
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="filters">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Frequency Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Low Pass Filter</Label>
                      <span className="text-sm">{lowPass} Hz</span>
                    </div>
                    <Slider
                      min={20}
                      max={20000}
                      step={10}
                      value={[lowPass]}
                      onValueChange={(value) => setLowPass(value[0])}
                    />
                    <p className="text-xs text-muted-foreground">
                      Removes frequencies above the cutoff
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label>High Pass Filter</Label>
                      <span className="text-sm">{highPass} Hz</span>
                    </div>
                    <Slider
                      min={20}
                      max={20000}
                      step={10}
                      value={[highPass]}
                      onValueChange={(value) => setHighPass(value[0])}
                    />
                    <p className="text-xs text-muted-foreground">
                      Removes frequencies below the cutoff
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
