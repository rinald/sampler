"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Save, FileAudio, Download } from "lucide-react"

export type ExportFormat = "wav" | "mp3" | "flac"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (format: ExportFormat, quality: number) => Promise<void>
  duration: number
}

export function ExportDialog({
  open,
  onOpenChange,
  onExport,
  duration,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("wav")
  const [quality, setQuality] = useState(0.8)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleExport = async () => {
    setIsExporting(true)
    setProgress(0)

    try {
      // Set up progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = Math.min(prev + 5, 95)
          return newProgress
        })
      }, 200)

      await onExport(format, quality)

      clearInterval(progressInterval)
      setProgress(100)

      // Close dialog after a short delay
      setTimeout(() => {
        setIsExporting(false)
        setProgress(0)
        onOpenChange(false)
      }, 1000)
    } catch (error) {
      console.error("Export failed:", error)
      setIsExporting(false)
      setProgress(0)
    }
  }

  const formatInfo = {
    wav: {
      name: "WAV",
      description: "Uncompressed, highest quality, larger file size",
      icon: <FileAudio className="h-8 w-8 text-blue-500" />,
    },
    mp3: {
      name: "MP3",
      description: "Compressed, good quality, smaller file size",
      icon: <FileAudio className="h-8 w-8 text-green-500" />,
    },
    flac: {
      name: "FLAC",
      description: "Lossless compression, high quality, medium file size",
      icon: <FileAudio className="h-8 w-8 text-purple-500" />,
    },
  }

  const estimatedSize = () => {
    const minutes = duration / 60
    let sizeMB = 0

    switch (format) {
      case "wav":
        // ~10MB per minute for stereo 16-bit 44.1kHz
        sizeMB = minutes * 10
        break
      case "mp3":
        // ~1MB per minute for 128kbps, adjusted by quality
        sizeMB = minutes * (0.5 + quality)
        break
      case "flac":
        // ~5MB per minute, adjusted by quality
        sizeMB = minutes * (3 + quality * 2)
        break
    }

    return sizeMB.toFixed(1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Composition</DialogTitle>
          <DialogDescription>
            Choose a format and quality for your audio export
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <RadioGroup
            value={format}
            onValueChange={(value) => setFormat(value as ExportFormat)}
            className="grid grid-cols-1 gap-4"
          >
            {Object.entries(formatInfo).map(([key, info]) => (
              <div
                key={key}
                className={`flex items-start space-x-3 border rounded-lg p-3 cursor-pointer transition-colors ${
                  format === key
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                }`}
                onClick={() => setFormat(key as ExportFormat)}
              >
                <RadioGroupItem
                  value={key}
                  id={`format-${key}`}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center">
                    {info.icon}
                    <Label
                      htmlFor={`format-${key}`}
                      className="ml-2 font-medium"
                    >
                      {info.name}
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {info.description}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>

          {format === "mp3" && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Quality</Label>
                <span className="text-sm text-muted-foreground">
                  {quality < 0.4 ? "Low" : quality < 0.7 ? "Medium" : "High"}
                </span>
              </div>
              <Slider
                min={0.2}
                max={1}
                step={0.1}
                value={[quality]}
                onValueChange={(value) => setQuality(value[0])}
                disabled={isExporting}
              />
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span>
              Duration: {Math.floor(duration / 60)}:
              {Math.floor(duration % 60)
                .toString()
                .padStart(2, "0")}
            </span>
            <span>Estimated size: ~{estimatedSize()} MB</span>
          </div>
        </div>

        {isExporting && (
          <div className="space-y-2">
            <Label>Exporting...</Label>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <span className="flex items-center">
                <Save className="mr-2 h-4 w-4 animate-pulse" />
                Exporting...
              </span>
            ) : (
              <span className="flex items-center">
                <Download className="mr-2 h-4 w-4" />
                Export
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
