import { defaultSettings, type AiProvider, type ReaderFont, type ReaderTheme, type ScrollMode, type Settings } from '../types';

export const GEMINI_MODELS: { id: string; label: string }[] = [
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon' },
];

const FONTS = new Set<ReaderFont>(['newsreader', 'playfair', 'literata', 'jakarta', 'outfit', 'serif']);
const THEMES = new Set<ReaderTheme>(['claro', 'sepia', 'oscuro']);

export function maskGeminiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  return `••••${trimmed.slice(-4)}`;
}

export function isKnownGeminiModel(model: string): boolean {
  return GEMINI_MODELS.some((item) => item.id === model);
}

export function cleanSettings(input: unknown): Settings {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const geminiKey = typeof raw.geminiKey === 'string' ? raw.geminiKey.trim() : '';
  const provider = raw.aiProvider;
  let aiProvider: AiProvider = 'none';
  if (provider === 'none') aiProvider = 'none';
  else if ((provider === 'gemini' || provider === 'nvidia') && geminiKey) aiProvider = 'gemini';
  else if (provider === 'gemini' || provider === 'nvidia') aiProvider = 'none';
  else aiProvider = geminiKey ? 'gemini' : 'none';

  const requested = typeof raw.geminiModel === 'string' ? raw.geminiModel.trim() : '';
  const geminiModel = requested && isKnownGeminiModel(requested) ? requested : defaultSettings.geminiModel;
  const theme = typeof raw.theme === 'string' && THEMES.has(raw.theme as ReaderTheme) ? (raw.theme as ReaderTheme) : defaultSettings.theme;
  const fontFamily = typeof raw.fontFamily === 'string' && FONTS.has(raw.fontFamily as ReaderFont)
    ? (raw.fontFamily as ReaderFont)
    : defaultSettings.fontFamily;
  const scrollMode: ScrollMode = raw.scrollMode === 'page' ? 'page' : raw.scrollMode === 'scroll' ? 'scroll' : defaultSettings.scrollMode;

  return {
    aiProvider,
    geminiKey,
    geminiModel,
    syncEncryptedAiKeys: raw.syncEncryptedAiKeys === true,
    googleClientId: typeof raw.googleClientId === 'string' ? raw.googleClientId : '',
    googleAccessToken: '',
    googleTokenExpiry: 0,
    driveFolderId: typeof raw.driveFolderId === 'string' ? raw.driveFolderId : '',
    driveFolderName: typeof raw.driveFolderName === 'string' ? raw.driveFolderName : '',
    theme,
    fontFamily,
    fontSize: typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize) ? raw.fontSize : defaultSettings.fontSize,
    lineHeight: typeof raw.lineHeight === 'number' && Number.isFinite(raw.lineHeight) ? raw.lineHeight : defaultSettings.lineHeight,
    scrollMode,
    brightness: typeof raw.brightness === 'number' && Number.isFinite(raw.brightness) ? raw.brightness : defaultSettings.brightness,
  };
}

export function settingsNeedRewrite(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const record = raw as Record<string, unknown>;
  if ('nvidiaKey' in record || 'nvidiaBaseUrl' in record || 'nvidiaModel' in record) return true;
  if (record.aiProvider === 'nvidia') return true;
  if (typeof record.googleAccessToken === 'string' && record.googleAccessToken) return true;
  if (typeof record.googleTokenExpiry === 'number' && record.googleTokenExpiry !== 0) return true;
  const model = typeof record.geminiModel === 'string' ? record.geminiModel.trim() : '';
  if (model && !isKnownGeminiModel(model)) return true;
  return false;
}
