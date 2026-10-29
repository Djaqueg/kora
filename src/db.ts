import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { isBackup } from './lib/backup';
import { adoptLegacyDriveToken } from './lib/drive-session';
import { cleanSettings, settingsNeedRewrite } from './lib/settings';
import { makeCover, hueFromString } from './lib/cover';
import { defaultStreak, nextStreak } from './lib/dates';
import { parseEpub } from './lib/epub';
import { forgetPdf, parsePdf } from './lib/pdf';
import { freshCard } from './lib/sm2';
import { detectFormat, parseTextDocument, titleFromFileName } from './lib/text';
import { buildSeed } from './seed';
import {
  defaultSettings,
  type BackupFile,
  type Book,
  type Capsule,
  type Chapter,
  type ContentSource,
  type Flashcard,
  type GeneratedPack,
  type Highlight,
  type QuizQuestion,
  type Settings,
  type Streak,
  type Tombstone,
  type TombstoneKind,
} from './types';

interface StoredFile {
  bookId: string;
  blob: Blob;
  name: string;
}

interface KoraSchema extends DBSchema {
  books: { key: string; value: Book };
  chapters: { key: string; value: Chapter; indexes: { byBook: string } };
  highlights: { key: string; value: Highlight; indexes: { byBook: string } };
  capsules: { key: string; value: Capsule; indexes: { byBook: string } };
  flashcards: { key: string; value: Flashcard; indexes: { byBook: string } };
  quizzes: { key: string; value: QuizQuestion; indexes: { byBook: string } };
  files: { key: string; value: StoredFile };
  kv: { key: string; value: Settings | Streak | Tombstone[] | boolean | string };
}

export interface LibraryData {
  books: Book[];
  highlights: Highlight[];
  capsules: Capsule[];
  flashcards: Flashcard[];
  quizzes: QuizQuestion[];
  settings: Settings;
  streak: Streak;
  tombstones: Tombstone[];
}

type StoreName = 'books' | 'chapters' | 'highlights' | 'capsules' | 'flashcards' | 'quizzes' | 'files' | 'kv';

let databasePromise: Promise<IDBPDatabase<KoraSchema>> | null = null;
let readyPromise: Promise<void> | null = null;

function open(): Promise<IDBPDatabase<KoraSchema>> {
  if (!databasePromise) {
    databasePromise = openDB<KoraSchema>('kora', 1, {
      upgrade(db) {
        db.createObjectStore('books', { keyPath: 'id' });
        db.createObjectStore('chapters', { keyPath: 'id' }).createIndex('byBook', 'bookId');
        db.createObjectStore('highlights', { keyPath: 'id' }).createIndex('byBook', 'bookId');
        db.createObjectStore('capsules', { keyPath: 'id' }).createIndex('byBook', 'bookId');
        db.createObjectStore('flashcards', { keyPath: 'id' }).createIndex('byBook', 'bookId');
        db.createObjectStore('quizzes', { keyPath: 'id' }).createIndex('byBook', 'bookId');
        db.createObjectStore('files', { keyPath: 'bookId' });
        db.createObjectStore('kv');
      },
    });
  }
  return databasePromise;
}

async function putMany(db: IDBPDatabase<KoraSchema>, store: Exclude<StoreName, 'kv' | 'files'>, items: { id: string }[]) {
  if (!items.length) return;
  const tx = db.transaction(store, 'readwrite');
  for (const item of items) tx.store.put(item as never);
  await tx.done;
}

export function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const db = await open();
        const seeded = await db.get('kv', 'seeded');
        if (!seeded) {
          const payload = await buildSeed();
          await putMany(db, 'books', payload.books);
          await putMany(db, 'chapters', payload.chapters);
          await putMany(db, 'highlights', payload.highlights);
          await putMany(db, 'capsules', payload.capsules);
          await putMany(db, 'flashcards', payload.flashcards);
          await putMany(db, 'quizzes', payload.quizzes);
          await db.put('kv', true, 'seeded');
        }
        if (!(await db.get('kv', 'settings'))) await db.put('kv', defaultSettings, 'settings');
        if (!(await db.get('kv', 'streak'))) await db.put('kv', defaultStreak(), 'streak');
        if (!(await db.get('kv', 'tombstones'))) await db.put('kv', [], 'tombstones');
      } catch (error) {
        readyPromise = null;
        throw error;
      }
    })();
  }
  return readyPromise;
}

function asSettings(value: unknown): Settings {
  return cleanSettings(value);
}

function asStreak(value: unknown): Streak {
  return { ...defaultStreak(), ...(value && typeof value === 'object' ? (value as Streak) : {}) };
}

export async function loadLibrary(): Promise<LibraryData> {
  await ensureReady();
  const db = await open();
  const [books, highlights, capsules, flashcards, quizzes, settings, streak, tombstones] = await Promise.all([
    db.getAll('books'),
    db.getAll('highlights'),
    db.getAll('capsules'),
    db.getAll('flashcards'),
    db.getAll('quizzes'),
    db.get('kv', 'settings'),
    db.get('kv', 'streak'),
    db.get('kv', 'tombstones'),
  ]);
  adoptLegacyDriveToken(settings);
  const cleaned = asSettings(settings);
  if (settingsNeedRewrite(settings)) await saveSettings(cleaned);
  return {
    books: books.sort((a, b) => b.updatedAt - a.updatedAt),
    highlights,
    capsules: capsules.sort((a, b) => a.order - b.order),
    flashcards,
    quizzes,
    settings: cleaned,
    streak: asStreak(streak),
    tombstones: Array.isArray(tombstones) ? (tombstones as Tombstone[]) : [],
  };
}

export async function chaptersOf(bookId: string): Promise<Chapter[]> {
  const db = await open();
  const chapters = await db.getAllFromIndex('chapters', 'byBook', bookId);
  return chapters.sort((a, b) => a.index - b.index);
}

export async function getFile(bookId: string): Promise<StoredFile | undefined> {
  const db = await open();
  return db.get('files', bookId);
}

async function rememberTombs(items: { id: string; kind: TombstoneKind }[]): Promise<Tombstone[]> {
  const db = await open();
  const prev = ((await db.get('kv', 'tombstones')) as Tombstone[] | undefined) || [];
  const now = Date.now();
  const next = [...prev];
  for (const item of items) {
    const index = next.findIndex((tomb) => tomb.id === item.id && tomb.kind === item.kind);
    const tomb = { id: item.id, kind: item.kind, deletedAt: now };
    if (index >= 0) next[index] = tomb;
    else next.push(tomb);
  }
  await db.put('kv', next, 'tombstones');
  return next;
}

export async function saveBook(book: Book): Promise<void> {
  const db = await open();
  await db.put('books', book);
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await open();
  await db.put('kv', cleanSettings(settings), 'settings');
}

const AI_SYNC_PASSWORD_KEY = 'aiSyncPassword';

export async function loadAiSyncPassword(): Promise<string> {
  await ensureReady();
  const db = await open();
  const value = await db.get('kv', AI_SYNC_PASSWORD_KEY);
  return typeof value === 'string' ? value : '';
}

export async function saveAiSyncPassword(password: string): Promise<void> {
  await ensureReady();
  const db = await open();
  await db.put('kv', password, AI_SYNC_PASSWORD_KEY);
}

export async function saveStreak(streak: Streak): Promise<void> {
  const db = await open();
  await db.put('kv', streak, 'streak');
}

export async function recordActivity(streak: Streak, minutesDelta: number, capsuleDelta: number): Promise<Streak> {
  const next = nextStreak(streak, minutesDelta, capsuleDelta);
  await saveStreak(next);
  return next;
}

export async function saveHighlight(highlight: Highlight): Promise<void> {
  const db = await open();
  await db.put('highlights', highlight);
}

export async function removeHighlight(highlight: Highlight): Promise<Tombstone[]> {
  const db = await open();
  await db.delete('highlights', highlight.id);
  return rememberTombs([{ id: highlight.id, kind: 'highlight' }]);
}

export async function saveCapsule(capsule: Capsule): Promise<void> {
  const db = await open();
  await db.put('capsules', capsule);
}

export async function removeCapsule(capsule: Capsule): Promise<Tombstone[]> {
  const db = await open();
  await db.delete('capsules', capsule.id);
  return rememberTombs([{ id: capsule.id, kind: 'capsule' }]);
}

export async function saveCard(card: Flashcard): Promise<void> {
  const db = await open();
  await db.put('flashcards', card);
}

export async function removeCard(card: Flashcard): Promise<Tombstone[]> {
  const db = await open();
  await db.delete('flashcards', card.id);
  return rememberTombs([{ id: card.id, kind: 'flashcard' }]);
}

export async function deleteBook(bookId: string): Promise<Tombstone[]> {
  const db = await open();
  const [chapters, highlights, capsules, cards, quizzes] = await Promise.all([
    db.getAllFromIndex('chapters', 'byBook', bookId),
    db.getAllFromIndex('highlights', 'byBook', bookId),
    db.getAllFromIndex('capsules', 'byBook', bookId),
    db.getAllFromIndex('flashcards', 'byBook', bookId),
    db.getAllFromIndex('quizzes', 'byBook', bookId),
  ]);
  const tx = db.transaction(['books', 'chapters', 'highlights', 'capsules', 'flashcards', 'quizzes', 'files'], 'readwrite');
  await tx.objectStore('books').delete(bookId);
  await tx.objectStore('files').delete(bookId);
  for (const chapter of chapters) await tx.objectStore('chapters').delete(chapter.id);
  for (const highlight of highlights) await tx.objectStore('highlights').delete(highlight.id);
  for (const capsule of capsules) await tx.objectStore('capsules').delete(capsule.id);
  for (const card of cards) await tx.objectStore('flashcards').delete(card.id);
  for (const quiz of quizzes) await tx.objectStore('quizzes').delete(quiz.id);
  await tx.done;
  forgetPdf(bookId);
  return rememberTombs([
    { id: bookId, kind: 'book' },
    ...chapters.map((chapter) => ({ id: chapter.id, kind: 'chapter' as const })),
    ...highlights.map((highlight) => ({ id: highlight.id, kind: 'highlight' as const })),
    ...capsules.map((capsule) => ({ id: capsule.id, kind: 'capsule' as const })),
    ...cards.map((card) => ({ id: card.id, kind: 'flashcard' as const })),
    ...quizzes.map((quiz) => ({ id: quiz.id, kind: 'quiz' as const })),
  ]);
}

export async function importBuffer(options: {
  data: ArrayBuffer;
  fileName: string;
  source: 'local' | 'drive';
  driveFileId?: string;
}): Promise<Book> {
  const format = detectFormat(options.fileName);
  const bookId = crypto.randomUUID();
  const now = Date.now();
  let title = titleFromFileName(options.fileName);
  let author = 'Autor desconocido';
  let chapters: Chapter[] = [];
  if (format === 'EPUB') {
    const parsed = await parseEpub(options.data, bookId);
    title = parsed.title || title;
    author = parsed.author || author;
    chapters = parsed.chapters;
  } else if (format === 'PDF') {
    const parsed = await parsePdf(options.data, bookId);
    title = parsed.title || title;
    author = parsed.author || author;
    chapters = parsed.chapters;
  } else {
    const text = new TextDecoder('utf-8').decode(options.data);
    const parsed = parseTextDocument(text, bookId, format);
    title = parsed.title || title;
    chapters = parsed.chapters;
  }
  if (!chapters.length) throw new Error(`«${options.fileName}» no tiene texto legible.`);
  const book: Book = {
    id: bookId,
    title,
    author,
    format,
    cover: makeCover(title, author, hueFromString(title), format),
    addedAt: now,
    updatedAt: now,
    progress: 0,
    source: options.source,
    driveFileId: options.driveFileId,
    fileName: options.fileName,
  };
  const db = await open();
  await putMany(db, 'chapters', chapters);
  await db.put('books', book);
  await db.put('files', { bookId, blob: new Blob([options.data]), name: options.fileName });
  return book;
}

export async function saveGenerated(book: Book, pack: GeneratedPack, source: ContentSource): Promise<void> {
  const db = await open();
  const [capsules, cards, quizzes] = await Promise.all([
    db.getAllFromIndex('capsules', 'byBook', book.id),
    db.getAllFromIndex('flashcards', 'byBook', book.id),
    db.getAllFromIndex('quizzes', 'byBook', book.id),
  ]);
  const dropCapsules = capsules.filter((item) => item.source !== 'manual');
  const dropCards = cards.filter((item) => item.source !== 'manual');
  const dropQuizzes = quizzes.filter((item) => item.source !== 'manual');
  const tx = db.transaction(['capsules', 'flashcards', 'quizzes', 'books'], 'readwrite');
  for (const item of dropCapsules) await tx.objectStore('capsules').delete(item.id);
  for (const item of dropCards) await tx.objectStore('flashcards').delete(item.id);
  for (const item of dropQuizzes) await tx.objectStore('quizzes').delete(item.id);
  const now = Date.now();
  pack.capsules.forEach((capsule, index) => {
    const next: Capsule = {
      id: crypto.randomUUID(),
      bookId: book.id,
      chapterId: capsule.chapterId,
      title: capsule.title,
      idea: capsule.idea,
      practice: capsule.practice,
      quote: capsule.quote,
      highlightId: capsule.highlightId,
      order: index,
      source,
      createdAt: now,
      updatedAt: now,
    };
    void tx.objectStore('capsules').put(next);
  });
  pack.flashcards.forEach((card) => {
    void tx.objectStore('flashcards').put(
      freshCard({
        bookId: book.id,
        front: card.front,
        back: card.back,
        chapterId: card.chapterId,
        highlightId: card.highlightId,
        source,
        createdAt: now,
        updatedAt: now,
      }, now),
    );
  });
  pack.quizzes.forEach((quiz) => {
    const next: QuizQuestion = {
      id: crypto.randomUUID(),
      bookId: book.id,
      question: quiz.question,
      options: quiz.options,
      correctIndex: quiz.correctIndex,
      explanation: quiz.explanation,
      source,
      createdAt: now,
      updatedAt: now,
    };
    void tx.objectStore('quizzes').put(next);
  });
  await tx.objectStore('books').put({ ...book, summary: pack.summary, updatedAt: now });
  await tx.done;
  await rememberTombs([
    ...dropCapsules.map((item) => ({ id: item.id, kind: 'capsule' as const })),
    ...dropCards.map((item) => ({ id: item.id, kind: 'flashcard' as const })),
    ...dropQuizzes.map((item) => ({ id: item.id, kind: 'quiz' as const })),
  ]);
}

export async function restoreStarters(): Promise<number> {
  const db = await open();
  const payload = await buildSeed();
  const existing = new Set((await db.getAll('books')).map((book) => book.id));
  let added = 0;
  for (const book of payload.books) {
    if (existing.has(book.id)) continue;
    added += 1;
    await db.put('books', book);
    for (const chapter of payload.chapters.filter((item) => item.bookId === book.id)) await db.put('chapters', chapter);
    for (const highlight of payload.highlights.filter((item) => item.bookId === book.id)) await db.put('highlights', highlight);
    for (const capsule of payload.capsules.filter((item) => item.bookId === book.id)) await db.put('capsules', capsule);
    for (const card of payload.flashcards.filter((item) => item.bookId === book.id)) await db.put('flashcards', card);
    for (const quiz of payload.quizzes.filter((item) => item.bookId === book.id)) await db.put('quizzes', quiz);
  }
  return added;
}

export async function exportSnapshot(): Promise<BackupFile> {
  await ensureReady();
  const db = await open();
  const library = await loadLibrary();
  return {
    version: 1,
    app: 'kora',
    exportedAt: Date.now(),
    books: library.books,
    chapters: await db.getAll('chapters'),
    highlights: library.highlights,
    capsules: library.capsules,
    flashcards: library.flashcards,
    quizzes: library.quizzes,
    streak: library.streak,
    settings: library.settings,
    tombstones: library.tombstones,
  };
}

function latestTombs(current: Tombstone[], incoming: Tombstone[]): Tombstone[] {
  const map = new Map<string, Tombstone>();
  for (const tomb of [...current, ...incoming]) {
    const key = `${tomb.kind}:${tomb.id}`;
    const prev = map.get(key);
    if (!prev || tomb.deletedAt > prev.deletedAt) map.set(key, tomb);
  }
  return [...map.values()];
}

function mergeById<T extends { id: string; updatedAt: number }>(local: T[], incoming: T[]): T[] {
  const map = new Map(local.map((item) => [item.id, item]));
  for (const item of incoming) {
    const prev = map.get(item.id);
    if (!prev || (item.updatedAt || 0) >= (prev.updatedAt || 0)) map.set(item.id, item);
  }
  return [...map.values()];
}

function alive<T extends { id: string; updatedAt: number }>(items: T[], kind: TombstoneKind, tombs: Tombstone[]): T[] {
  return items.filter((item) => {
    const tomb = tombs.find((entry) => entry.kind === kind && entry.id === item.id);
    return !tomb || tomb.deletedAt < item.updatedAt;
  });
}

async function replaceStores(snapshot: BackupFile): Promise<void> {
  const db = await open();
  const tx = db.transaction(['books', 'chapters', 'highlights', 'capsules', 'flashcards', 'quizzes', 'kv'], 'readwrite');
  for (const store of ['books', 'chapters', 'highlights', 'capsules', 'flashcards', 'quizzes'] as const) {
    await tx.objectStore(store).clear();
  }
  for (const book of snapshot.books) await tx.objectStore('books').put(book);
  for (const chapter of snapshot.chapters) await tx.objectStore('chapters').put(chapter);
  for (const highlight of snapshot.highlights) await tx.objectStore('highlights').put(highlight);
  for (const capsule of snapshot.capsules) await tx.objectStore('capsules').put(capsule);
  for (const card of snapshot.flashcards) await tx.objectStore('flashcards').put(card);
  for (const quiz of snapshot.quizzes) await tx.objectStore('quizzes').put(quiz);
  await tx.objectStore('kv').put(cleanSettings(snapshot.settings || defaultSettings), 'settings');
  await tx.objectStore('kv').put(snapshot.streak || defaultStreak(), 'streak');
  await tx.objectStore('kv').put(snapshot.tombstones || [], 'tombstones');
  await tx.objectStore('kv').put(true, 'seeded');
  await tx.done;
}

function keepsLocalAi(mode: BackupFile['aiSecretsMode']): boolean {
  return mode === 'omitted' || mode === 'encrypted';
}

function withLocalAi(settings: Settings, local: Settings): Settings {
  return cleanSettings({
    ...settings,
    aiProvider: local.aiProvider,
    geminiKey: local.geminiKey,
    geminiModel: local.geminiModel,
    syncEncryptedAiKeys: local.syncEncryptedAiKeys,
  });
}

export async function importSnapshot(data: unknown, mode: 'merge' | 'replace'): Promise<void> {
  if (!isBackup(data)) throw new Error('Ese archivo no es un respaldo de Kora.');
  const local = await loadLibrary();
  if (mode === 'replace') {
    const settings = keepsLocalAi(data.aiSecretsMode)
      ? withLocalAi({ ...defaultSettings, ...data.settings }, local.settings)
      : data.settings || defaultSettings;
    await replaceStores({ ...data, settings });
    return;
  }
  const db = await open();
  const chapters = await db.getAll('chapters');
  const tombs = latestTombs(local.tombstones, data.tombstones || []);
  const deadBooks = new Set(tombs.filter((tomb) => tomb.kind === 'book').map((tomb) => tomb.id));
  const books = alive(mergeById(local.books, data.books), 'book', tombs);
  const mergedChapters = alive(mergeById(chapters, data.chapters), 'chapter', tombs).filter((chapter) => !deadBooks.has(chapter.bookId) && books.some((book) => book.id === chapter.bookId));
  const highlights = alive(mergeById(local.highlights, data.highlights), 'highlight', tombs).filter((item) => books.some((book) => book.id === item.bookId));
  const capsules = alive(mergeById(local.capsules, data.capsules), 'capsule', tombs).filter((item) => books.some((book) => book.id === item.bookId));
  const flashcards = alive(mergeById(local.flashcards, data.flashcards), 'flashcard', tombs).filter((item) => books.some((book) => book.id === item.bookId));
  const quizzes = alive(mergeById(local.quizzes, data.quizzes), 'quiz', tombs).filter((item) => books.some((book) => book.id === item.bookId));
  const merged = data.exportedAt > Date.now() - 1000 * 60 * 60 * 24 * 365 * 20
    ? { ...local.settings, ...stripEmptySecrets(data.settings, local.settings) }
    : local.settings;
  const settings = keepsLocalAi(data.aiSecretsMode) ? withLocalAi(merged, local.settings) : merged;
  const streak = pickStreak(local.streak, data.streak);
  await replaceStores({
    ...data,
    books,
    chapters: mergedChapters,
    highlights,
    capsules,
    flashcards,
    quizzes,
    settings,
    streak,
    tombstones: tombs,
  });
}

function stripEmptySecrets(incoming: Settings, local: Settings): Settings {
  const next = cleanSettings(incoming);
  if (!next.geminiKey) {
    next.geminiKey = local.geminiKey;
    next.geminiModel = local.geminiModel || next.geminiModel;
    next.aiProvider = local.aiProvider;
  }
  if (!next.googleClientId) next.googleClientId = local.googleClientId;
  next.googleAccessToken = '';
  next.googleTokenExpiry = 0;
  return next;
}

function pickStreak(local: Streak, incoming: Streak): Streak {
  if (!incoming) return local;
  if ((incoming.lastGoalDate || '') > (local.lastGoalDate || '')) return incoming;
  if (incoming.lastGoalDate === local.lastGoalDate && incoming.current > local.current) return incoming;
  if (incoming.date === local.date && incoming.minutesToday + incoming.capsulesToday > local.minutesToday + local.capsulesToday) {
    return { ...local, minutesToday: Math.max(local.minutesToday, incoming.minutesToday), capsulesToday: Math.max(local.capsulesToday, incoming.capsulesToday), longest: Math.max(local.longest, incoming.longest) };
  }
  return { ...local, longest: Math.max(local.longest, incoming.longest || 0) };
}
