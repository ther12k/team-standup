"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type SpeechResult = { isFinal: boolean; [index: number]: { transcript: string } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: SpeechResult } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type BrowserWithSpeech = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const subscribe = () => () => undefined;
function supported() { const win = window as BrowserWithSpeech; return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition); }

export function useDictation(onFinal: (text: string) => void) {
  const available = useSyncExternalStore(subscribe, supported, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onFinal);
  useEffect(() => { callback.current = onFinal; }, [onFinal]);
  useEffect(() => () => {
    if (recognition.current) { recognition.current.onresult = null; recognition.current.onend = null; recognition.current.abort(); }
  }, []);
  const stop = useCallback(() => {
    recognition.current?.stop(); setListening(false); setInterim("");
  }, []);
  const start = useCallback(() => {
    const win = window as BrowserWithSpeech;
    const Speech = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Speech) { setError("Dikte belum didukung peramban ini. Gunakan Chrome/Safari yang mendukung, atau ketik pesan."); return; }
    recognition.current?.abort();
    const instance = new Speech();
    recognition.current = instance;
    instance.lang = "id-ID"; instance.continuous = true; instance.interimResults = true;
    instance.onresult = event => {
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) callback.current(result[0].transcript.trim());
        else partial += result[0].transcript;
      }
      setInterim(partial);
    };
    instance.onerror = event => {
      const messages: Record<string, string> = {
        "not-allowed": "Izin mikrofon ditolak. Izinkan mikrofon di pengaturan situs atau ketik pesan.",
        "service-not-allowed": "Layanan dikte tidak tersedia pada peramban ini. Gunakan input teks.",
        network: "Layanan pengenalan suara peramban tidak dapat dijangkau. Anda tetap bisa mengetik.",
        "audio-capture": "Mikrofon tidak ditemukan. Periksa perangkat atau gunakan input teks.",
        "no-speech": "Belum terdengar suara. Coba lagi atau ketik pesan.",
      };
      if (event.error !== "aborted") setError(messages[event.error] ?? "Dikte berhenti. Coba lagi atau gunakan input teks.");
      setListening(false); setInterim("");
    };
    instance.onend = () => { setListening(false); setInterim(""); };
    try { instance.start(); setListening(true); setError(""); }
    catch { setError("Mikrofon belum bisa dimulai. Silakan coba lagi."); }
  }, []);
  return { available, listening, interim, error, start, stop };
}
