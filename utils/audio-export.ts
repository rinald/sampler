export function audioBufferToWav(audioBuffer: AudioBuffer, quality = 1): Blob {
  // Get the number of channels
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate

  // Calculate bit depth based on quality (16-bit or 24-bit)
  const bitsPerSample = quality >= 0.8 ? 24 : 16
  const bytesPerSample = bitsPerSample / 8

  // Create the buffer
  const buffer = new ArrayBuffer(
    44 + audioBuffer.length * numChannels * bytesPerSample
  )
  const view = new DataView(buffer)

  // Write the WAV header
  // "RIFF" chunk descriptor
  writeString(view, 0, "RIFF")
  view.setUint32(
    4,
    36 + audioBuffer.length * numChannels * bytesPerSample,
    true
  )
  writeString(view, 8, "WAVE")

  // "fmt " sub-chunk
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // audio format (1 for PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true) // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true) // block align
  view.setUint16(34, bitsPerSample, true)

  // "data" sub-chunk
  writeString(view, 36, "data")
  view.setUint32(40, audioBuffer.length * numChannels * bytesPerSample, true)

  // Write the PCM samples
  const dataOffset = 44
  let offset = dataOffset

  // Helper function to write audio samples
  const writeSample = (sample: number) => {
    // Clamp the sample to [-1, 1]
    sample = Math.max(-1, Math.min(1, sample))

    if (bitsPerSample === 16) {
      // Convert to 16-bit PCM
      sample = sample * 32767
      view.setInt16(offset, sample, true)
      offset += 2
    } else {
      // Convert to 24-bit PCM
      sample = sample * 8388607
      const value = Math.floor(sample)
      view.setUint8(offset, value & 0xff)
      view.setUint8(offset + 1, (value >> 8) & 0xff)
      view.setUint8(offset + 2, (value >> 16) & 0xff)
      offset += 3
    }
  }

  // Interleave channels
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i]
      writeSample(sample)
    }
  }

  return new Blob([buffer], { type: "audio/wav" })
}

// Helper function to write a string to a DataView
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

// Download a blob as a file
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.style.display = "none"
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()

  // Clean up
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}
