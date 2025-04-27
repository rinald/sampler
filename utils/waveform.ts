import { useRef, useEffect } from "react"

const useWaveform = (audioBuffer: AudioBuffer, height = 80) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !audioBuffer) return

    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    // Set the canvas dimensions accounting for device pixel ratio
    canvas.width = rect.width * dpr
    canvas.height = height * dpr

    // Scale the context to ensure correct drawing operations
    ctx.scale(dpr, dpr)

    // Set display size in CSS pixels
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${height}px`

    const displayWidth = rect.width
    const displayHeight = height

    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight)

    // Get audio data
    const channelData = audioBuffer.getChannelData(0) // Use first channel
    const step = Math.ceil(channelData.length / displayWidth)
    const amp = displayHeight / 2

    // Draw the middle line
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, amp)
    ctx.lineTo(displayWidth, amp)
    ctx.stroke()

    // Draw the waveform with improved rendering
    ctx.beginPath()
    ctx.strokeStyle = "rgba(99, 102, 241, 0.8)"
    ctx.lineWidth = 1.5

    // Use a path for better performance
    const path = new Path2D()

    for (let i = 0; i < displayWidth; i++) {
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

      // Draw vertical line from min to max
      const x = i
      const y1 = (1 + minValue) * amp
      const y2 = (1 + maxValue) * amp

      path.moveTo(x, y1)
      path.lineTo(x, y2)
    }

    // Stroke the entire path at once for better performance
    ctx.stroke(path)

    // Add a subtle fill for better visibility
    ctx.fillStyle = "rgba(99, 102, 241, 0.1)"
    ctx.beginPath()
    ctx.moveTo(0, amp)

    for (let i = 0; i < displayWidth; i++) {
      let maxValue = -1.0

      for (let j = 0; j < step; j++) {
        const index = i * step + j
        if (index < channelData.length) {
          const datum = channelData[index]
          if (datum > maxValue) maxValue = datum
        }
      }

      ctx.lineTo(i, (1 + maxValue) * amp)
    }

    // Complete the path back to the center line
    ctx.lineTo(displayWidth, amp)
    ctx.fill()
  }, [audioBuffer, height])

  return { canvasRef }
}

export { useWaveform }
