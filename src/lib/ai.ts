import type { Chapter, DraftCapsule, GeneratedPack, Settings } from '../types';
import { quizFromCapsules, trimText } from './extract';
import { htmlToPlain } from './html';

function chapterBlock(chapters: Chapter[]): string {
  let used = 0;
  const parts: string[] = [];
  for (const chapter of chapters) {
    if (used > 28000) break;
    const text = trimText(htmlToPlain(chapter.html), 5500);
    used += text.length;
    parts.push(`[Capítulo ${chapter.index + 1}] ${chapter.title}\n${text}`);
  }
  return parts.join('\n\n');
}

function promptFor(title: string, author: string, chapters: Chapter[]): string {
  return `Eres el editor de Kora, una app de lectura y microaprendizaje en español.
A partir SOLO del texto del libro, crea material de estudio. No inventes datos que no estén en el texto.
Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, con esta forma:
{
  "resumen": "resumen ejecutivo en español, 120 a 180 palabras",
  "capsulas": [
    {"titulo": "", "idea": "", "enLaPractica": "", "cita": "", "capitulo": 1}
  ],
  "flashcards": [
    {"frente": "", "reverso": "", "capitulo": 1}
  ],
  "quiz": [
    {"pregunta": "", "opciones": ["", "", "", ""], "correcta": 0, "explicacion": ""}
  ]
}
Reglas:
- Entre 8 y 12 cápsulas. Cada una es una idea clave de una síntesis de 15 minutos: título breve, idea en 2 o 3 frases, "enLaPractica" con una acción concreta de hoy, y "cita" textual breve del capítulo o cadena vacía.
- "capitulo" es el número entre corchetes, empezando en 1.
- 10 a 14 flashcards. El frente pregunta de verdad; el reverso responde en pocas líneas. Nada de "¿qué dice el capítulo?".
- 5 o 6 preguntas de mini-quiz con 4 opciones y una sola correcta (índice 0 a 3).
- Todo en español.

Libro: ${title}
Autor: ${author}

TEXTO:
${chapterBlock(chapters)}`;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseModelJson(raw: string): Record<string, unknown> {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('La IA no devolvió JSON utilizable.');
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function chapterId(value: unknown, chapters: Chapter[]): string | undefined {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  const index = number >= 1 ? number - 1 : number;
  return chapters[index]?.id;
}

export function packFromModel(raw: string, chapters: Chapter[]): GeneratedPack {
  const data = parseModelJson(raw);
  const capsuleSource = (data.capsulas || data.capsules || []) as Record<string, unknown>[];
  const capsules: DraftCapsule[] = capsuleSource
    .map((item) => ({
      title: asText(item.titulo || item.title),
      idea: asText(item.idea),
      practice: asText(item.enLaPractica || item.practice || item.en_la_practica),
      quote: asText(item.cita || item.quote) || undefined,
      chapterId: chapterId(item.capitulo ?? item.chapter, chapters),
    }))
    .filter((item) => item.title && item.idea && item.practice)
    .slice(0, 12);
  if (capsules.length < 4) throw new Error('La respuesta no incluyó suficientes ideas clave.');

  const cardSource = (data.flashcards || data.tarjetas || []) as Record<string, unknown>[];
  let flashcards = cardSource
    .map((item) => ({
      front: asText(item.frente || item.front || item.pregunta),
      back: asText(item.reverso || item.back || item.respuesta),
      chapterId: chapterId(item.capitulo ?? item.chapter, chapters),
    }))
    .filter((item) => item.front && item.back)
    .slice(0, 16);
  if (flashcards.length < 4) {
    flashcards = capsules.slice(0, 10).map((capsule) => ({
      front: `Explica la idea «${capsule.title}».`,
      back: capsule.idea,
      chapterId: capsule.chapterId,
    }));
  }

  const quizSource = (data.quiz || data.preguntas || []) as Record<string, unknown>[];
  let quizzes = quizSource
    .map((item) => {
      const options = Array.isArray(item.opciones) ? item.opciones.map((option) => asText(option)).filter(Boolean) : [];
      const correctIndex = Number(item.correcta ?? item.correctIndex ?? 0);
      return {
        question: asText(item.pregunta || item.question),
        options,
        correctIndex: Number.isFinite(correctIndex) ? correctIndex : 0,
        explanation: asText(item.explicacion || item.explanation) || capsules[0]?.idea || '',
      };
    })
    .filter((item) => item.question && item.options.length >= 2 && item.correctIndex >= 0 && item.correctIndex < item.options.length)
    .slice(0, 8);
  if (quizzes.length < 3) quizzes = quizFromCapsules(capsules);

  return {
    summary: asText(data.resumen || data.summary) || capsules.map((capsule) => capsule.idea).slice(0, 3).join(' '),
    capsules,
    flashcards,
    quizzes,
  };
}

function redact(message: string, secret: string): string {
  const trimmed = secret.trim();
  if (!trimmed || !message.includes(trimmed)) return message;
  return message.split(trimmed).join('••••');
}

async function readError(response: Response, secret = ''): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } | string; message?: string };
    const raw = typeof data.error === 'string' ? data.error : data.error?.message || data.message || `Error ${response.status}`;
    return redact(raw, secret);
  } catch {
    return `Error ${response.status}`;
  }
}

function geminiUrl(model: string, action: 'generateContent' | ''): string {
  const path = action ? `:${action}` : '';
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}${path}`;
}

function geminiHeaders(key: string, json = true): HeadersInit {
  const headers: Record<string, string> = { 'x-goog-api-key': key };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function gemini(settings: Settings, prompt: string): Promise<string> {
  const model = settings.geminiModel.trim() || 'gemini-2.0-flash';
  const key = settings.geminiKey.trim();
  const url = geminiUrl(model, 'generateContent');
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  };
  let response = await fetch(url, {
    method: 'POST',
    headers: geminiHeaders(key),
    body: JSON.stringify(body),
  });
  if (response.status === 400) {
    response = await fetch(url, {
      method: 'POST',
      headers: geminiHeaders(key),
      body: JSON.stringify({ contents: body.contents, generationConfig: { temperature: 0.4 } }),
    });
  }
  if (!response.ok) throw new Error(await readError(response, key));
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (data.error?.message) throw new Error(redact(data.error.message, key));
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
  if (!text.trim()) throw new Error('Gemini no devolvió texto.');
  return text;
}

export async function testGeminiKey(key: string, model: string): Promise<void> {
  const trimmed = key.trim();
  const chosen = model.trim() || 'gemini-2.0-flash';
  if (!trimmed) throw new Error('Añade tu clave de Gemini.');
  const response = await fetch(geminiUrl(chosen, ''), { headers: geminiHeaders(trimmed, false) });
  if (response.status === 404) throw new Error('Ese modelo de Gemini no está disponible.');
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new Error('La clave de Gemini no funciona. Revisa que sea válida.');
  }
  if (!response.ok) throw new Error('No se pudo probar la clave de Gemini.');
}

export async function generateWithAi(settings: Settings, title: string, author: string, chapters: Chapter[]): Promise<GeneratedPack> {
  if (!navigator.onLine) throw new Error('Sin conexión. Puedes generar la síntesis en local.');
  if (!settings.geminiKey.trim()) throw new Error('Falta la clave de Gemini en Ajustes.');
  const prompt = promptFor(title, author, chapters);
  return packFromModel(await gemini(settings, prompt), chapters);
}
