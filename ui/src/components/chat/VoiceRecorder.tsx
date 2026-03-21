import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "../../lib/utils";

type VoiceRecorderProps = {
  onTranscript: (text: string) => void;
  className?: string;
};

const LANG_KEY = "chat-voice-lang";

export function VoiceRecorder({ onTranscript, className }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) ?? "en-US");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const toggleLang = useCallback(() => {
    const next = lang === "en-US" ? "ar-SA" : "en-US";
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  }, [lang]);

  const toggleRecording = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const SR = window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onTranscript(transcript);
      setRecording(false);
    };

    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [recording, lang, onTranscript]);

  if (!supported) return null;

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <button
        onClick={toggleLang}
        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground text-[9px] font-bold"
        title={`Language: ${lang === "en-US" ? "English" : "Arabic"}`}
      >
        {lang === "en-US" ? "EN" : "AR"}
      </button>
      <button
        onClick={toggleRecording}
        className={cn(
          "p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground",
          recording && "text-red-500 animate-pulse",
        )}
        title={recording ? "Stop recording" : "Voice input"}
      >
        {recording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
