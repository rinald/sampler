"use client"

import type React from "react"

import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface AudioWaveformProps {
  audioBuffer: AudioBuffer
  currentTime: number
  setCurrentTime: (time: number) => void
  isPlaying: boolean
  selectedRegion: [number, number] | null
  setSelectedRegion: (region: [number, number] | null) => void
}

export default function AudioWaveform({
  audioBuffer,
  currentTime,
  setCurrentTime,
  isPlaying,
  selectedRegion,
  setSelectedRegion,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [isDrawn, setIsDrawn] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [currentSelection, setCurrentSelection] = useState<[number, number] | null>(null)

  // Format time in MM:SS format
  const formatTimeDetailed = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !audioBuffer) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Make sure canvas dimensions are set
    if (canvas.width === 0 && containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect()
      canvas.width = width
      canvas.height = 200
    }

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw background
    ctx.fillStyle = "#f9fafb" // Light gray background
    ctx.fillRect(0, 0, width, height)

    // Get audio data
    const channelData = audioBuffer.getChannelData(0) // Use first channel
    const step = Math.ceil(channelData.length / width)
    const amp = height / 2

    // Draw the middle line
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, amp)
    ctx.lineTo(width, amp)
    ctx.stroke()

    // Draw the waveform
    ctx.beginPath()
    ctx.strokeStyle = "#6366f1"
    ctx.lineWidth = 2

    for (let i = 0; i < width; i++) {
      let minValue = 1.0
      let maxValue = -1.0

      for (let j = 0; j < step; j++) {
        const index = i * step + j
        if (index < channelData.length) {
          const datum = channelData[index]
          if (datum < minValue) minValue = datum
          if (datum > maxValue) maxValue = datum
        }
      }

      ctx.moveTo(i, (1 + minValue) * amp)
      ctx.lineTo(i, (1 + maxValue) * amp)
    }

    ctx.stroke()

    // Draw selected region if exists
    if (selectedRegion) {
      const [start, end] = selectedRegion
      const startX = (start / audioBuffer.duration) * width
      const endX = (end / audioBuffer.duration) * width

      ctx.fillStyle = "rgba(99, 102, 241, 0.3)" // Light purple
      ctx.fillRect(startX, 0, endX - startX, height)
    }

    // Draw playhead
    const playheadX = (currentTime / audioBuffer.duration) * width
    ctx.strokeStyle = "#ef4444" // Red
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, height)
    ctx.stroke()

    // Draw hover time indicator if hovering
    if (hoverTime !== null && !isDragging) {
      const hoverX = (hoverTime / audioBuffer.duration) * width
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(hoverX, 0)
      ctx.lineTo(hoverX, height)
      ctx.stroke()
    }

    setIsDrawn(true)
  }, [audioBuffer, currentTime, selectedRegion, isDrawn, hoverTime])

  // Force initial draw when component mounts
  useEffect(() => {
    if (audioBuffer && !isDrawn) {
      // Force a redraw
      const event = new Event("resize")
      window.dispatchEvent(event)
    }
  }, [audioBuffer, isDrawn])

  // Handle canvas click for playhead positioning
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || !containerRef.current || isDragging) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = rect.width

    const clickTime = (x / width) * audioBuffer.duration
    setCurrentTime(Math.max(0, Math.min(clickTime, audioBuffer.duration)))
  }

  // Handle mouse down for region selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current || !containerRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = rect.width

    const startTime = (x / width) * audioBuffer.duration
    setDragStart(startTime)
    setIsDragging(true)

    // Initialize current selection
    setCurrentSelection([startTime, startTime])
  }

  // Handle mouse move for region selection and hover time
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || !audioBuffer) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = rect.width
    const currentHoverTime = (x / width) * audioBuffer.duration

    // Update hover time
    if (!isDragging) {
      setHoverTime(currentHoverTime)
    }

    // Handle selection dragging
    if (isDragging && dragStart !== null) {
      const currentDragTime = (x / width) * audioBuffer.duration

      // Ensure start time is always less than end time
      const startTime = Math.min(dragStart, currentDragTime)
      const endTime = Math.max(dragStart, currentDragTime)

      // Update the current selection for display
      setCurrentSelection([startTime, endTime])

      // Only update the actual selection when mouse is released
      setSelectedRegion([startTime, endTime])
    }
  }

  // Handle mouse up to end region selection
  const handleMouseUp = () => {
    if (isDragging && currentSelection) {
      // Finalize the selection
      setSelectedRegion(currentSelection)
    }
    setIsDragging(false)
    setDragStart(null)
  }

  // Handle mouse leave
  const handleMouseLeave = () => {
    setHoverTime(null)
    handleMouseUp()
  }

  // Update canvas dimensions on resize
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!canvasRef.current || !containerRef.current) return

      const { width } = containerRef.current.getBoundingClientRect()
      canvasRef.current.width = width
      canvasRef.current.height = 200

      // Force redraw after resize
      setIsDrawn(false)
    }

    // Initial size
    updateCanvasSize()

    // Update on resize
    window.addEventListener("resize", updateCanvasSize)

    return () => {
      window.removeEventListener("resize", updateCanvasSize)
    }
  }, [audioBuffer])

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="relative border rounded-md overflow-hidden">
        <canvas
          ref={canvasRef}
          className={cn("w-full h-[200px] cursor-pointer", isDragging && "cursor-col-resize")}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />

        {/* Hover time indicator */}
        {hoverTime !== null && !isDragging && (
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {formatTimeDetailed(hoverTime)}
          </div>
        )}

        {/* Selection time indicators */}
        {isDragging && currentSelection && (
          <div className="absolute bottom-2 left-2 right-2 flex justify-between">
            <div className="bg-black/70 text-white text-xs px-2 py-1 rounded">
              Start: {formatTimeDetailed(currentSelection[0])}
            </div>
            <div className="bg-black/70 text-white text-xs px-2 py-1 rounded">
              End: {formatTimeDetailed(currentSelection[1])}
            </div>
          </div>
        )}
      </div>

      {/* Selection info when not dragging */}
      {selectedRegion && !isDragging && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <div>Start: {formatTimeDetailed(selectedRegion[0])}</div>
          <div>Duration: {Math.round(selectedRegion[1] - selectedRegion[0])}s</div>
          <div>End: {formatTimeDetailed(selectedRegion[1])}</div>
        </div>
      )}
    </div>
  )
}

