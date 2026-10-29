import type { Chapter, DraftCapsule, DraftQuiz, GeneratedPack, Highlight } from '../types';
import { htmlToPlain } from './html';

const STOP = new Set(
  'para como esta este esto porque cuando donde tambien siempre desde entre sobre hacia hasta puede pueden hacer tiene tienen cada solo más menos muy una uno unas unos con por que las los del sus ese esa eso pero sino aunque donde'.split(' '),
);

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿«"“])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40);
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function tokens(value: string): Set<string> {
  return new Set(fold(value).split(/[^a-z0-9áéíóúñü]+/i).filter((word) => word.length > 3));
}

function jaccard(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function titleFrom(sentence: string): string {
  const words = sentence.replace(/[«»"“”]/g, '').split(/\s+/).slice(0, 7);
  let title = words.join(' ').replace(/[,:;.\-—]+$/g, '');
  if (title.length > 62) title = `${title.slice(0, 59).trim()}…`;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function practiceFrom(sentence: string): string {
  const short = sentence.length > 110 ? `${sentence.slice(0, 107).trim()}…` : sentence;
  return `Hoy, en una sola acción de quince minutos: pon a prueba «${short}» y anota qué cambió.`;
}

function cloze(sentence: string): { front: string; back: string } | null {
  const words = sentence.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{7,}/g) || [];
  const candidate = words
    .map((word) => word.toLowerCase())
    .filter((word) => !STOP.has(fold(word)))
    .sort((a, b) => b.length - a.length)[0];
  if (!candidate) return null;
  const match = sentence.match(new RegExp(candidate, 'i'));
  if (!match) return null;
  return {
    front: `Completa el hueco: ${sentence.replace(match[0], '______')}`,
    back: match[0],
  };
}

function seededOrder(length: number, seed: number): number[] {
  const items = Array.from({ length }, (_, index) => index);
  let state = seed * 997;
  for (let i = items.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) % 2147483647;
    const j = state % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function trimText(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

export function quizFromCapsules(capsules: DraftCapsule[]): DraftQuiz[] {
  return capsules.slice(0, 6).map((capsule, index) => {
    const correct = trimText(capsule.idea, 140);
    const distractors = capsules
      .filter((_, other) => other !== index)
      .slice(0, 3)
      .map((item) => trimText(item.idea, 140));
    while (distractors.length < 3) distractors.push('Esta afirmación no se sostiene en el texto.');
    const options = [correct, ...distractors.slice(0, 3)];
    const order = seededOrder(options.length, index + 3);
    return {
      question: `¿Qué sostiene la idea «${capsule.title}»?`,
      options: order.map((item) => options[item]),
      correctIndex: order.indexOf(0),
      explanation: capsule.idea,
    };
  });
}

export function summarizeChapters(chapters: Chapter[]): string {
  const bits = chapters
    .map((chapter) => splitSentences(htmlToPlain(chapter.html))[0] || trimText(htmlToPlain(chapter.html), 180))
    .filter(Boolean);
  return trimText(bits.join(' '), 720);
}

interface ScoredSentence {
  text: string;
  chapterId: string;
  score: number;
}

export function generateLocal(chapters: Chapter[], highlights: Highlight[]): GeneratedPack {
  const scored: ScoredSentence[] = [];
  chapters.forEach((chapter, chapterIndex) => {
    const sentences = splitSentences(htmlToPlain(chapter.html));
    const own = highlights.filter((highlight) => highlight.chapterId === chapter.id);
    sentences.forEach((sentence, sentenceIndex) => {
      let score = 0;
      if (sentence.length >= 70 && sentence.length <= 260) score += 3;
      else if (sentence.length >= 45) score += 1;
      if (sentenceIndex < 2) score += 2;
      if (chapterIndex === 0 && sentenceIndex === 0) score += 1;
      if (/importante|clave|porque|recuerda|decidir|atención|memoria|criterio|recuper/i.test(sentence)) score += 1;
      if (own.some((highlight) => sentence.includes(highlight.text.slice(0, 36)) || highlight.text.includes(sentence.slice(0, 36)))) {
        score += 6;
      }
      scored.push({ text: sentence, chapterId: chapter.id, score });
    });
  });
  if (!scored.length) throw new Error('No hay suficiente texto para generar una síntesis local.');
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const picked: ScoredSentence[] = [];
  for (const sentence of sorted) {
    if (picked.length >= 10) break;
    if (picked.some((item) => jaccard(item.text, sentence.text) > 0.55)) continue;
    picked.push(sentence);
  }
  for (const sentence of sorted) {
    if (picked.length >= 8) break;
    if (!picked.includes(sentence)) picked.push(sentence);
  }
  const capsules: DraftCapsule[] = picked.slice(0, 12).map((sentence) => {
    const quote = highlights.find((highlight) => highlight.chapterId === sentence.chapterId)?.text;
    return {
      title: titleFrom(sentence.text),
      idea: sentence.text,
      practice: practiceFrom(sentence.text),
      quote,
      chapterId: sentence.chapterId,
    };
  });
  const flashcards = capsules.slice(0, 8).flatMap((capsule) => {
    const cards = [
      {
        front: `¿Cómo explicarías con tus palabras la idea «${capsule.title}»?`,
        back: capsule.idea,
        chapterId: capsule.chapterId,
      },
    ];
    const gap = cloze(capsule.idea);
    if (gap) cards.push({ ...gap, chapterId: capsule.chapterId });
    return cards;
  }).slice(0, 12);
  return {
    summary: summarizeChapters(chapters),
    capsules,
    flashcards,
    quizzes: quizFromCapsules(capsules),
  };
}
