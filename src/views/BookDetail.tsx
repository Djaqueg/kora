import { useEffect, useState } from 'react';
import { GenerateDialog } from '../components/GenerateDialog';
import { useKora } from '../context';
import { navigate } from '../router';
import type { Chapter } from '../types';

export function BookDetail({ id }: { id: string }) {
  const { books, capsules, cards, highlights, quizzes, addCard, addCapsule, deleteHighlight, removeBook, toast } = useKora();
  const book = books.find((item) => item.id === id);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [generate, setGenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { loadChapters } = useKora();

  useEffect(() => {
    let alive = true;
    void loadChapters(id).then((list) => {
      if (alive) setChapters(list);
    });
    return () => {
      alive = false;
    };
  }, [id, loadChapters]);

  if (!book) {
    return (
      <div className="page">
        <h1>No encuentro ese libro</h1>
        <button className="btn" type="button" onClick={() => navigate('/')}>Volver a la biblioteca</button>
      </div>
    );
  }

  const bookCapsules = capsules.filter((item) => item.bookId === book.id);
  const bookCards = cards.filter((item) => item.bookId === book.id);
  const bookHighlights = highlights.filter((item) => item.bookId === book.id);
  const bookQuiz = quizzes.filter((item) => item.bookId === book.id);

  return (
    <div className="page">
      <button className="text-btn" type="button" onClick={() => navigate('/')}>← Biblioteca</button>
      <div className="detail">
        <img className="detail-cover" src={book.cover} alt="" />
        <div>
          <span className={`badge badge-${book.format.toLowerCase()}`}>{book.format}</span>
          <h1>{book.title}</h1>
          <p className="muted">{book.author}</p>
          <div className="bar big"><span style={{ width: `${Math.min(100, book.progress)}%` }} /></div>
          <p className="muted">{Math.round(book.progress)}% leído · {bookCapsules.length} cápsulas · {bookCards.length} tarjetas · {bookQuiz.length} preguntas</p>
          <div className="row-actions">
            <button className="btn" type="button" onClick={() => navigate(`/leer/${book.id}`)}>Leer</button>
            <button className="btn secondary" type="button" onClick={() => navigate(`/sintesis/${book.id}`)}>Síntesis 15 min</button>
            <button className="btn secondary" type="button" onClick={() => setGenerate(true)} disabled={!chapters.length}>Generar</button>
          </div>
        </div>
      </div>
      {book.summary && (
        <section className="prose-card">
          <h2>Resumen ejecutivo</h2>
          <p>{book.summary}</p>
        </section>
      )}
      <section className="prose-card">
        <h2>Subrayados</h2>
        {bookHighlights.length === 0 && <p className="muted">Todavía no hay subrayados. En el lector, selecciona una frase.</p>}
        <ul className="highlight-list">
          {bookHighlights.map((highlight) => {
            const chapter = chapters.find((item) => item.id === highlight.chapterId);
            return (
              <li key={highlight.id}>
                <span className={`swatch swatch-${highlight.color}`} aria-hidden="true" />
                <div>
                  <p>«{highlight.text}»</p>
                  {highlight.note && <p className="muted">{highlight.note}</p>}
                  <p className="muted">{chapter?.title || 'Capítulo'}</p>
                  <div className="row-actions">
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => {
                        void addCard(book.id, {
                          front: highlight.text,
                          back: highlight.note || 'Explícalo con tus palabras y vuelve al pasaje si hace falta.',
                          chapterId: highlight.chapterId,
                          highlightId: highlight.id,
                        }).then(() => toast('Flashcard creada desde el subrayado.'));
                      }}
                    >
                      Flashcard
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => {
                        void addCapsule(book.id, {
                          title: highlight.text.split(/\s+/).slice(0, 6).join(' '),
                          idea: highlight.text,
                          practice: highlight.note || 'Convierte esta frase en una acción concreta hoy.',
                          quote: highlight.text,
                          chapterId: highlight.chapterId,
                          highlightId: highlight.id,
                        });
                      }}
                    >
                      Idea clave
                    </button>
                    <button className="text-btn" type="button" onClick={() => navigate(`/leer/${book.id}?c=${highlight.chapterId}&q=${encodeURIComponent(highlight.text)}`)}>
                      Ir al pasaje
                    </button>
                    <button className="text-btn danger" type="button" onClick={() => void deleteHighlight(highlight)}>Quitar</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <button className="text-btn danger" type="button" onClick={() => setConfirmDelete(true)}>Eliminar libro de este dispositivo</button>
      {confirmDelete && (
        <div className="modal-back" onMouseDown={() => setConfirmDelete(false)}>
          <div className="modal" role="dialog" aria-label="Eliminar libro" onMouseDown={(event) => event.stopPropagation()}>
            <h2>¿Eliminar «{book.title}»?</h2>
            <p>Se borran capítulos, subrayados, cápsulas y tarjetas de este dispositivo. Un respaldo previo puede recuperarlos.</p>
            <div className="row-actions">
              <button className="btn secondary" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button className="btn danger" type="button" onClick={() => void removeBook(book.id).then(() => navigate('/'))}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
      {generate && <GenerateDialog book={book} chapters={chapters} onClose={() => setGenerate(false)} />}
    </div>
  );
}
