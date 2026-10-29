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

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } | string; message?: string };
    if (typeof data.error === 'string') return data.error;
    return data.error?.message || data.message || `Error ${response.status}`;
  } catch {
    return `Error ${response.status}`;
  }
}

async function gemini(settings: Settings, prompt: string): Promise<string> {
  const model = settings.geminiModel.trim() || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.geminiKey.trim())}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  };
  let response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 400) {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: body.contents, generationConfig: { temperature: 0.4 } }),
    });
  }
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (data.error?.message) throw new Error(data.error.message);
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
  if (!text.trim()) throw new Error('Gemini no devolvió texto.');
  return text;
}

async function nvidia(settings: Settings, prompt: string): Promise<string> {
  const base = (settings.nvidiaBaseUrl.trim() || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.nvidiaKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.nvidiaModel.trim() || 'meta/llama-3.1-70b-instruct',
      temperature: 0.4,
      stream: false,
      messages: [
        { role: 'system', content: 'Respondes solo con un objeto JSON válido, en español, sin markdown.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (data.error?.message) throw new Error(data.error.message);
  const text = data.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('El modelo no devolvió texto.');
  return text;
}

export async function generateWithAi(settings: Settings, title: string, author: string, chapters: Chapter[]): Promise<GeneratedPack> {
  if (!navigator.onLine) throw new Error('Sin conexión. Puedes generar la síntesis en local.');
  const prompt = promptFor(title, author, chapters);
  if (settings.aiProvider === 'gemini') {
    if (!settings.geminiKey.trim()) throw new Error('Falta la clave de Gemini en Ajustes.');
    return packFromModel(await gemini(settings, prompt), chapters);
  }
  if (settings.aiProvider === 'nvidia') {
    if (!settings.nvidiaKey.trim()) throw new Error('Falta la clave de NVIDIA Build en Ajustes.');
    return packFromModel(await nvidia(settings, prompt), chapters);
  }
  throw new Error('Elige un proveedor de IA en Ajustes o usa el modo local.');
}
