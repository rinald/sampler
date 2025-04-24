"use client"

import type React from "react"

import { useRef, useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut } from "lucide-react"

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
  selectedRegion,
  setSelectedRegion,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [isDrawn, setIsDrawn] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [currentSelection, setCurrentSelection] = useState<
    [number, number] | null
  >(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [zoomCenter, setZoomCenter] = useState(0) // Center point of zoom as a fraction of total duration

  // Format time in MM:SS format
  const formatTimeDetailed = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Convert canvas X position to audio time
  const xToTime = useCallback(
    (x: number, canvasWidth: number): number => {
      if (!audioBuffer) return 0

      // Calculate visible duration based on zoom
      const visibleDuration = audioBuffer.duration / zoomLevel

      // Calculate start and end times of visible section
      const startTime = Math.max(
        0,
        zoomCenter * audioBuffer.duration - visibleDuration / 2
      )
      const endTime = Math.min(
        audioBuffer.duration,
        startTime + visibleDuration
      )

      // Convert x position to time
      return startTime + (x / canvasWidth) * (endTime - startTime)
    },
    [audioBuffer, zoomLevel, zoomCenter]
  )

  // Convert audio time to canvas X position
  const timeToX = useCallback(
    (time: number, canvasWidth: number): number => {
      if (!audioBuffer) return 0

      // Calculate visible duration based on zoom
      const visibleDuration = audioBuffer.duration / zoomLevel

      // Calculate start and end times of visible section
      const startTime = Math.max(
        0,
        zoomCenter * audioBuffer.duration - visibleDuration / 2
      )
      const endTime = Math.min(
        audioBuffer.duration,
        startTime + visibleDuration
      )

      // Convert time to x position
      return ((time - startTime) / (endTime - startTime)) * canvasWidth
    },
    [audioBuffer, zoomLevel, zoomCenter]
  )

  // Draw waveform
  const drawWaveform = useCallback(() => {
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

    // Calculate visible duration based on zoom
    const visibleDuration = audioBuffer.duration / zoomLevel

    // Calculate start and end times of visible section
    const startTime = Math.max(
      0,
      zoomCenter * audioBuffer.duration - visibleDuration / 2
    )
    const endTime = Math.min(audioBuffer.duration, startTime + visibleDuration)

    // Calculate start and end samples
    const sampleRate = audioBuffer.sampleRate
    const startSample = Math.floor(startTime * sampleRate)
    const endSample = Math.ceil(endTime * sampleRate)
    const visibleSamples = endSample - startSample

    const step = Math.max(1, Math.ceil(visibleSamples / width))
    const amp = height / 2

    // Draw the middle line
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, amp)
    ctx.lineTo(width, amp)
    ctx.stroke()

    // Draw time markers
    const timeStep = zoomLevel <= 1 ? 1 : 0.5 // Adjust time step based on zoom
    ctx.fillStyle = "#9ca3af"
    ctx.font = "10px sans-serif"

    for (let t = Math.ceil(startTime); t <= endTime; t += timeStep) {
      const x = timeToX(t, width)
      ctx.beginPath()
      ctx.moveTo(x, height - 10)
      ctx.lineTo(x, height)
      ctx.stroke()
      ctx.fillText(`${t}s`, x + 2, height - 2)
    }

    // Draw the waveform with improved rendering
    ctx.beginPath()
    ctx.strokeStyle = "#6366f1"
    ctx.lineWidth = 2

    // Use a path for better performance
    const path = new Path2D()
    let isFirstPoint = true

    for (let i = 0; i < width; i++) {
      let minValue = 1.0
      let maxValue = -1.0

      const sampleOffset = startSample + i * step

      for (let j = 0; j < step; j++) {
        const index = sampleOffset + j
        if (index < channelData.length) {
          const datum = channelData[index]
          if (datum < minValue) minValue = datum
          if (datum > maxValue) maxValue = datum
        }
      }

      // Draw vertical line from min to max
      const x = i
      const y1 = (1 + minValue) * amp
      const y2 = (1 + maxValue) * amp

      if (isFirstPoint) {
        path.moveTo(x, y1)
        isFirstPoint = false
      }
      path.lineTo(x, y1)
      path.lineTo(x, y2)
    }

    // Stroke the entire path at once for better performance
    ctx.stroke(path)

    // Draw selected region if exists
    if (selectedRegion) {
      const [start, end] = selectedRegion
      const startX = timeToX(start, width)
      const endX = timeToX(end, width)

      ctx.fillStyle = "rgba(99, 102, 241, 0.3)" // Light purple
      ctx.fillRect(startX, 0, endX - startX, height)

      // Draw region borders
      ctx.strokeStyle = "rgba(99, 102, 241, 0.8)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(startX, 0)
      ctx.lineTo(startX, height)
      ctx.moveTo(endX, 0)
      ctx.lineTo(endX, height)
      ctx.stroke()
    }

    // Draw playhead
    const playheadX = timeToX(currentTime, width)
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = "#ef4444" // Red
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()
    }

    // Draw hover time indicator if hovering
    if (hoverTime !== null && !isDragging) {
      const hoverX = timeToX(hoverTime, width)
      if (hoverX >= 0 && hoverX <= width) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(hoverX, 0)
        ctx.lineTo(hoverX, height)
        ctx.stroke()
      }
    }

    setIsDrawn(true)
  }, [
    audioBuffer,
    currentTime,
    selectedRegion,
    hoverTime,
    zoomLevel,
    zoomCenter,
    timeToX,
  ])

  // Force initial draw when component mounts
  useEffect(() => {
    if (audioBuffer && !isDrawn) {
      drawWaveform()
    }
  }, [audioBuffer, isDrawn, drawWaveform])

  // Handle canvas click for playhead positioning
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (
      !canvasRef.current ||
      !containerRef.current ||
      isDragging ||
      !audioBuffer
    )
      return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = rect.width

    const clickTime = xToTime(x, width)
    setCurrentTime(Math.max(0, Math.min(clickTime, audioBuffer.duration)))
  }

  // Handle mouse down for region selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current || !containerRef.current || !audioBuffer) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = rect.width

    const startTime = xToTime(x, width)
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
    const currentHoverTime = xToTime(x, width)

    // Update hover time
    if (!isDragging) {
      setHoverTime(currentHoverTime)
    }

    // Handle selection dragging
    if (isDragging && dragStart !== null) {
      const currentDragTime = xToTime(x, width)

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

  // Handle mouse wheel for zooming
  const handleWheel = (e: React.WheelEvent) => {
    if (!audioBuffer || !canvasRef.current) return

    e.preventDefault()

    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseTimePosition = xToTime(mouseX, rect.width)

    // Calculate new zoom level
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1
    const newZoomLevel = Math.max(
      1,
      Math.min(10, zoomLevel + zoomDelta * zoomLevel)
    )

    if (newZoomLevel !== zoomLevel) {
      // Calculate new zoom center to keep mouse position stable
      const newZoomCenter = mouseTimePosition / audioBuffer.duration

      setZoomLevel(newZoomLevel)
      setZoomCenter(newZoomCenter)
    }
  }

  // Zoom in button handler
  const handleZoomIn = () => {
    if (!audioBuffer) return
    const newZoomLevel = Math.min(10, zoomLevel * 1.2)
    setZoomLevel(newZoomLevel)
  }

  // Zoom out button handler
  const handleZoomOut = () => {
    if (!audioBuffer) return
    const newZoomLevel = Math.max(1, zoomLevel / 1.2)
    setZoomLevel(newZoomLevel)

    // Reset zoom center if fully zoomed out
    if (newZoomLevel === 1) {
      setZoomCenter(0.5)
    }
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

  // Redraw when zoom changes
  useEffect(() => {
    drawWaveform()
  }, [zoomLevel, zoomCenter, drawWaveform])

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative border rounded-md overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "w-full h-[200px] cursor-pointer",
            isDragging && "cursor-col-resize"
          )}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
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

        {/* Zoom controls */}
        <div className="absolute top-2 right-2 flex space-x-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-white/80 hover:bg-white"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-white/80 hover:bg-white"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 10}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom level indicator */}
        {zoomLevel > 1 && (
          <div className="absolute top-2 right-20 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {zoomLevel.toFixed(1)}x
          </div>
        )}
      </div>

      {/* Selection info when not dragging */}
      {selectedRegion && !isDragging && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <div>Start: {formatTimeDetailed(selectedRegion[0])}</div>
          <div>
            Duration:{" "}
            {Math.round((selectedRegion[1] - selectedRegion[0]) * 10) / 10}s
          </div>
          <div>End: {formatTimeDetailed(selectedRegion[1])}</div>
        </div>
      )}
    </div>
  )
}
