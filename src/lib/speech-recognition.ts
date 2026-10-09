export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export type SpeechRecognitionResultEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

export type SpeechRecognitionErrorEventLike = { error: string };
export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function getSpeechRecognitionConstructor(scope: unknown): SpeechRecognitionConstructor | null {
  if (!scope || typeof scope !== "object") return null;
  const browserWindow = scope as SpeechWindow;
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

export function appendTranscript(existing: string, transcript: string): string {
  const spoken = transcript.trim();
  if (!spoken) return existing;
  if (!existing.trim()) return spoken;
  return `${existing}${/\s$/.test(existing) ? "" : " "}${spoken}`;
}

export function speechRecognitionErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied. Allow microphone access in your browser, or keep typing.";
    case "audio-capture":
      return "No usable microphone was found. Check your microphone, or keep typing.";
    case "no-speech":
      return "No speech was recognized. Try again or type your question.";
    case "network":
      return "The browser speech service could not be reached. Try again or type your question.";
    case "aborted":
      return "Voice input was stopped.";
    default:
      return "Voice input is unavailable right now. You can still type your question.";
  }
}
