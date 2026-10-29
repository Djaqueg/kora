import { buildEpub, parseEpub } from './lib/epub';
import { htmlToPlain } from './lib/html';
import { makeCover } from './lib/cover';
import { parseTextDocument } from './lib/text';
import { starterBooks, type SeedBook } from './seed-data';
import type { Book, Capsule, Chapter, Flashcard, Highlight, QuizQuestion } from './types';

export interface SeedPayload {
  books: Book[];
  chapters: Chapter[];
  highlights: Highlight[];
  capsules: Capsule[];
  flashcards: Flashcard[];
  quizzes: QuizQuestion[];
}

function toSource(book: SeedBook): string {
  if (book.format === 'MD') {
    return book.chapters.map((chapter) => `## ${chapter.title}\n\n${chapter.paragraphs.join('\n\n')}`).join('\n\n');
  }
  return book.chapters
    .map((chapter, index) => `Capítulo ${index + 1}: ${chapter.title}\n\n${chapter.paragraphs.join('\n\n')}`)
    .join('\n\n');
}

async function chaptersFor(book: SeedBook): Promise<Chapter[]> {
  if (book.format === 'EPUB') {
    const bytes = await buildEpub({ title: book.title, author: book.author, chapters: book.chapters });
    const parsed = await parseEpub(bytes, book.id);
    return parsed.chapters;
  }
  const parsed = parseTextDocument(toSource(book), book.id, book.format);
  return parsed.chapters;
}

function progressFor(book: SeedBook, count: number): number {
  if (!count) return 0;
  return Math.round(((book.chapterIndex + book.scrollRatio) / count) * 100);
}

export async function buildSeed(now = Date.now()): Promise<SeedPayload> {
  const books: Book[] = [];
  const chapters: Chapter[] = [];
  const highlights: Highlight[] = [];
  const capsules: Capsule[] = [];
  const flashcards: Flashcard[] = [];
  const quizzes: QuizQuestion[] = [];
  const day = 24 * 60 * 60 * 1000;

  for (const [order, seed] of starterBooks.entries()) {
    const parsed = await chaptersFor(seed);
    const stamp = now - order * 1000;
    const chapter = parsed[seed.chapterIndex] || parsed[0];
    books.push({
      id: seed.id,
      title: seed.title,
      author: seed.author,
      format: seed.format,
      cover: makeCover(seed.title, seed.author, seed.hue, seed.format),
      addedAt: stamp,
      updatedAt: stamp,
      progress: progressFor(seed, parsed.length),
      lastPosition: chapter ? { chapterId: chapter.id, scrollRatio: seed.scrollRatio } : undefined,
      source: 'builtin',
      fileName: `${seed.id}.${seed.format.toLowerCase()}`,
      summary: seed.summary,
    });
    chapters.push(...parsed);

    seed.highlights.forEach((highlight, index) => {
      const host = parsed[highlight.chapter];
      if (!host) return;
      const plain = htmlToPlain(host.html);
      const start = plain.indexOf(highlight.text);
      if (start < 0) {
        console.warn(`Kora: no se encontró el subrayado de ejemplo en «${seed.title}»: ${highlight.text}`);
        return;
      }
      highlights.push({
        id: `${seed.id}-h${index + 1}`,
        bookId: seed.id,
        chapterId: host.id,
        text: highlight.text,
        note: highlight.note,
        color: highlight.color,
        start,
        end: start + highlight.text.length,
        createdAt: stamp,
        updatedAt: stamp,
      });
    });

    seed.capsules.forEach((capsule, index) => {
      capsules.push({
        id: `${seed.id}-k${index + 1}`,
        bookId: seed.id,
        chapterId: parsed[capsule.chapter]?.id,
        title: capsule.title,
        idea: capsule.idea,
        practice: capsule.practice,
        quote: capsule.quote,
        order: index,
        source: 'seed',
        createdAt: stamp,
        updatedAt: stamp,
      });
    });

    seed.cards.forEach((card, index) => {
      const due = card.dueInDays <= 0 ? stamp - 60_000 : stamp + card.dueInDays * day;
      flashcards.push({
        id: `${seed.id}-f${index + 1}`,
        bookId: seed.id,
        chapterId: parsed[card.chapter]?.id,
        front: card.front,
        back: card.back,
        source: 'seed',
        ease: 2.5,
        interval: card.dueInDays > 0 ? card.dueInDays : 1,
        repetitions: card.dueInDays > 0 ? 3 : 2,
        due,
        lastReview: stamp - day,
        createdAt: stamp,
        updatedAt: stamp,
      });
    });

    seed.quiz.forEach((question, index) => {
      quizzes.push({
        id: `${seed.id}-q${index + 1}`,
        bookId: seed.id,
        question: question.question,
        options: question.options,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        source: 'seed',
        createdAt: stamp,
        updatedAt: stamp,
      });
    });
  }

  return { books, chapters, highlights, capsules, flashcards, quizzes };
}
