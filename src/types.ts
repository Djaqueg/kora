export type BookFormat = 'EPUB' | 'PDF' | 'TXT' | 'MD';
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'rose';
export type AiProvider = 'gemini' | 'nvidia' | 'none';
export type ContentSource = 'seed' | 'manual' | 'local' | 'ai';
export type ReaderTheme = 'claro' | 'sepia' | 'oscuro';
export type ReaderFont = 'newsreader' | 'playfair' | 'literata' | 'jakarta' | 'outfit' | 'serif';
export type ScrollMode = 'scroll' | 'page';

export interface ReadingPosition {
  chapterId: string;
  scrollRatio: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  cover: string;
  addedAt: number;
  updatedAt: number;
  progress: number;
  lastPosition?: ReadingPosition;
  source: 'builtin' | 'local' | 'drive';
  driveFileId?: string;
  fileName?: string;
  summary?: string;
  rating?: number;
  favorite?: boolean;
}

export interface Chapter {
  id: string;
  bookId: string;
  index: number;
  title: string;
  html: string;
  updatedAt: number;
}

export interface Highlight {
  id: string;
  bookId: string;
  chapterId: string;
  text: string;
  note: string;
  color: HighlightColor;
  start: number;
  end: number;
  createdAt: number;
  updatedAt: number;
}

export interface Capsule {
  id: string;
  bookId: string;
  chapterId?: string;
  title: string;
  idea: string;
  practice: string;
  quote?: string;
  highlightId?: string;
  order: number;
  source: ContentSource;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Flashcard {
  id: string;
  bookId: string;
  chapterId?: string;
  front: string;
  back: string;
  highlightId?: string;
  source: ContentSource;
  ease: number;
  interval: number;
  repetitions: number;
  due: number;
  lastReview?: number;
  createdAt: number;
  updatedAt: number;
}

export interface QuizQuestion {
  id: string;
  bookId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  source: ContentSource;
  createdAt: number;
  updatedAt: number;
}

export interface Streak {
  current: number;
  longest: number;
  lastGoalDate: string;
  dailyGoalMinutes: number;
  dailyCapsuleGoal: number;
  minutesToday: number;
  capsulesToday: number;
  date: string;
}

export interface Settings {
  aiProvider: AiProvider;
  geminiKey: string;
  geminiModel: string;
  nvidiaKey: string;
  nvidiaBaseUrl: string;
  nvidiaModel: string;
  googleClientId: string;
  googleAccessToken: string;
  googleTokenExpiry: number;
  driveFolderId: string;
  driveFolderName: string;
  theme: ReaderTheme;
  fontFamily: ReaderFont;
  fontSize: number;
  lineHeight: number;
  scrollMode: ScrollMode;
  brightness: number;
}

export type TombstoneKind = 'book' | 'chapter' | 'highlight' | 'capsule' | 'flashcard' | 'quiz';

export interface Tombstone {
  id: string;
  kind: TombstoneKind;
  deletedAt: number;
}

export interface BackupFile {
  version: 1;
  app: 'kora';
  exportedAt: number;
  books: Book[];
  chapters: Chapter[];
  highlights: Highlight[];
  capsules: Capsule[];
  flashcards: Flashcard[];
  quizzes: QuizQuestion[];
  streak: Streak;
  settings: Settings;
  tombstones: Tombstone[];
}

export interface DraftCapsule {
  title: string;
  idea: string;
  practice: string;
  quote?: string;
  chapterId?: string;
  highlightId?: string;
}

export interface DraftCard {
  front: string;
  back: string;
  chapterId?: string;
  highlightId?: string;
}

export interface DraftQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface GeneratedPack {
  summary: string;
  capsules: DraftCapsule[];
  flashcards: DraftCard[];
  quizzes: DraftQuiz[];
}

export const defaultSettings: Settings = {
  aiProvider: 'none',
  geminiKey: '',
  geminiModel: 'gemini-2.0-flash',
  nvidiaKey: '',
  nvidiaBaseUrl: 'https://integrate.api.nvidia.com/v1',
  nvidiaModel: 'meta/llama-3.1-70b-instruct',
  googleClientId: '',
  googleAccessToken: '',
  googleTokenExpiry: 0,
  driveFolderId: '',
  driveFolderName: '',
  theme: 'claro',
  fontFamily: 'newsreader',
  fontSize: 23,
  lineHeight: 1.72,
  scrollMode: 'scroll',
  brightness: 86,
};
