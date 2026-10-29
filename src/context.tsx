import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { generateWithAi } from './lib/ai';
import { downloadJson, readJsonFile } from './lib/backup';
import { todayKey } from './lib/dates';
import { decryptAiSecrets } from './lib/ai-crypto';
import { buildDriveSnapshot, buildExportSnapshot } from './lib/drive-snapshot';
import { cleanSettings } from './lib/settings';
import { downloadSync, uploadSync } from './lib/drive';
import { generateLocal } from './lib/extract';
import { applySm2, type Grade } from './lib/sm2';
import { useTts } from './tts';
import {
  chaptersOf,
  deleteBook as deleteBookDb,
  ensureReady,
  exportSnapshot,
  importBuffer,
  importSnapshot,
  loadAiSyncPassword,
  loadLibrary,
  recordActivity,
  removeCapsule,
  removeCard,
  removeHighlight,
  restoreStarters,
  saveBook,
  saveCapsule,
  saveCard,
  saveGenerated,
  saveHighlight,
  saveSettings,
  saveStreak,
} from './db';
import type {
  AiSecrets,
  BackupFile,
  Book,
  Capsule,
  Chapter,
  DraftCapsule,
  DraftCard,
  Flashcard,
  Highlight,
  HighlightColor,
  QuizQuestion,
  ReadingPosition,
  Settings,
  Streak,
} from './types';

interface Toast {
  id: number;
  text: string;
}

interface HighlightInput {
  bookId: string;
  chapterId: string;
  text: string;
  note: string;
  color: HighlightColor;
  start: number;
  end: number;
}

interface KoraContextValue {
  ready: boolean;
  error: string;
  books: Book[];
  highlights: Highlight[];
  capsules: Capsule[];
  cards: Flashcard[];
  quizzes: QuizQuestion[];
  settings: Settings;
  streak: Streak;
  tts: ReturnType<typeof useTts>;
  toasts: Toast[];
  installEvent: BeforeInstallPromptEvent | null;
  toast: (text: string) => void;
  promptInstall: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  updateGoals: (patch: Partial<Pick<Streak, 'dailyGoalMinutes' | 'dailyCapsuleGoal'>>) => Promise<void>;
  importFiles: (files: File[]) => Promise<void>;
  importDriveBuffer: (fileName: string, data: ArrayBuffer, driveFileId: string) => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  saveProgress: (bookId: string, position: ReadingPosition, progress: number) => Promise<void>;
  patchBook: (bookId: string, patch: Partial<Pick<Book, 'favorite' | 'rating'>>) => Promise<void>;
  addHighlight: (input: HighlightInput) => Promise<Highlight>;
  updateHighlight: (highlight: Highlight) => Promise<void>;
  deleteHighlight: (highlight: Highlight) => Promise<void>;
  addCapsule: (bookId: string, draft: DraftCapsule) => Promise<void>;
  updateCapsule: (capsule: Capsule) => Promise<void>;
  deleteCapsule: (capsule: Capsule) => Promise<void>;
  completeCapsule: (capsule: Capsule) => Promise<void>;
  addCard: (bookId: string, draft: DraftCard) => Promise<Flashcard>;
  updateCard: (card: Flashcard) => Promise<void>;
  deleteCard: (card: Flashcard) => Promise<void>;
  reviewCard: (card: Flashcard, grade: Grade) => Promise<void>;
  generateForBook: (book: Book, chapters: Chapter[], engine: 'local' | 'gemini') => Promise<void>;
  recordMinutes: (minutes: number) => Promise<void>;
  exportBackup: () => Promise<void>;
  importBackup: (file: File, mode: 'merge' | 'replace') => Promise<void>;
  restoreExamples: () => Promise<void>;
  pushSync: (accessToken: string) => Promise<void>;
  pullSync: (accessToken: string) => Promise<void>;
  loadChapters: (bookId: string) => Promise<Chapter[]>;
}

const KoraContext = createContext<KoraContextValue | null>(null);

function overlap(a: { start: number; end: number }, b: { start: number; end: number }) {
  const shared = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  const length = Math.max(a.end - a.start, 1);
  return shared / length;
}

export function KoraProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const tts = useTts();
  const streakRef = useRef<Streak | null>(null);
  const booksRef = useRef<Book[]>([]);
  const highlightsRef = useRef<Highlight[]>([]);
  const settingsRef = useRef<Settings | null>(null);
  const settingsSeen = useRef<Settings | null>(null);
  streakRef.current = streak;
  booksRef.current = books;
  highlightsRef.current = highlights;
  if (settings !== settingsSeen.current) {
    settingsSeen.current = settings;
    settingsRef.current = settings;
  }

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts([{ id, text }]);
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 3200);
  }, []);

  const refresh = useCallback(async () => {
    const data = await loadLibrary();
    setBooks(data.books);
    setHighlights(data.highlights);
    setCapsules(data.capsules);
    setCards(data.flashcards);
    setQuizzes(data.quizzes);
    setSettings(data.settings);
    setStreak(data.streak);
  }, []);

  useEffect(() => {
    ensureReady()
      .then(refresh)
      .then(() => setReady(true))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'No se pudo abrir la biblioteca local.');
        setReady(true);
      });
  }, [refresh]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  }, [installEvent]);

  const settingsWrite = useRef(Promise.resolve());
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const current = settingsRef.current;
    if (!current) return Promise.resolve();
    const next = { ...current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    const run = settingsWrite.current.then(async () => {
      const latest = settingsRef.current;
      if (latest) await saveSettings(latest);
    });
    settingsWrite.current = run.then(() => undefined, () => undefined);
    return run;
  }, []);

  const updateGoals = useCallback(async (patch: Partial<Pick<Streak, 'dailyGoalMinutes' | 'dailyCapsuleGoal'>>) => {
    const current = streakRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    streakRef.current = next;
    setStreak(next);
    await saveStreak(next);
  }, []);

  const importFiles = useCallback(async (files: File[]) => {
    let imported = 0;
    for (const file of files) {
      try {
        const data = await file.arrayBuffer();
        await importBuffer({ data, fileName: file.name, source: 'local' });
        imported += 1;
      } catch (reason) {
        toast(reason instanceof Error ? reason.message : `No se pudo importar ${file.name}.`);
      }
    }
    if (imported) {
      await refresh();
      toast(imported === 1 ? 'Libro importado.' : `${imported} libros importados.`);
    }
  }, [refresh, toast]);

  const importDriveBuffer = useCallback(async (fileName: string, data: ArrayBuffer, driveFileId: string) => {
    await importBuffer({ data, fileName, source: 'drive', driveFileId });
    await refresh();
  }, [refresh]);

  const removeBook = useCallback(async (bookId: string) => {
    await deleteBookDb(bookId);
    await refresh();
    toast('Libro eliminado de este dispositivo.');
  }, [refresh, toast]);

  const saveProgress = useCallback(async (bookId: string, position: ReadingPosition, progress: number) => {
    const book = booksRef.current.find((item) => item.id === bookId);
    if (!book) return;
    const next = { ...book, lastPosition: position, progress, updatedAt: Date.now() };
    booksRef.current = booksRef.current.map((item) => (item.id === bookId ? next : item));
    setBooks(booksRef.current);
    await saveBook(next);
  }, []);

  const patchBook = useCallback(async (bookId: string, patch: Partial<Pick<Book, 'favorite' | 'rating'>>) => {
    const book = booksRef.current.find((item) => item.id === bookId);
    if (!book) return;
    const next = { ...book, ...patch, updatedAt: Date.now() };
    booksRef.current = booksRef.current.map((item) => (item.id === bookId ? next : item));
    setBooks(booksRef.current);
    await saveBook(next);
  }, []);

  const addHighlight = useCallback(async (input: HighlightInput) => {
    const now = Date.now();
    const existing = highlightsRef.current.find((item) => item.chapterId === input.chapterId && overlap(item, input) > 0.8);
    const highlight: Highlight = existing
      ? { ...existing, ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
      : { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    await saveHighlight(highlight);
    setHighlights((list) => existing ? list.map((item) => (item.id === highlight.id ? highlight : item)) : [...list, highlight]);
    highlightsRef.current = existing
      ? highlightsRef.current.map((item) => (item.id === highlight.id ? highlight : item))
      : [...highlightsRef.current, highlight];
    return highlight;
  }, []);

  const updateHighlight = useCallback(async (highlight: Highlight) => {
    const next = { ...highlight, updatedAt: Date.now() };
    await saveHighlight(next);
    setHighlights((list) => list.map((item) => (item.id === next.id ? next : item)));
  }, []);

  const deleteHighlight = useCallback(async (highlight: Highlight) => {
    await removeHighlight(highlight);
    setHighlights((list) => list.filter((item) => item.id !== highlight.id));
    toast('Subrayado eliminado.');
  }, [toast]);

  const addCapsule = useCallback(async (bookId: string, draft: DraftCapsule) => {
    const now = Date.now();
    const order = capsules.filter((item) => item.bookId === bookId).reduce((max, item) => Math.max(max, item.order), -1) + 1;
    const capsule: Capsule = {
      id: crypto.randomUUID(),
      bookId,
      chapterId: draft.chapterId,
      title: draft.title,
      idea: draft.idea,
      practice: draft.practice,
      quote: draft.quote,
      highlightId: draft.highlightId,
      order,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };
    await saveCapsule(capsule);
    setCapsules((list) => [...list, capsule]);
    toast('Idea clave creada.');
  }, [capsules, toast]);

  const updateCapsule = useCallback(async (capsule: Capsule) => {
    const next = { ...capsule, updatedAt: Date.now() };
    await saveCapsule(next);
    setCapsules((list) => list.map((item) => (item.id === next.id ? next : item)));
  }, []);

  const deleteCapsule = useCallback(async (capsule: Capsule) => {
    await removeCapsule(capsule);
    setCapsules((list) => list.filter((item) => item.id !== capsule.id));
  }, []);

  const completeCapsule = useCallback(async (capsule: Capsule) => {
    const current = streakRef.current;
    if (!current) return;
    const today = todayKey();
    if (capsule.completedAt && todayKey(new Date(capsule.completedAt)) === today) {
      toast('Esta idea ya cuenta para la meta de hoy.');
      return;
    }
    const next = { ...capsule, completedAt: Date.now(), updatedAt: Date.now() };
    await saveCapsule(next);
    setCapsules((list) => list.map((item) => (item.id === next.id ? next : item)));
    const streakNext = await recordActivity(current, 2, 1);
    streakRef.current = streakNext;
    setStreak(streakNext);
    toast(streakNext.lastGoalDate === today ? 'Idea hecha. La meta de hoy avanza.' : 'Idea marcada.');
  }, [toast]);

  const addCard = useCallback(async (bookId: string, draft: DraftCard) => {
    const now = Date.now();
    const card = {
      id: crypto.randomUUID(),
      bookId,
      chapterId: draft.chapterId,
      front: draft.front,
      back: draft.back,
      highlightId: draft.highlightId,
      source: 'manual' as const,
      ease: 2.5,
      interval: 0,
      repetitions: 0,
      due: now,
      createdAt: now,
      updatedAt: now,
    };
    await saveCard(card);
    setCards((list) => [...list, card]);
    return card;
  }, []);

  const updateCard = useCallback(async (card: Flashcard) => {
    const next = { ...card, updatedAt: Date.now() };
    await saveCard(next);
    setCards((list) => list.map((item) => (item.id === next.id ? next : item)));
  }, []);

  const deleteCard = useCallback(async (card: Flashcard) => {
    await removeCard(card);
    setCards((list) => list.filter((item) => item.id !== card.id));
  }, []);

  const reviewCard = useCallback(async (card: Flashcard, grade: Grade) => {
    const next = applySm2(card, grade);
    await saveCard(next);
    setCards((list) => list.map((item) => (item.id === next.id ? next : item)));
    const current = streakRef.current;
    if (current) {
      const streakNext = await recordActivity(current, 0.4, 0);
      streakRef.current = streakNext;
      setStreak(streakNext);
    }
  }, []);

  const generateForBook = useCallback(async (book: Book, chapters: Chapter[], engine: 'local' | 'gemini') => {
    if (!settings) throw new Error('Ajustes no disponibles.');
    const related = highlightsRef.current.filter((item) => item.bookId === book.id && chapters.some((chapter) => chapter.id === item.chapterId));
    const pack = engine === 'local'
      ? generateLocal(chapters, related)
      : await generateWithAi({ ...settings, aiProvider: engine }, book.title, book.author, chapters);
    await saveGenerated(book, pack, engine === 'local' ? 'local' : 'ai');
    await refresh();
    toast(`Síntesis lista: ${pack.capsules.length} ideas, ${pack.flashcards.length} tarjetas y ${pack.quizzes.length} preguntas.`);
  }, [refresh, settings, toast]);

  const recordMinutes = useCallback(async (minutes: number) => {
    const current = streakRef.current;
    if (!current || minutes <= 0) return;
    const next = await recordActivity(current, minutes, 0);
    streakRef.current = next;
    setStreak(next);
  }, []);

  const applyAiSecrets = useCallback(async (secrets: AiSecrets) => {
    const latest = await loadLibrary();
    const next = cleanSettings({
      ...latest.settings,
      aiProvider: secrets.aiProvider,
      geminiKey: secrets.geminiKey,
      geminiModel: secrets.geminiModel,
    });
    settingsRef.current = next;
    setSettings(next);
    await saveSettings(next);
  }, []);

  const exportBackup = useCallback(async () => {
    const snapshot = await exportSnapshot();
    const password = snapshot.settings.syncEncryptedAiKeys ? await loadAiSyncPassword() : '';
    const payload = await buildExportSnapshot(snapshot, password);
    const date = todayKey();
    downloadJson(`kora-respaldo-${date}.json`, payload);
    toast('Respaldo descargado. También puedes subirlo a Drive a mano.');
  }, [toast]);

  const importBackup = useCallback(async (file: File, mode: 'merge' | 'replace') => {
    const data = await readJsonFile(file);
    await importSnapshot(data, mode);
    let keyError = '';
    if (data && typeof data === 'object' && (data as BackupFile).aiSecretsMode === 'encrypted' && (data as BackupFile).encryptedAi) {
      const password = await loadAiSyncPassword();
      if (!password.trim()) {
        keyError = 'Falta la contraseña de cifrado. Libros, progreso y subrayados se importaron; la clave de Gemini no.';
      } else {
        try {
          const secrets = await decryptAiSecrets((data as BackupFile).encryptedAi!, password);
          await applyAiSecrets(secrets);
        } catch (reason) {
          keyError = reason instanceof Error
            ? reason.message
            : 'La contraseña no es correcta. La clave de Gemini no se recuperó; libros, progreso y subrayados sí se importaron.';
        }
      }
    }
    await refresh();
    if (keyError) throw new Error(keyError);
    toast(mode === 'replace' ? 'Respaldo restaurado.' : 'Respaldo combinado con lo que ya tenías.');
  }, [applyAiSecrets, refresh, toast]);

  const restoreExamples = useCallback(async () => {
    const added = await restoreStarters();
    await refresh();
    toast(added ? 'Libros de ejemplo restaurados.' : 'Los libros de ejemplo ya estaban en la biblioteca.');
  }, [refresh, toast]);

  const pushSync = useCallback(async (accessToken: string) => {
    const snapshot = await exportSnapshot();
    const { driveFolderId, syncEncryptedAiKeys } = snapshot.settings;
    if (!accessToken || !driveFolderId) throw new Error('Conecta Google y elige una carpeta.');
    const password = syncEncryptedAiKeys ? await loadAiSyncPassword() : '';
    const payload = await buildDriveSnapshot(snapshot, password);
    await uploadSync(accessToken, driveFolderId, JSON.stringify(payload));
    toast(payload.aiSecretsMode === 'encrypted'
      ? 'kora-sync.json subido. Las claves de IA van cifradas.'
      : 'kora-sync.json subido a la carpeta de Drive.');
  }, [toast]);

  const pullSync = useCallback(async (accessToken: string) => {
    const current = (await loadLibrary()).settings;
    if (!accessToken || !current.driveFolderId) throw new Error('Conecta Google y elige una carpeta.');
    const snapshot = await downloadSync(accessToken, current.driveFolderId);
    const remoteHasCipher = snapshot.aiSecretsMode === 'encrypted' && Boolean(snapshot.encryptedAi);
    let secrets: AiSecrets | null = null;
    let keyError = '';
    let toImport = snapshot;
    if (!current.syncEncryptedAiKeys) {
      toImport = { ...snapshot, aiSecretsMode: 'omitted' };
    } else if (snapshot.aiSecretsMode === 'encrypted') {
      if (!snapshot.encryptedAi) {
        keyError = 'El archivo de Drive indica claves cifradas, pero falta el bloque. Libros, progreso y subrayados sí se sincronizaron.';
      } else {
        const password = await loadAiSyncPassword();
        if (!password.trim()) {
          keyError = 'Falta la contraseña de cifrado. Libros, progreso y subrayados se sincronizaron; las claves de IA no.';
        } else {
          try {
            secrets = await decryptAiSecrets(snapshot.encryptedAi, password);
          } catch (reason) {
            keyError = reason instanceof Error
              ? reason.message
              : 'La contraseña no es correcta. Las claves de IA no se recuperaron; libros, progreso y subrayados sí se sincronizaron.';
          }
        }
      }
    }
    await importSnapshot(toImport, 'merge');
    if (secrets) await applyAiSecrets(secrets);
    await refresh();
    if (keyError) throw new Error(keyError);
    toast(remoteHasCipher && secrets ? 'Sincronización bajada. Las claves de IA se recuperaron.' : 'Sincronización bajada y combinada.');
  }, [applyAiSecrets, refresh, toast]);

  const value = useMemo<KoraContextValue | null>(() => {
    if (!settings || !streak) return null;
    return {
      ready,
      error,
      books,
      highlights,
      capsules,
      cards,
      quizzes,
      settings,
      streak,
      tts,
      toasts,
      installEvent,
      toast,
      promptInstall,
      updateSettings,
      updateGoals,
      importFiles,
      importDriveBuffer,
      removeBook,
      saveProgress,
      patchBook,
      addHighlight,
      updateHighlight,
      deleteHighlight,
      addCapsule,
      updateCapsule,
      deleteCapsule,
      completeCapsule,
      addCard,
      updateCard,
      deleteCard,
      reviewCard,
      generateForBook,
      recordMinutes,
      exportBackup,
      importBackup,
      restoreExamples,
      pushSync,
      pullSync,
      loadChapters: chaptersOf,
    };
  }, [
    ready, error, books, highlights, capsules, cards, quizzes, settings, streak, tts, toasts, installEvent,
    toast, promptInstall, updateSettings, updateGoals, importFiles, importDriveBuffer, removeBook, saveProgress, patchBook,
    addHighlight, updateHighlight, deleteHighlight, addCapsule, updateCapsule, deleteCapsule, completeCapsule,
    addCard, updateCard, deleteCard, reviewCard, generateForBook, recordMinutes, exportBackup, importBackup,
    restoreExamples, pushSync, pullSync,
  ]);

  if (!ready || !value) {
    return (
      <div className="splash">
        <div className="logo-mark">K</div>
        <h1>Kora</h1>
        <p>{error || 'Abriendo tu biblioteca…'}</p>
      </div>
    );
  }

  return <KoraContext.Provider value={value}>{children}</KoraContext.Provider>;
}

export function useKora() {
  const context = useContext(KoraContext);
  if (!context) throw new Error('useKora fuera del proveedor');
  return context;
}
