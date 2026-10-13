"use client";

import { useEffect, useRef, useState } from "react";
import {
  appendTranscript,
  getSpeechRecognitionConstructor,
  speechRecognitionErrorMessage,
  type SpeechRecognitionLike,
} from "@/lib/speech-recognition";

type VoiceState = "ready" | "starting" | "listening" | "processing" | "stopped" | "unsupported" | "error";

type LearnVoiceInputProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function LearnVoiceInput({ value, disabled = false, onChange }: LearnVoiceInputProps) {
  const [state, setState] = useState<VoiceState>("ready");
  const [statusMessage, setStatusMessage] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const latestValue = useRef(value);
  const finalTranscript = useRef("");
  const errorOccurred = useRef(false);

  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      const active = recognition.current;
      recognition.current = null;
      if (active) {
        active.onstart = null;
        active.onresult = null;
        active.onerror = null;
        active.onend = null;
        try {
          active.abort();
        } catch {
          // Some browser implementations throw when aborting an already-ended session.
        }
      }
    };
  }, []);

  function startListening() {
    const Recognition = getSpeechRecognitionConstructor(window);
    if (!Recognition) {
      setState("unsupported");
      setStatusMessage("Voice input is not supported by this browser. You can still type your question.");
      return;
    }

    finalTranscript.current = "";
    errorOccurred.current = false;
    setStatusMessage("Requesting microphone access…");
    setState("starting");

    try {
      const active = new Recognition();
      recognition.current = active;
      active.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
      active.continuous = false;
      active.interimResults = false;
      active.onstart = () => {
        setState("listening");
        setStatusMessage("Listening. Speak your question, then stop voice input when you’re done.");
      };
      active.onresult = (event) => {
        const transcriptParts: string[] = [];
        for (let index = 0; index < event.results.length; index += 1) {
          transcriptParts.push(event.results[index]?.[0]?.transcript ?? "");
        }
        finalTranscript.current = transcriptParts.join(" ").trim();
      };
      active.onerror = (event) => {
        errorOccurred.current = true;
        setState("error");
        setStatusMessage(speechRecognitionErrorMessage(event.error));
      };
      active.onend = () => {
        if (recognition.current !== active) return;
        recognition.current = null;
        if (errorOccurred.current) return;
        if (finalTranscript.current) {
          onChange(appendTranscript(latestValue.current, finalTranscript.current));
          setState("stopped");
          setStatusMessage("Transcription added. Review or edit it before sending.");
        } else {
          setState("stopped");
          setStatusMessage("Listening stopped without a transcript. You can try again or type your question.");
        }
      };
      active.start();
    } catch {
      recognition.current = null;
      errorOccurred.current = true;
      setState("error");
      setStatusMessage("Voice input could not start. Check microphone permission, or type your question.");
    }
  }

  function stopListening() {
    const active = recognition.current;
    if (!active) return;
    setState("processing");
    setStatusMessage("Finishing transcription…");
    try {
      active.stop();
    } catch {
      setState("error");
      setStatusMessage("Voice input could not stop cleanly. Your typed text is still available.");
    }
  }

  const listening = state === "starting" || state === "listening";
  const unsupported = state === "unsupported";

  return (
    <div className="learn-voice-input">
      <button
        className="learn-voice-button"
        type="button"
        disabled={disabled || state === "processing" || unsupported}
        aria-pressed={listening}
        aria-label={listening ? "Stop voice input" : unsupported ? "Voice input unavailable" : "Start voice input"}
        onClick={listening ? stopListening : startListening}
      >
        {listening ? "Stop voice input" : unsupported ? "Voice input unavailable" : state === "processing" ? "Processing voice input…" : "Start voice input"}
      </button>
      {(statusMessage || unsupported) && (
        <p className="learn-voice-status" role="status" aria-live="polite">
          {statusMessage || "Voice input is not supported by this browser. You can still type your question."}
        </p>
      )}
    </div>
  );
}
