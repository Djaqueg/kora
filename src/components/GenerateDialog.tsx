import { useState } from 'react';
import { useKora } from '../context';
import type { Book, Chapter } from '../types';
import { Modal } from './Modal';

export function GenerateDialog({
  book,
  chapters,
  initialChapterId,
  onClose,
}: {
  book: Book;
  chapters: Chapter[];
  initialChapterId?: string;
  onClose: () => void;
}) {
  const { settings, generateForBook, toast } = useKora();
  const [engine, setEngine] = useState<'local' | 'gemini'>(settings.aiProvider === 'gemini' && settings.geminiKey.trim() ? 'gemini' : 'local');
  const [scope, setScope] = useState<'book' | 'chapter'>(initialChapterId ? 'chapter' : 'book');
  const [chapterId, setChapterId] = useState(initialChapterId || chapters[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const selected = scope === 'chapter' ? chapters.filter((chapter) => chapter.id === chapterId) : chapters;
      if (!selected.length) throw new Error('No hay capítulos para sintetizar.');
      if (engine === 'gemini' && !settings.geminiKey.trim()) throw new Error('Añade tu clave de Gemini en Ajustes.');
      await generateForBook(book, selected, engine);
      onClose();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'No se pudo generar la síntesis.';
      setError(message);
      toast(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Generar síntesis" onClose={onClose}>
      <p className="muted">
        Se crean de 8 a 12 ideas clave, un resumen ejecutivo, flashcards y un mini-quiz. Las cápsulas y tarjetas hechas a mano se conservan.
      </p>
      <fieldset className="choice-set">
        <legend>Motor</legend>
        <label><input type="radio" name="engine" checked={engine === 'local'} onChange={() => setEngine('local')} /> Modo local, sin API</label>
        <label><input type="radio" name="engine" checked={engine === 'gemini'} onChange={() => setEngine('gemini')} /> Gemini {settings.geminiKey ? '' : '(sin clave)'}</label>
      </fieldset>
      <fieldset className="choice-set">
        <legend>Alcance</legend>
        <label><input type="radio" name="scope" checked={scope === 'book'} onChange={() => setScope('book')} /> Libro completo</label>
        <label><input type="radio" name="scope" checked={scope === 'chapter'} onChange={() => setScope('chapter')} /> Un capítulo</label>
        {scope === 'chapter' && (
          <select value={chapterId} onChange={(event) => setChapterId(event.target.value)} aria-label="Capítulo">
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>{chapter.index + 1}. {chapter.title}</option>
            ))}
          </select>
        )}
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions">
        <button className="btn secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn" type="button" onClick={() => void run()} disabled={busy} data-testid="generate-confirm">
          {busy ? 'Generando…' : engine === 'local' ? 'Generar en local' : 'Generar con IA'}
        </button>
      </div>
    </Modal>
  );
}
