import { useCallback, useEffect, useRef, useState } from 'react';

export interface TtsItem {
  text: string;
  label: string;
  chapterId?: string;
}

export interface TtsApi {
  active: boolean;
  playing: boolean;
  paused: boolean;
  rate: number;
  index: number;
  total: number;
  label: string;
  voiceHint: string;
  setRate: (value: number) => void;
  play: (items: TtsItem[], start?: number) => void;
  toggle: () => void;
  stop: () => void;
  skip: (dir: 1 | -1) => void;
  skipChapter: (dir: 1 | -1) => void;
}

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices();
  const rank = (voice: SpeechSynthesisVoice) => {
    const lang = voice.lang.toLowerCase();
    if (lang.startsWith('es-es')) return 0;
    if (lang.startsWith('es-mx') || lang.startsWith('es-ar') || lang.startsWith('es-co') || lang.startsWith('es-us')) return 1;
    if (lang.startsWith('es')) return 2;
    return 9;
  };
  return [...voices].filter((voice) => rank(voice) < 9).sort((a, b) => rank(a) - rank(b))[0] || null;
}

export function useTts(): TtsApi {
  const [rate, setRateState] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [label, setLabel] = useState('');
  const [voiceHint, setVoiceHint] = useState('');
  const itemsRef = useRef<TtsItem[]>([]);
  const indexRef = useRef(0);
  const offsetRef = useRef(0);
  const boundaryRef = useRef(0);
  const tokenRef = useRef(0);
  const pausedRef = useRef(false);
  const playingRef = useRef(false);
  const rateRef = useRef(1);
  const speakRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) {
      setVoiceHint('Este navegador no expone síntesis de voz.');
      return;
    }
    const update = () => {
      setVoiceHint(pickSpanishVoice() ? '' : 'No hay una voz en español instalada. Se usará la voz predeterminada.');
    };
    update();
    synth.addEventListener('voiceschanged', update);
    return () => synth.removeEventListener('voiceschanged', update);
  }, []);

  speakRef.current = () => {
    const synth = window.speechSynthesis;
    const item = itemsRef.current[indexRef.current];
    if (!synth || !item) {
      playingRef.current = false;
      pausedRef.current = false;
      setPlaying(false);
      setPaused(false);
      return;
    }
    const token = ++tokenRef.current;
    synth.cancel();
    const base = offsetRef.current;
    const text = item.text.slice(base).trim();
    if (!text) {
      indexRef.current += 1;
      offsetRef.current = 0;
      boundaryRef.current = 0;
      setIndex(indexRef.current);
      speakRef.current();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = rateRef.current;
    const voice = pickSpanishVoice();
    if (voice) utterance.voice = voice;
    utterance.onboundary = (event) => {
      if (typeof event.charIndex === 'number') boundaryRef.current = base + event.charIndex;
    };
    utterance.onend = () => {
      if (tokenRef.current !== token || pausedRef.current) return;
      indexRef.current += 1;
      offsetRef.current = 0;
      boundaryRef.current = 0;
      setIndex(indexRef.current);
      const next = itemsRef.current[indexRef.current];
      setLabel(next?.label || '');
      if (next) speakRef.current();
      else {
        playingRef.current = false;
        setPlaying(false);
      }
    };
    utterance.onerror = (event) => {
      if (tokenRef.current !== token || pausedRef.current) return;
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      playingRef.current = false;
      setPlaying(false);
    };
    setLabel(item.label);
    synth.speak(utterance);
  };

  const play = useCallback((items: TtsItem[], start = 0) => {
    const clean = items.filter((item) => item.text.trim());
    itemsRef.current = clean;
    indexRef.current = Math.max(0, Math.min(start, Math.max(clean.length - 1, 0)));
    offsetRef.current = 0;
    boundaryRef.current = 0;
    pausedRef.current = false;
    playingRef.current = clean.length > 0;
    setTotal(clean.length);
    setIndex(indexRef.current);
    setLabel(clean[indexRef.current]?.label || '');
    setActive(clean.length > 0);
    setPlaying(clean.length > 0);
    setPaused(false);
    if (clean.length) speakRef.current();
  }, []);

  const toggle = useCallback(() => {
    if (!itemsRef.current.length) return;
    if (!pausedRef.current && playingRef.current) {
      pausedRef.current = true;
      playingRef.current = false;
      offsetRef.current = boundaryRef.current;
      tokenRef.current += 1;
      window.speechSynthesis?.cancel();
      setPaused(true);
      setPlaying(false);
      return;
    }
    pausedRef.current = false;
    playingRef.current = true;
    setPaused(false);
    setPlaying(true);
    speakRef.current();
  }, []);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    pausedRef.current = false;
    playingRef.current = false;
    itemsRef.current = [];
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setPaused(false);
    setActive(false);
    setTotal(0);
    setIndex(0);
    setLabel('');
  }, []);

  const moveTo = useCallback((nextIndex: number) => {
    const items = itemsRef.current;
    if (!items.length) return;
    const next = Math.max(0, Math.min(items.length - 1, nextIndex));
    indexRef.current = next;
    offsetRef.current = 0;
    boundaryRef.current = 0;
    setIndex(next);
    setLabel(items[next]?.label || '');
    if (playingRef.current && !pausedRef.current) speakRef.current();
  }, []);

  const skip = useCallback((dir: 1 | -1) => moveTo(indexRef.current + dir), [moveTo]);

  const skipChapter = useCallback((dir: 1 | -1) => {
    const items = itemsRef.current;
    if (!items.length) return;
    const current = items[indexRef.current]?.chapterId;
    let cursor = indexRef.current;
    if (dir > 0) {
      cursor += 1;
      while (cursor < items.length && items[cursor].chapterId === current) cursor += 1;
      if (cursor >= items.length) cursor = items.length - 1;
    } else {
      while (cursor > 0 && items[cursor].chapterId === current) cursor -= 1;
      const chapterId = items[cursor]?.chapterId;
      while (cursor > 0 && items[cursor - 1].chapterId === chapterId) cursor -= 1;
    }
    moveTo(cursor);
  }, [moveTo]);

  const setRate = useCallback((value: number) => {
    const clamped = Math.min(2, Math.max(0.75, Math.round(value * 100) / 100));
    rateRef.current = clamped;
    setRateState(clamped);
    if (playingRef.current && !pausedRef.current) {
      offsetRef.current = boundaryRef.current;
      speakRef.current();
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const synth = window.speechSynthesis;
      if (synth && playingRef.current && !pausedRef.current && synth.speaking) {
        synth.pause();
        synth.resume();
      }
    }, 12000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  return { active, playing, paused, rate, index, total, label, voiceHint, setRate, play, toggle, stop, skip, skipChapter };
}
