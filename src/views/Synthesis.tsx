import { useMemo, useState } from 'react';
import { useKora } from '../context';
import { todayKey } from '../lib/dates';
import { navigate } from '../router';
import type { Capsule } from '../types';

export function Synthesis({ id }: { id: string }) {
  const { books, capsules, completeCapsule, updateCapsule, deleteCapsule, addCapsule, tts } = useKora();
  const book = books.find((item) => item.id === id);
  const items = useMemo(
    () => capsules.filter((item) => item.bookId === id).sort((a, b) => a.order - b.order),
    [capsules, id],
  );
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState<Capsule | null>(null);
  const [creating, setCreating] = useState(false);
  const [origin, setOrigin] = useState<number | null>(null);
  const current = items[Math.min(index, Math.max(items.length - 1, 0))];

  if (!book) {
    return <div className="page"><h1>No encuentro ese libro</h1></div>;
  }

  function playAll() {
    const queue = items.flatMap((capsule) => [
      { text: capsule.title, label: capsule.title, chapterId: capsule.chapterId },
      { text: capsule.idea, label: capsule.title, chapterId: capsule.chapterId },
      { text: `En la práctica. ${capsule.practice}`, label: capsule.title, chapterId: capsule.chapterId },
      ...(capsule.quote ? [{ text: `Cita. ${capsule.quote}`, label: capsule.title, chapterId: capsule.chapterId }] : []),
    ]);
    tts.play(queue);
  }

  function goPassage(capsule: Capsule) {
    const quote = capsule.quote || capsule.idea;
    const params = new URLSearchParams();
    if (capsule.chapterId) params.set('c', capsule.chapterId);
    if (quote) params.set('q', quote.slice(0, 180));
    navigate(`/leer/${book!.id}?${params.toString()}`);
  }

  const doneToday = current?.completedAt && todayKey(new Date(current.completedAt)) === todayKey();

  return (
    <div className="page synthesis" data-testid="synthesis-view">
      <button className="text-btn" type="button" onClick={() => navigate(`/libro/${book.id}`)}>← {book.title}</button>
      <header className="page-head">
        <div>
          <p className="eyebrow">Síntesis 15 min</p>
          <h1>{items.length} ideas clave</h1>
        </div>
        <div className="row-actions">
          <button className="btn" type="button" onClick={playAll} disabled={!items.length}>Audio resumen</button>
          <button className="btn secondary" type="button" onClick={() => setCreating(true)}>Nueva cápsula</button>
        </div>
      </header>
      {book.summary && <p className="summary-banner">{book.summary}</p>}
      {current ? (
        <article
          className="capsule"
          data-testid="capsule-card"
          onPointerDown={(event) => setOrigin(event.clientX)}
          onPointerUp={(event) => {
            if (origin === null) return;
            const delta = event.clientX - origin;
            if (delta < -50) setIndex((value) => Math.min(items.length - 1, value + 1));
            if (delta > 50) setIndex((value) => Math.max(0, value - 1));
            setOrigin(null);
          }}
        >
          <p className="eyebrow">Idea {index + 1} de {items.length}</p>
          <h2 data-testid="capsule-title">{current.title}</h2>
          <p className="idea">{current.idea}</p>
          <div className="practice">
            <strong>En la práctica</strong>
            <p>{current.practice}</p>
          </div>
          {current.quote && <blockquote>«{current.quote}»</blockquote>}
          <div className="row-actions">
            <button className="btn secondary" type="button" onClick={() => goPassage(current)}>Ir al pasaje en el libro</button>
            <button className="btn" type="button" onClick={() => void completeCapsule(current)} disabled={Boolean(doneToday)}>
              {doneToday ? 'Hecha hoy' : 'Marcar como hecha'}
            </button>
            <button className="text-btn" type="button" onClick={() => setEditing(current)}>Editar</button>
            <button className="text-btn danger" type="button" onClick={() => void deleteCapsule(current).then(() => setIndex(0))}>Eliminar</button>
          </div>
        </article>
      ) : (
        <div className="empty">
          <h2>Aún no hay cápsulas</h2>
          <p>Genera una síntesis desde la ficha del libro o crea la primera a mano.</p>
        </div>
      )}
      {items.length > 0 && (
        <div className="dots" aria-hidden="true">
          {items.map((capsule, dot) => (
            <button key={capsule.id} className={dot === index ? 'on' : ''} type="button" onClick={() => setIndex(dot)} />
          ))}
        </div>
      )}
      <div className="row-actions center">
        <button className="btn secondary" type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>Anterior</button>
        <button className="btn secondary" type="button" onClick={() => setIndex((value) => Math.min(items.length - 1, value + 1))} disabled={index >= items.length - 1}>Siguiente</button>
      </div>
      {(editing || creating) && (
        <CapsuleForm
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={(draft) => {
            if (editing) void updateCapsule({ ...editing, ...draft });
            else void addCapsule(book.id, draft);
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CapsuleForm({
  initial,
  onClose,
  onSave,
}: {
  initial: Capsule | null;
  onClose: () => void;
  onSave: (draft: { title: string; idea: string; practice: string; quote?: string; chapterId?: string }) => void;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [idea, setIdea] = useState(initial?.idea || '');
  const [practice, setPractice] = useState(initial?.practice || '');
  const [quote, setQuote] = useState(initial?.quote || '');
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-label={initial ? 'Editar cápsula' : 'Nueva cápsula'}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || !idea.trim() || !practice.trim()) return;
          onSave({ title: title.trim(), idea: idea.trim(), practice: practice.trim(), quote: quote.trim() || undefined, chapterId: initial?.chapterId });
        }}
      >
        <h2>{initial ? 'Editar idea clave' : 'Nueva idea clave'}</h2>
        <label className="field">Título<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label className="field">Idea<textarea value={idea} onChange={(event) => setIdea(event.target.value)} required rows={4} /></label>
        <label className="field">En la práctica<textarea value={practice} onChange={(event) => setPractice(event.target.value)} required rows={3} /></label>
        <label className="field">Cita (opcional)<textarea value={quote} onChange={(event) => setQuote(event.target.value)} rows={2} /></label>
        <div className="row-actions">
          <button className="btn secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn" type="submit">Guardar</button>
        </div>
      </form>
    </div>
  );
}
