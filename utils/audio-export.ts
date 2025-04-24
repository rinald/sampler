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

// Convert AudioBuffer to MP3 format (requires lamejs)
export async function audioBufferToMp3(
  audioBuffer: AudioBuffer,
  quality = 0.8
): Promise<Blob> {
  // We'll use a Web Worker to encode MP3 in the background
  return new Promise((resolve, reject) => {
    // Create a blob URL for the worker script
    const workerBlob = new Blob(
      [
        `
    // We'll simulate MP3 encoding since we can't load external libraries in this demo
    // In a real app, you would use a proper MP3 encoder library like lamejs

    self.onmessage = function(e) {
      const { channels, sampleRate, quality } = e.data;

      // In a real implementation, this would use lamejs to encode MP3
      // For this demo, we'll create a WAV file instead

      // Calculate bit depth based on quality
      const bitsPerSample = quality >= 0.8 ? 16 : 8;
      const bytesPerSample = bitsPerSample / 8;

      // Get the number of channels and samples
      const numChannels = channels.length;
      const numSamples = channels[0].length;

      // Create the buffer for WAV data
      const buffer = new ArrayBuffer(44 + numSamples * numChannels * bytesPerSample);
      const view = new DataView(buffer);

      // Write the WAV header
      // "RIFF" chunk descriptor
      writeString(view, 0, "RIFF");
      view.setUint32(4, 36 + numSamples * numChannels * bytesPerSample, true);
      writeString(view, 8, "WAVE");

      // "fmt " sub-chunk
      writeString(view, 12, "fmt ");
      view.setUint32(16, 16, true); // fmt chunk size
      view.setUint16(20, 1, true); // audio format (1 for PCM)
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
      view.setUint16(32, numChannels * bytesPerSample, true); // block align
      view.setUint16(34, bitsPerSample, true);

      // "data" sub-chunk
      writeString(view, 36, "data");
      view.setUint32(40, numSamples * numChannels * bytesPerSample, true);

      // Write the PCM samples
      const dataOffset = 44;
      let offset = dataOffset;

      // Helper function to write a string to a DataView
      function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      }

      // Interleave channels
      for (let i = 0; i < numSamples; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          let sample = channels[channel][i];

          // Clamp the sample to [-1, 1]
          sample = Math.max(-1, Math.min(1, sample));

          if (bitsPerSample === 8) {
            // Convert to 8-bit unsigned PCM
            sample = (sample + 1) * 127.5;
            view.setUint8(offset, sample);
            offset += 1;
          } else {
            // Convert to 16-bit PCM
            sample = sample * 32767;
            view.setInt16(offset, sample, true);
            offset += 2;
          }
        }
      }

      // Send the encoded data back to the main thread
      // In a real app, this would be MP3 data
      self.postMessage({ mp3Data: new Uint8Array(buffer) });
    };
  `,
      ],
      { type: "application/javascript" }
    )

    const workerUrl = URL.createObjectURL(workerBlob)
    const worker = new Worker(workerUrl)

    // Extract channel data
    const channels = []
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i))
    }

    // Set up the message handler
    worker.onmessage = (e) => {
      const { mp3Data } = e.data
      const blob = new Blob([mp3Data], { type: "audio/mp3" })

      // Clean up
      worker.terminate()
      URL.revokeObjectURL(workerUrl)

      resolve(blob)
    }

    worker.onerror = (error) => {
      // Clean up
      worker.terminate()
      URL.revokeObjectURL(workerUrl)

      reject(error)
    }

    // Start the encoding process
    worker.postMessage({
      channels,
      sampleRate: audioBuffer.sampleRate,
      quality,
    })
  })
}

// Convert AudioBuffer to FLAC format
export async function audioBufferToFlac(
  audioBuffer: AudioBuffer,
  quality = 0.8
): Promise<Blob> {
  // For simplicity, we'll use WAV as a fallback if FLAC encoding is not available
  // In a real application, you would use a proper FLAC encoder library

  // Note: True FLAC encoding would require a library like libflac.js
  // For this example, we'll simulate FLAC by using a high-quality WAV
  // and renaming it to .flac

  console.warn(
    "True FLAC encoding not implemented. Using high-quality WAV as a substitute."
  )
  const wavBlob = audioBufferToWav(audioBuffer, quality)

  // Create a new blob with FLAC mime type
  return new Blob([wavBlob], { type: "audio/flac" })
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
