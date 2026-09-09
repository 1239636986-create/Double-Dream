import { useCallback, useEffect, useRef, useState } from "react";

type SpeakOptions = {
  onEnd?: () => void;
  onLine?: (index: number, total: number) => void;
};

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [lineTotal, setLineTotal] = useState(0);
  const queueRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const onEndRef = useRef<(() => void) | undefined>(undefined);
  const onLineRef = useRef<SpeakOptions["onLine"]>(undefined);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    queueRef.current = [];
    onEndRef.current = undefined;
    onLineRef.current = undefined;
    indexRef.current = 0;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setLineIndex(0);
    setLineTotal(0);
  }, []);

  const speakNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      setSpeaking(false);
      onEndRef.current?.();
      onEndRef.current = undefined;
      return;
    }
    const current = indexRef.current;
    setLineIndex(current);
    onLineRef.current?.(current, indexRef.current + queueRef.current.length + 1);
    const utter = new SpeechSynthesisUtterance(next);
    utter.lang = "zh-CN";
    utter.rate = 1.02;
    utter.onend = () => {
      indexRef.current += 1;
      speakNext();
    };
    utter.onerror = () => {
      indexRef.current += 1;
      speakNext();
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  }, []);

  const speak = useCallback(
    (lines: string | string[], options?: SpeakOptions) => {
      if (!supported) {
        options?.onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const list = Array.isArray(lines) ? lines.filter(Boolean) : [lines];
      queueRef.current = [...list];
      indexRef.current = 0;
      setLineTotal(list.length);
      setLineIndex(0);
      onEndRef.current = options?.onEnd;
      onLineRef.current = options?.onLine;
      speakNext();
    },
    [speakNext, supported],
  );

  return { speaking, supported, speak, stop, lineIndex, lineTotal };
}
