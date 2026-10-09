import { describe, expect, it } from "vitest";
import {
  appendTranscript,
  getSpeechRecognitionConstructor,
  speechRecognitionErrorMessage,
} from "@/lib/speech-recognition";

describe("browser speech recognition helpers", () => {
  it("detects standard and prefixed browser APIs without assuming support", () => {
    class Recognition {}
    expect(getSpeechRecognitionConstructor({ SpeechRecognition: Recognition })).toBe(Recognition);
    expect(getSpeechRecognitionConstructor({ webkitSpeechRecognition: Recognition })).toBe(Recognition);
    expect(getSpeechRecognitionConstructor(undefined)).toBeNull();
    expect(getSpeechRecognitionConstructor({})).toBeNull();
    expect(getSpeechRecognitionConstructor(null)).toBeNull();
  });

  it("appends a transcript while preserving existing typed text and spacing", () => {
    expect(appendTranscript("Explain binary trees", "with an example")).toBe("Explain binary trees with an example");
    expect(appendTranscript("My draft: ", "hello there")).toBe("My draft: hello there");
    expect(appendTranscript("existing text", "  ")).toBe("existing text");
    expect(appendTranscript("", "  speak now  ")).toBe("speak now");
  });

  it("maps microphone, permission, service, and generic errors to actionable copy", () => {
    expect(speechRecognitionErrorMessage("not-allowed")).toContain("access was denied");
    expect(speechRecognitionErrorMessage("audio-capture")).toContain("No usable microphone");
    expect(speechRecognitionErrorMessage("no-speech")).toContain("No speech was recognized");
    expect(speechRecognitionErrorMessage("network")).toContain("speech service");
    expect(speechRecognitionErrorMessage("aborted")).toContain("stopped");
    expect(speechRecognitionErrorMessage("unknown")).toContain("still type");
  });
});
