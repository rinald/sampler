import { useRef } from "react"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import useStudioStore from "@/stores/studio"

const RenameSampleDialog = () => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const { toast } = useToast()
  const samples = useStudioStore((state) => state.samples)
  const currentSample = useStudioStore((state) => state.currentSample)
  const setSamples = useStudioStore((state) => state.setSamples)
  const setCurrentSample = useStudioStore((state) => state.setCurrentSample)

  const saveSampleName = () => {
    const newName = inputRef.current?.value.trim()

    if (!currentSample || !newName) return

    const updatedSamples = samples.map((sample) =>
      sample.id === currentSample.id ? { ...sample, name: newName } : sample
    )

    setSamples(updatedSamples)
    setCurrentSample(null)

    toast({
      title: "Sample renamed",
      description: `Sample renamed to "${newName}"`,
    })
  }

  return (
    <Dialog
      open={!!currentSample}
      onOpenChange={(open) => !open && setCurrentSample(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Sample Name</DialogTitle>
          <DialogDescription>
            Change the name of your audio sample
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="sample-name">Name</Label>
            <Input id="sample-name" ref={inputRef} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCurrentSample(null)}>
            Cancel
          </Button>
          <Button onClick={saveSampleName}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default RenameSampleDialog
