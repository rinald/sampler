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
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Save, FileAudio, Download } from "lucide-react"

export type ExportFormat = "wav"

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

      await onExport("wav", quality)

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

  const estimatedSize = () => {
    const minutes = duration / 60
    // ~10MB per minute for stereo 16-bit 44.1kHz
    return (minutes * 10).toFixed(1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Composition</DialogTitle>
          <DialogDescription>
            Choose the quality for your WAV export
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-start space-x-3 border rounded-lg p-3">
            <div className="flex-1">
              <div className="flex items-center">
                <FileAudio className="h-8 w-8 text-blue-500" />
                <Label className="ml-2 font-medium">WAV</Label>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Uncompressed, highest quality, larger file size
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Quality</Label>
              <span className="text-sm text-muted-foreground">
                {quality < 0.8 ? "16-bit" : "24-bit"}
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
