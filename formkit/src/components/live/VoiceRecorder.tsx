"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Square, Upload } from "lucide-react";
import { clock, voiceLabel } from "../../../convex/model/voice";
import { buttonInk } from "@/components/app/editor/themes";

/**
 * A voice answer: press to record, see it listening, stop (or let it stop at
 * the form's limit), play it back, and record again if it was not right.
 * The recording is handed up as a file and uploaded like any other.
 *
 * Where a browser cannot record (no microphone, or no permission), an audio
 * file can be chosen instead, so the question can always be answered.
 */

type Status = "idle" | "asking" | "recording" | "saving" | "error";

/** What each browser records into, best first. */
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const BARS = 32;

function pickType() {
  if (typeof MediaRecorder === "undefined") return null;
  return TYPES.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
}

function extension(type: string) {
  if (type.includes("mp4")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  return "webm";
}

export function VoiceRecorder({
  maxSeconds,
  accent,
  radius,
  saved,
  failed,
  onFile,
  onClear,
  label,
}: {
  maxSeconds: number;
  accent: string;
  radius: number;
  /** A recording is already uploaded for this question. */
  saved: boolean;
  /** The upload was refused or did not finish; the reason shows under the question. */
  failed?: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
  label: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [preview, setPreview] = useState<{ url: string; seconds: number } | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  /** Held so the browser does not collect the meter's input mid-recording. */
  const source = useRef<MediaStreamAudioSourceNode | null>(null);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const chunks = useRef<Blob[]>([]);
  const fallback = useRef<HTMLInputElement | null>(null);

  function release() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    source.current?.disconnect();
    source.current = null;
    void audio.current?.close().catch(() => undefined);
    audio.current = null;
  }

  // Let go of the microphone and the preview if the question goes away mid-recording.
  useEffect(
    () => () => {
      release();
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
    [],
  );
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview.url) : undefined), [preview]);

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function start() {
    setProblem(null);
    const type = pickType();
    if (type === null || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setProblem("This browser cannot record here. You can upload a recording instead.");
      return;
    }
    setStatus("asking");
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      setStatus("error");
      setProblem(
        (e as DOMException)?.name === "NotAllowedError"
          ? "The microphone is blocked. Allow it for this page in your browser, then try again."
          : "No microphone was found. Plug one in and try again, or upload a recording instead.",
      );
      return;
    }
    stream.current = media;

    // A live level meter, so it is obvious the microphone is hearing you.
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    let analyser: AnalyserNode | null = null;
    if (Ctx) {
      audio.current = new Ctx();
      // Created after the permission prompt, so it can start suspended.
      void audio.current.resume().catch(() => undefined);
      analyser = audio.current.createAnalyser();
      analyser.fftSize = 512;
      source.current = audio.current.createMediaStreamSource(media);
      source.current.connect(analyser);
    }
    const samples = new Uint8Array(analyser?.fftSize ?? 0);

    const rec = new MediaRecorder(media, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 64_000 });
    recorder.current = rec;
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      const seconds = Math.min(maxSeconds, Math.round((performance.now() - startedAt.current) / 1000));
      release();
      const mime = rec.mimeType || type || "audio/webm";
      const blob = new Blob(chunks.current, { type: mime });
      if (!blob.size || seconds < 1) {
        setStatus("idle");
        setProblem("That was too short to keep. Try again.");
        return;
      }
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      const file = new File([blob], `voice-recording-${m}m${String(s).padStart(2, "0")}s.${extension(mime)}`, { type: mime });
      setPreview({ url: URL.createObjectURL(blob), seconds });
      setStatus("saving");
      onFile(file);
    };

    startedAt.current = performance.now();
    setElapsed(0);
    setLevels(Array(BARS).fill(0));
    rec.start(1000);
    setStatus("recording");
    timer.current = window.setInterval(() => {
      const secs = (performance.now() - startedAt.current) / 1000;
      setElapsed(secs);
      if (analyser) {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += ((v - 128) / 128) ** 2;
        const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
        setLevels((l) => [...l.slice(1), level]);
      }
      if (secs >= maxSeconds) stop();
    }, 100);
  }

  function again() {
    setPreview(null);
    setStatus("idle");
    setElapsed(0);
    onClear();
  }

  const done = saved && status !== "recording" && status !== "asking";
  const left = Math.max(0, maxSeconds - elapsed);
  const style = {
    ["--fk-voice" as string]: accent,
    ["--fk-voice-ink" as string]: buttonInk(accent),
    borderRadius: radius,
  } as React.CSSProperties;

  return (
    <div className="fk-voice" style={style} data-state={done ? "done" : status}>
      {status === "recording" ? (
        <>
          <button type="button" className="fk-voice-btn" data-stop onClick={stop} aria-label="Stop recording">
            <Square size={16} strokeWidth={0} fill="currentColor" aria-hidden />
          </button>
          <span className="fk-voice-wave" aria-hidden>
            {levels.map((l, i) => (
              <i key={i} style={{ transform: `scaleY(${0.12 + l * 0.88})` }} />
            ))}
          </span>
          <span className="fk-voice-time" aria-live="off">
            <b>{clock(elapsed)}</b> / {clock(maxSeconds)}
            {left <= 10 && <small>{Math.ceil(left)}s left</small>}
          </span>
          <span className="fk-voice-bar" aria-hidden>
            <i style={{ width: `${Math.min(100, (elapsed / maxSeconds) * 100)}%` }} />
          </span>
        </>
      ) : done || status === "saving" ? (
        <>
          {preview ? (
            <audio className="fk-voice-play" controls src={preview.url} aria-label={`Your recording for ${label}`} />
          ) : (
            <span className="fk-voice-note">Your recording is saved.</span>
          )}
          <span className="fk-voice-status" data-failed={failed || undefined}>
            {done ? "Saved" : failed ? "Not saved" : "Saving…"}
            {preview && <small>{clock(preview.seconds)} recorded</small>}
          </span>
          <button type="button" className="fk-voice-again" onClick={again} disabled={!done && !failed}>
            <RotateCcw size={14} strokeWidth={2} aria-hidden /> Record again
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="fk-voice-btn"
            onClick={() => void start()}
            disabled={status === "asking"}
            aria-label={`Record your answer to ${label}`}
          >
            <Mic size={20} strokeWidth={2} aria-hidden />
          </button>
          <span className="fk-voice-copy">
            <b>{status === "asking" ? "Allow the microphone to start…" : "Press to record"}</b>
            <small>Up to {voiceLabel(maxSeconds)}. You can listen back before you send it.</small>
          </span>
        </>
      )}

      {problem && (
        <span className="fk-voice-problem" role="alert">
          {problem}
          {status === "error" && (
            <button type="button" onClick={() => fallback.current?.click()}>
              <Upload size={13} strokeWidth={2} aria-hidden /> Upload a recording
            </button>
          )}
        </span>
      )}
      <input
        ref={fallback}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setProblem(null);
          setStatus("saving");
          onFile(file);
        }}
      />
    </div>
  );
}
