"use client"

import { cn } from "@/lib/utils"
import { useWaveform } from "@/utils/waveform"

interface SampleWaveformProps {
  audioBuffer: AudioBuffer
  height?: number
  className?: string
}

export default function SampleWaveform({
  audioBuffer,
  height = 80,
  className,
}: SampleWaveformProps) {
  // Draw waveform
  const { canvasRef } = useWaveform(audioBuffer, height)

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full", className)}
      style={{ height: `${height}px` }}
    />
  )
}
