import type { Flashcard } from '../types';

export type Grade = 'again' | 'hard' | 'good' | 'easy';

const DAY = 24 * 60 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

export function applySm2(card: Flashcard, grade: Grade, now = Date.now()): Flashcard {
  let ease = card.ease || 2.5;
  let interval = card.interval || 0;
  let repetitions = card.repetitions || 0;

  if (grade === 'again') {
    ease = Math.max(1.3, ease - 0.2);
    return {
      ...card,
      ease,
      interval: 0,
      repetitions: 0,
      due: now + TEN_MIN,
      lastReview: now,
      updatedAt: now,
    };
  }

  const quality = grade === 'hard' ? 3 : grade === 'good' ? 4 : 5;
  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < 1.3) ease = 1.3;

  if (repetitions <= 0) interval = grade === 'easy' ? 3 : 1;
  else if (repetitions === 1) interval = grade === 'easy' ? 8 : grade === 'hard' ? 3 : 6;
  else {
    const goodInterval = Math.max(1, Math.round((interval || 1) * ease));
    if (grade === 'hard') interval = Math.max(1, Math.round(goodInterval * 0.7));
    else if (grade === 'easy') interval = Math.max(goodInterval + 1, Math.round(goodInterval * 1.3));
    else interval = goodInterval;
  }
  repetitions += 1;

  return {
    ...card,
    ease,
    interval,
    repetitions,
    due: now + interval * DAY,
    lastReview: now,
    updatedAt: now,
  };
}

export function gradeLabel(card: Flashcard, grade: Grade): string {
  if (grade === 'again') return '10 min';
  const next = applySm2(card, grade, 0);
  if (next.interval <= 1) return '1 día';
  return `${next.interval} días`;
}

export function leitnerBox(interval: number): number {
  if (interval < 2) return 1;
  if (interval < 7) return 2;
  if (interval < 21) return 3;
  return 4;
}

export function endOfToday(now = new Date()): number {
  const date = new Date(now);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function isDue(card: Flashcard, now = Date.now()): boolean {
  return card.due <= endOfToday(new Date(now));
}

export function freshCard(partial: Pick<Flashcard, 'front' | 'back' | 'bookId'> & Partial<Flashcard>, now = Date.now()): Flashcard {
  return {
    id: partial.id || crypto.randomUUID(),
    bookId: partial.bookId,
    chapterId: partial.chapterId,
    front: partial.front,
    back: partial.back,
    highlightId: partial.highlightId,
    source: partial.source || 'manual',
    ease: partial.ease ?? 2.5,
    interval: partial.interval ?? 0,
    repetitions: partial.repetitions ?? 0,
    due: partial.due ?? now,
    lastReview: partial.lastReview,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}
