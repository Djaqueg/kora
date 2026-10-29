import { useEffect, useState } from 'react';
import { GenerateDialog } from '../components/GenerateDialog';
import { IconBookOpen, IconDownload, IconHeart, IconSliders, IconStar } from '../components/Icons';
import { useKora } from '../context';
import { getFile } from '../db';
import { navigate } from '../router';
import type { Chapter } from '../types';

export function BookDetail({ id }: { id: string }) {
  const kora = useKora();
  const { books, capsules, cards, highlights, quizzes, addCard, addCapsule, deleteHighlight, removeBook, toast, patchBook, loadChapters } = kora;
  const book = books.find((item) => item.id === id);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [generate, setGenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menu, setMenu] = useState(false);

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
  const rating = book.rating ?? 0;
  const synopsis = (book.summary || 'Abre el lector para recorrer los capítulos, subrayar y convertir las frases en cápsulas de quince minutos.').trim();

  async function download() {
    const file = await getFile(book!.id);
    if (!file) {
      toast('Este libro ya está en el dispositivo, listo para leer sin conexión.');
      return;
    }
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || book!.fileName || `${book!.title}.${book!.format.toLowerCase()}`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Copia guardada en tus descargas.');
  }

  return (
    <div className="page book-stage">
      <article className="book-sheet" data-testid="book-sheet">
        <header className="sheet-top">
          <button className="avatar-btn" type="button" onClick={() => navigate('/')} aria-label="Biblioteca" />
          <button className="icon-plain" type="button" aria-label="Filtros y opciones" aria-expanded={menu} onClick={() => setMenu((open) => !open)}>
            <IconSliders />
          </button>
          {menu && (
            <div className="menu-pop" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenu(false); navigate('/ajustes?seccion=sync'); }}>Sincronizar con Drive</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setGenerate(true); }} disabled={!chapters.length}>Crear síntesis</button>
              <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(false); setConfirmDelete(true); }}>Eliminar libro</button>
            </div>
          )}
        </header>
        <div className="cover-frame">
          <img className="detail-cover" src={book.cover} alt="" />
        </div>
        <div className="stars" role="radiogroup" aria-label={`Valoración: ${rating} de 5`}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
              className={value <= rating ? 'on' : ''}
              onClick={() => void patchBook(book.id, { rating: value })}
            >
              <IconStar filled={value <= rating} />
            </button>
          ))}
        </div>
        <div className="book-main">
          <div>
            <h1>{book.title}</h1>
            <p className="byline">Por: {book.author}</p>
            <p className="synopsis">{synopsis}</p>
          </div>
          <div className="side-actions">
            <button type="button" aria-label="Guardar sin conexión" onClick={() => void download()}>
              <IconDownload />
            </button>
            <button type="button" aria-label="Leer" onClick={() => navigate(`/leer/${book.id}`)}>
              <IconBookOpen />
            </button>
            <button
              type="button"
              aria-label={book.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              aria-pressed={Boolean(book.favorite)}
              className={book.favorite ? 'on' : ''}
              onClick={() => void patchBook(book.id, { favorite: !book.favorite })}
            >
              <IconHeart filled={Boolean(book.favorite)} />
            </button>
          </div>
        </div>
        <button className="synth-link" type="button" onClick={() => navigate(`/sintesis/${book.id}`)}>Síntesis 15 min</button>
      </article>

      {book.summary && (
        <section className="prose-card">
          <h2>Resumen ejecutivo</h2>
          <p>{book.summary}</p>
        </section>
      )}
      <section className="prose-card">
        <div className="card-topline">
          <h2>Subrayados</h2>
          <span className={`badge badge-${book.format.toLowerCase()}`}>{book.format}</span>
        </div>
        <div className="bar big"><span style={{ width: `${Math.min(100, book.progress)}%` }} /></div>
        <p className="muted">{Math.round(book.progress)}% leído · {bookCapsules.length} cápsulas · {bookCards.length} tarjetas · {bookQuiz.length} preguntas</p>
        <div className="row-actions">
          <button className="btn" type="button" onClick={() => setGenerate(true)} disabled={!chapters.length}>Generar</button>
        </div>
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
