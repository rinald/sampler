"use client";

import type React from "react";

import { useState, useRef, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Pause,
  X,
  Plus,
  Edit,
  Trash2,
  Repeat,
  Volume2,
  Settings,
  MoveHorizontal,
  Filter,
  AudioWaveformIcon as Waveform,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import SampleWaveform from "@/components/sample-waveform";

interface Sample {
  id: string;
  buffer: AudioBuffer;
  name: string;
}

interface CompositionTrack {
  id: string;
  sampleId: string;
  startTime: number;
  repetitions: number;
  volume: number;
  // Add effect properties
  lowPass: number;
  highPass: number;
  gain: number;
}

interface StudioWorkspaceProps {
  samples: Sample[];
  setSamples: (samples: Sample[]) => void;
  audioContext: MutableRefObject<AudioContext | null>;
  gainNode: MutableRefObject<GainNode | null>;
}

export default function StudioWorkspace({
  samples,
  setSamples,
  audioContext,
  gainNode,
}: StudioWorkspaceProps) {
  const [tracks, setTracks] = useState<CompositionTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [newSampleName, setNewSampleName] = useState("");
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [compositionDuration, setCompositionDuration] = useState(0);
  const [editingTrack, setEditingTrack] = useState<CompositionTrack | null>(
    null,
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeTab, setActiveTab] = useState("library");

  const audioSources = useRef<AudioBufferSourceNode[]>([]);
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextStartTimeRef = useRef<number>(0);

  // Initialize tracks with default effect values
  const createTrack = (sampleId: string): CompositionTrack => {
    return {
      id: Date.now().toString(),
      sampleId,
      startTime: 0,
      repetitions: 1,
      volume: 0.8,
      lowPass: 20000,
      highPass: 20,
      gain: 1.0,
    };
  };

  // Play a single sample
  const playSample = (sample: Sample) => {
    if (!audioContext.current || !gainNode.current) return;

    // Stop any currently playing sample
    audioSources.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors from already stopped sources
      }
    });
    audioSources.current = [];

    const source = audioContext.current.createBufferSource();
    source.buffer = sample.buffer;

    const sampleGain = audioContext.current.createGain();
    sampleGain.gain.value = 0.8;

    source.connect(sampleGain);
    sampleGain.connect(gainNode.current);

    source.start();
    audioSources.current.push(source);

    source.onended = () => {
      // Remove this source from the array when it ends
      audioSources.current = audioSources.current.filter((s) => s !== source);
    };
  };

  // Add a track to the composition
  const addTrack = () => {
    if (!selectedSampleId) {
      return;
    }

    const newTrack = createTrack(selectedSampleId);
    setTracks([...tracks, newTrack]);
    updateCompositionDuration([...tracks, newTrack]);
  };

  // Remove a track from the composition
  const removeTrack = (trackId: string) => {
    const updatedTracks = tracks.filter((track) => track.id !== trackId);
    setTracks(updatedTracks);
    updateCompositionDuration(updatedTracks);
  };

  // Update track properties
  const updateTrack = (trackId: string, updates: Partial<CompositionTrack>) => {
    const updatedTracks = tracks.map((track) =>
      track.id === trackId ? { ...track, ...updates } : track,
    );
    setTracks(updatedTracks);
    updateCompositionDuration(updatedTracks);
  };

  // Clean up any existing playback
  const stopPlayback = () => {
    audioSources.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors from already stopped sources
      }
    });
    audioSources.current = [];

    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current);
      timeUpdateInterval.current = null;
    }

    setIsPlaying(false);
  };

  // Play the entire composition
  const playComposition = () => {
    if (!audioContext.current || !gainNode.current || tracks.length === 0)
      return;

    // Stop any currently playing sources
    stopPlayback();

    // Start new playback
    const startTime = audioContext.current.currentTime;
    startTimeRef.current = startTime;

    // Start playback from current time
    const playbackStartTime = currentTime;

    tracks.forEach((track) => {
      const sample = samples.find((s) => s.id === track.sampleId);
      if (!sample || !audioContext.current || !gainNode.current) return;

      // Skip tracks that start after the current time
      if (track.startTime > playbackStartTime) {
        for (let i = 0; i < track.repetitions; i++) {
          const source = audioContext.current.createBufferSource();
          source.buffer = sample.buffer;

          // Create effect nodes
          const trackGain = audioContext.current.createGain();
          trackGain.gain.value = track.volume * track.gain;

          // Low-pass filter
          const lowPassFilter = audioContext.current.createBiquadFilter();
          lowPassFilter.type = "lowpass";
          lowPassFilter.frequency.value = track.lowPass;

          // High-pass filter
          const highPassFilter = audioContext.current.createBiquadFilter();
          highPassFilter.type = "highpass";
          highPassFilter.frequency.value = track.highPass;

          // Connect nodes
          source.connect(lowPassFilter);
          lowPassFilter.connect(highPassFilter);
          highPassFilter.connect(trackGain);
          trackGain.connect(gainNode.current);

          const trackStartTime = track.startTime + i * sample.buffer.duration;
          const scheduledStartTime =
            startTime + (trackStartTime - playbackStartTime);

          if (scheduledStartTime >= startTime) {
            source.start(scheduledStartTime);
            audioSources.current.push(source);
          }
        }
      } else {
        // For tracks that start before the current time
        const sampleDuration = sample.buffer.duration;
        const trackEndTime =
          track.startTime + sampleDuration * track.repetitions;

        // Only play if the track extends beyond the current time
        if (trackEndTime > playbackStartTime) {
          // Find which repetition we're in
          const repetitionIndex = Math.floor(
            (playbackStartTime - track.startTime) / sampleDuration,
          );

          if (repetitionIndex < track.repetitions) {
            // Calculate offset within the sample
            const repetitionStartTime =
              track.startTime + repetitionIndex * sampleDuration;
            const offsetInSample = playbackStartTime - repetitionStartTime;

            // Play remaining repetitions
            for (let i = repetitionIndex; i < track.repetitions; i++) {
              const source = audioContext.current.createBufferSource();
              source.buffer = sample.buffer;

              // Create effect nodes
              const trackGain = audioContext.current.createGain();
              trackGain.gain.value = track.volume * track.gain;

              // Low-pass filter
              const lowPassFilter = audioContext.current.createBiquadFilter();
              lowPassFilter.type = "lowpass";
              lowPassFilter.frequency.value = track.lowPass;

              // High-pass filter
              const highPassFilter = audioContext.current.createBiquadFilter();
              highPassFilter.type = "highpass";
              highPassFilter.frequency.value = track.highPass;

              // Connect nodes
              source.connect(lowPassFilter);
              lowPassFilter.connect(highPassFilter);
              highPassFilter.connect(trackGain);
              trackGain.connect(gainNode.current);

              if (i === repetitionIndex) {
                // First repetition - start from offset
                source.start(startTime, offsetInSample);
              } else {
                // Subsequent repetitions - start from beginning
                const nextRepStartTime =
                  repetitionStartTime +
                  (i - repetitionIndex) * sampleDuration +
                  offsetInSample;
                const scheduledStartTime =
                  startTime + (nextRepStartTime - playbackStartTime);
                source.start(scheduledStartTime);
              }

              audioSources.current.push(source);
            }
          }
        }
      }
    });

    setIsPlaying(true);

    // Update current time during playback
    timeUpdateInterval.current = setInterval(() => {
      if (audioContext.current) {
        const elapsed = audioContext.current.currentTime - startTimeRef.current;
        const newTime = currentTime + elapsed;

        if (newTime >= compositionDuration) {
          stopPlayback();
          setCurrentTime(0);
        } else {
          setCurrentTime(newTime);
        }
      }
    }, 50);
  };

  // Calculate the total duration of the composition
  const calculateCompositionDuration = () => {
    let maxEndTime = 0;

    tracks.forEach((track) => {
      const sample = samples.find((s) => s.id === track.sampleId);
      if (!sample) return;

      const trackEndTime =
        track.startTime + sample.buffer.duration * track.repetitions;
      maxEndTime = Math.max(maxEndTime, trackEndTime);
    });

    return maxEndTime;
  };

  // Update the composition duration when tracks change
  const updateCompositionDuration = (updatedTracks: CompositionTrack[]) => {
    let maxEndTime = 0;

    updatedTracks.forEach((track) => {
      const sample = samples.find((s) => s.id === track.sampleId);
      if (!sample) return;

      const trackEndTime =
        track.startTime + sample.buffer.duration * track.repetitions;
      maxEndTime = Math.max(maxEndTime, trackEndTime);
    });

    setCompositionDuration(maxEndTime);
  };

  // Delete a sample
  const deleteSample = (sampleId: string) => {
    // Check if sample is used in any tracks
    const isUsed = tracks.some((track) => track.sampleId === sampleId);

    if (isUsed) {
      return;
    }

    const updatedSamples = samples.filter((sample) => sample.id !== sampleId);
    setSamples(updatedSamples);

    if (selectedSampleId === sampleId) {
      setSelectedSampleId(null);
    }
  };

  // Save edited sample name
  const saveSampleName = () => {
    if (!editingSample || !newSampleName.trim()) return;

    const updatedSamples = samples.map((sample) =>
      sample.id === editingSample.id
        ? { ...sample, name: newSampleName.trim() }
        : sample,
    );

    setSamples(updatedSamples);
    setEditingSample(null);
    setNewSampleName("");
  };

  // Format time in seconds to MM:SS format
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Handle track position change
  const handleTrackPositionChange = (trackId: string, newPosition: number) => {
    updateTrack(trackId, { startTime: Math.max(0, newPosition) });
  };

  // Open track editor
  const openTrackEditor = (track: CompositionTrack) => {
    setEditingTrack(track);
  };

  // Get sample color based on its index
  const getSampleColor = (sampleId: string) => {
    const colors = [
      "bg-blue-100 border-blue-300",
      "bg-green-100 border-green-300",
      "bg-purple-100 border-purple-300",
      "bg-amber-100 border-amber-300",
      "bg-rose-100 border-rose-300",
      "bg-cyan-100 border-cyan-300",
    ];

    const index = samples.findIndex((s) => s.id === sampleId);
    return colors[index % colors.length];
  };

  // Calculate track width based on duration and zoom
  const calculateTrackWidth = (sampleId: string, repetitions: number) => {
    const sample = samples.find((s) => s.id === sampleId);
    if (!sample) return 0;

    const duration = sample.buffer.duration * repetitions;
    return duration * 100 * zoomLevel; // 100px per second * zoom level
  };

  // Calculate track position based on start time and zoom
  const calculateTrackPosition = (startTime: number) => {
    return startTime * 100 * zoomLevel; // 100px per second * zoom level
  };

  // Calculate playhead position
  const calculatePlayheadPosition = () => {
    return currentTime * 100 * zoomLevel; // 100px per second * zoom level
  };

  // Seek to position in timeline
  const seekToPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timelineWidth = rect.width;

    // Calculate time based on click position and zoom level
    const newTime =
      (clickX / timelineWidth) * (compositionDuration / zoomLevel);
    setCurrentTime(Math.max(0, Math.min(newTime, compositionDuration)));

    if (isPlaying) {
      stopPlayback();
      setTimeout(() => playComposition(), 50);
    }
  };

  return (
    <div className="grid gap-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="library">
            <Layers className="h-4 w-4 mr-2" />
            Sample Library
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Waveform className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="effects">
            <Filter className="h-4 w-4 mr-2" />
            Effects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Samples</CardTitle>
            </CardHeader>
            <CardContent>
              {samples.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No samples available</p>
                  <p className="text-sm mt-2">
                    Extract samples from the waveform view
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {samples.map((sample) => (
                    <div
                      key={sample.id}
                      className={`flex flex-col p-3 rounded-md border ${
                        selectedSampleId === sample.id
                          ? "ring-2 ring-primary"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{sample.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(sample.buffer.duration)}
                        </div>
                      </div>

                      <SampleWaveform
                        audioBuffer={sample.buffer}
                        height={60}
                        className="mb-2 opacity-90"
                      />

                      <div className="flex items-center justify-between mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => playSample(sample)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Play
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingSample(sample);
                              setNewSampleName(sample.name);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteSample(sample.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={
                              selectedSampleId === sample.id
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => setSelectedSampleId(sample.id)}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button onClick={addTrack} disabled={!selectedSampleId}>
              <Plus className="h-4 w-4 mr-2" />
              Add to Timeline
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Composition Timeline</CardTitle>
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  Duration: {formatTime(compositionDuration)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Current: {formatTime(currentTime)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isPlaying ? "destructive" : "default"}
                      onClick={isPlaying ? stopPlayback : playComposition}
                      disabled={tracks.length === 0}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {isPlaying ? "Stop" : "Play"}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setCurrentTime(0)}
                      disabled={tracks.length === 0}
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="zoom">Zoom:</Label>
                    <Slider
                      id="zoom"
                      className="w-32"
                      min={0.5}
                      max={3}
                      step={0.1}
                      value={[zoomLevel]}
                      onValueChange={(value) => setZoomLevel(value[0])}
                    />
                  </div>
                </div>

                {tracks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No tracks in composition</p>
                    <p className="text-sm mt-2">
                      Select a sample and add it to the timeline
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-md p-4">
                    {/* Timeline ruler */}
                    <div className="relative h-6 mb-2 border-b">
                      {Array.from({
                        length: Math.ceil(compositionDuration) + 1,
                      }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l"
                          style={{ left: `${i * 100 * zoomLevel}px` }}
                        >
                          <div className="text-xs text-muted-foreground ml-1">
                            {i}s
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Timeline tracks */}
                    <div
                      className="relative"
                      style={{
                        minHeight: `${tracks.length * 80}px`,
                        width: `${Math.max(compositionDuration * 100 * zoomLevel, 500)}px`,
                      }}
                      onClick={seekToPosition}
                    >
                      {/* Playhead */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                        style={{ left: `${calculatePlayheadPosition()}px` }}
                      />

                      {/* Tracks */}
                      {tracks.map((track, index) => {
                        const sample = samples.find(
                          (s) => s.id === track.sampleId,
                        );
                        if (!sample) return null;

                        return (
                          <div key={track.id} className="relative h-20 mb-2">
                            <div
                              className={`absolute top-0 h-full rounded-md border-2 ${getSampleColor(track.sampleId)} overflow-hidden`}
                              style={{
                                left: `${calculateTrackPosition(track.startTime)}px`,
                                width: `${calculateTrackWidth(track.sampleId, track.repetitions)}px`,
                              }}
                            >
                              <div className="p-2">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-medium text-sm truncate">
                                    {sample.name}
                                  </div>
                                  <div className="text-xs">
                                    x{track.repetitions}
                                  </div>
                                </div>

                                <SampleWaveform
                                  audioBuffer={sample.buffer}
                                  height={40}
                                  className="opacity-90"
                                />

                                <div className="absolute bottom-1 right-1 flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 bg-white/80 hover:bg-white"
                                    onClick={() => openTrackEditor(track)}
                                  >
                                    <Settings className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 bg-white/80 hover:bg-white"
                                    onClick={() => removeTrack(track.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 hover:bg-white opacity-0 hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const trackStartTime = track.startTime;
                                    setCurrentTime(trackStartTime);
                                    if (isPlaying) {
                                      stopPlayback();
                                      setTimeout(() => playComposition(), 50);
                                    }
                                  }}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="effects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Track Effects</CardTitle>
            </CardHeader>
            <CardContent>
              {tracks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No tracks to apply effects to</p>
                  <p className="text-sm mt-2">
                    Add samples to your composition first
                  </p>
                </div>
              ) : (
                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                  {tracks.map((track) => {
                    const sample = samples.find((s) => s.id === track.sampleId);
                    if (!sample) return null;

                    return (
                      <div key={track.id} className="border rounded-md p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="font-medium">{sample.name}</div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTrackEditor(track)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Edit Track
                          </Button>
                        </div>

                        <div className="grid gap-6">
                          <div>
                            <Label className="mb-2 block">Volume</Label>
                            <div className="flex items-center gap-4">
                              <Volume2 className="h-4 w-4 text-muted-foreground" />
                              <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={[track.volume]}
                                onValueChange={(value) =>
                                  updateTrack(track.id, { volume: value[0] })
                                }
                              />
                              <span className="text-sm w-12 text-right">
                                {Math.round(track.volume * 100)}%
                              </span>
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <Label className="mb-2 block">
                              Low Pass Filter
                            </Label>
                            <div className="flex items-center gap-4">
                              <Filter className="h-4 w-4 text-muted-foreground" />
                              <Slider
                                min={20}
                                max={20000}
                                step={10}
                                value={[track.lowPass]}
                                onValueChange={(value) =>
                                  updateTrack(track.id, { lowPass: value[0] })
                                }
                              />
                              <span className="text-sm w-16 text-right">
                                {track.lowPass} Hz
                              </span>
                            </div>
                          </div>

                          <div>
                            <Label className="mb-2 block">
                              High Pass Filter
                            </Label>
                            <div className="flex items-center gap-4">
                              <Filter className="h-4 w-4 text-muted-foreground" />
                              <Slider
                                min={20}
                                max={20000}
                                step={10}
                                value={[track.highPass]}
                                onValueChange={(value) =>
                                  updateTrack(track.id, { highPass: value[0] })
                                }
                              />
                              <span className="text-sm w-16 text-right">
                                {track.highPass} Hz
                              </span>
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <Label className="mb-2 block">Gain</Label>
                            <div className="flex items-center gap-4">
                              <Volume2 className="h-4 w-4 text-muted-foreground" />
                              <Slider
                                min={0.1}
                                max={3}
                                step={0.1}
                                value={[track.gain]}
                                onValueChange={(value) =>
                                  updateTrack(track.id, { gain: value[0] })
                                }
                              />
                              <span className="text-sm w-12 text-right">
                                {track.gain.toFixed(1)}x
                              </span>
                            </div>
                          </div>

                          <div>
                            <Label className="mb-2 block">Start Time</Label>
                            <div className="flex items-center gap-4">
                              <MoveHorizontal className="h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                min={0}
                                step={0.1}
                                value={track.startTime}
                                onChange={(e) =>
                                  handleTrackPositionChange(
                                    track.id,
                                    Number.parseFloat(e.target.value) || 0,
                                  )
                                }
                              />
                              <span className="text-sm">seconds</span>
                            </div>
                          </div>

                          <div>
                            <Label className="mb-2 block">Repetitions</Label>
                            <div className="flex items-center gap-4">
                              <Repeat className="h-4 w-4 text-muted-foreground" />
                              <Select
                                value={track.repetitions.toString()}
                                onValueChange={(value) =>
                                  updateTrack(track.id, {
                                    repetitions: Number.parseInt(value),
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select repetitions" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                                    <SelectItem
                                      key={num}
                                      value={num.toString()}
                                    >
                                      {num}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Sample Name Dialog */}
      <Dialog
        open={!!editingSample}
        onOpenChange={(open) => !open && setEditingSample(null)}
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
              <Input
                id="sample-name"
                value={newSampleName}
                onChange={(e) => setNewSampleName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSample(null)}>
              Cancel
            </Button>
            <Button onClick={saveSampleName}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Track Dialog */}
      <Dialog
        open={!!editingTrack}
        onOpenChange={(open) => !open && setEditingTrack(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Track</DialogTitle>
            <DialogDescription>
              Adjust track settings and effects
            </DialogDescription>
          </DialogHeader>
          {editingTrack && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="track-start">Start Time (seconds)</Label>
                <Input
                  id="track-start"
                  type="number"
                  min={0}
                  step={0.1}
                  value={editingTrack.startTime}
                  onChange={(e) =>
                    setEditingTrack({
                      ...editingTrack,
                      startTime: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="track-repetitions">Repetitions</Label>
                <Select
                  value={editingTrack.repetitions.toString()}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      repetitions: Number.parseInt(value),
                    })
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
                  value={[editingTrack.volume]}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      volume: value[0],
                    })
                  }
                />
                <div className="text-right text-sm text-muted-foreground">
                  {Math.round(editingTrack.volume * 100)}%
                </div>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label htmlFor="track-lowpass">Low Pass Filter (Hz)</Label>
                <Slider
                  id="track-lowpass"
                  min={20}
                  max={20000}
                  step={10}
                  value={[editingTrack.lowPass]}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      lowPass: value[0],
                    })
                  }
                />
                <div className="text-right text-sm text-muted-foreground">
                  {editingTrack.lowPass} Hz
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="track-highpass">High Pass Filter (Hz)</Label>
                <Slider
                  id="track-highpass"
                  min={20}
                  max={20000}
                  step={10}
                  value={[editingTrack.highPass]}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      highPass: value[0],
                    })
                  }
                />
                <div className="text-right text-sm text-muted-foreground">
                  {editingTrack.highPass} Hz
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="track-gain">Gain</Label>
                <Slider
                  id="track-gain"
                  min={0.1}
                  max={3}
                  step={0.1}
                  value={[editingTrack.gain]}
                  onValueChange={(value) =>
                    setEditingTrack({
                      ...editingTrack,
                      gain: value[0],
                    })
                  }
                />
                <div className="text-right text-sm text-muted-foreground">
                  {editingTrack.gain.toFixed(1)}x
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTrack(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingTrack) {
                  updateTrack(editingTrack.id, editingTrack);
                  setEditingTrack(null);
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
