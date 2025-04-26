import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"

import useStudioStore from "@/stores/studio"

// Format semitones for display
const formatSemitones = (semitones: number): string => {
  if (semitones === 0) return "0"
  return semitones > 0 ? `+${semitones}` : `${semitones}`
}

const EditTrackDialog = () => {
  const currentTrack = useStudioStore((state) => state.currentTrack)
  const updateTrack = useStudioStore((state) => state.updateTrack)
  const resetTrack = useStudioStore((state) => state.resetTrack)
  const tracks = useStudioStore((state) => state.tracks)
  const setTracks = useStudioStore((state) => state.setTracks)

  return (
    <Dialog
      open={!!currentTrack}
      onOpenChange={(open) => !open && resetTrack()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Track</DialogTitle>
          <DialogDescription>
            Adjust track settings and effects
          </DialogDescription>
        </DialogHeader>
        {currentTrack && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="track-start">Start Time (seconds)</Label>
              <Input
                id="track-start"
                type="number"
                min={0}
                step={0.1}
                value={currentTrack.startTime}
                onChange={(e) =>
                  updateTrack(
                    "startTime",
                    Number.parseFloat(e.target.value) || 0
                  )
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="track-repetitions">Repetitions</Label>
              <Select
                value={currentTrack.repetitions.toString()}
                onValueChange={(value) =>
                  updateTrack("repetitions", Number.parseInt(value))
                }
              >
                <SelectTrigger id="track-repetitions">
                  <SelectValue placeholder="Select repetitions" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="track-volume">Volume</Label>
              <Slider
                id="track-volume"
                min={0}
                max={1}
                step={0.01}
                value={[currentTrack.volume]}
                onValueChange={(value) => updateTrack("volume", value[0])}
              />
              <div className="text-right text-sm text-muted-foreground">
                {Math.round(currentTrack.volume * 100)}%
              </div>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label htmlFor="track-pitch">Pitch (Semitones)</Label>
              <Slider
                id="track-pitch"
                min={-12}
                max={12}
                step={1}
                value={[currentTrack.pitchSemitones]}
                onValueChange={(value) =>
                  updateTrack("pitchSemitones", value[0])
                }
              />
              <div className="text-right text-sm text-muted-foreground">
                {formatSemitones(currentTrack.pitchSemitones)}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="track-reverb">Reverb</Label>
              <Slider
                id="track-reverb"
                min={0}
                max={1}
                step={0.05}
                value={[currentTrack.reverbAmount]}
                onValueChange={(value) => updateTrack("reverbAmount", value[0])}
              />
              <div className="text-right text-sm text-muted-foreground">
                {Math.round(currentTrack.reverbAmount * 100)}%
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="track-delay-time">Delay Time</Label>
              <Slider
                id="track-delay-time"
                min={0}
                max={1}
                step={0.05}
                value={[currentTrack.delayTime]}
                onValueChange={(value) => updateTrack("delayTime", value[0])}
              />
              <div className="text-right text-sm text-muted-foreground">
                {currentTrack.delayTime.toFixed(2)}s
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="track-delay-feedback">Delay Feedback</Label>
              <Slider
                id="track-delay-feedback"
                min={0}
                max={0.9}
                step={0.05}
                value={[currentTrack.delayFeedback]}
                onValueChange={(value) =>
                  updateTrack("delayFeedback", value[0])
                }
                disabled={currentTrack.delayTime === 0}
              />
              <div className="text-right text-sm text-muted-foreground">
                {Math.round(currentTrack.delayFeedback * 100)}%
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={resetTrack}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (currentTrack) {
                resetTrack()
                setTracks(
                  tracks.map((track) =>
                    track.id === currentTrack.id ? currentTrack : track
                  )
                )
              }
            }}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default EditTrackDialog
