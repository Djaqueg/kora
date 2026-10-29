import { useEffect, useMemo, useState } from 'react';
import { useKora } from '../context';
import { gradeLabel, isDue, leitnerBox, type Grade } from '../lib/sm2';
import { navigate } from '../router';
import type { Flashcard } from '../types';

export function Review() {
  const { books, cards, quizzes, reviewCard, addCard, updateCard, deleteCard } = useKora();
  const [bookId, setBookId] = useState('all');
  const [mode, setMode] = useState<'cards' | 'quiz'>('cards');
  const [queue, setQueue] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [again, setAgain] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<'edit' | 'create' | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [newBook, setNewBook] = useState(books[0]?.id || '');
  const [quizIndex, setQuizIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const pool = useMemo(
    () => cards.filter((card) => bookId === 'all' || card.bookId === bookId),
    [cards, bookId],
  );
  const due = useMemo(() => pool.filter((card) => isDue(card)).sort((a, b) => a.due - b.due), [pool]);

  useEffect(() => {
    setQueue(due.map((card) => card.id));
    setReady(true);
    setFlipped(false);
  }, [bookId]); // restart when the shelf filter changes, not after every grade

  useEffect(() => {
    if (!ready) setQueue(due.map((card) => card.id));
  }, [ready, due]);

  const current = cards.find((card) => card.id === queue[0]);
  const quizPool = quizzes.filter((item) => bookId === 'all' || item.bookId === bookId);
  const question = quizPool[quizIndex];

  function grade(card: Flashcard, value: Grade) {
    void reviewCard(card, value);
    setFlipped(false);
    setQueue((list) => {
      const rest = list.slice(1);
      if (value === 'again') {
        const times = (again[card.id] || 0) + 1;
        setAgain((map) => ({ ...map, [card.id]: times }));
        if (times < 2) return [...rest, card.id];
      }
      return rest;
    });
  }

  return (
    <div className="page" data-testid="review-view">
      <header className="page-head">
        <div>
          <p className="eyebrow">Repaso espaciado</p>
          <h1>{mode === 'cards' ? 'Flashcards de hoy' : 'Mini-quiz'}</h1>
        </div>
        <div className="segmented" role="tablist">
          <button type="button" className={mode === 'cards' ? 'on' : ''} onClick={() => setMode('cards')}>Flashcards</button>
          <button type="button" className={mode === 'quiz' ? 'on' : ''} onClick={() => { setMode('quiz'); setQuizIndex(0); setPicked(null); setScore(0); setFinished(false); }}>Mini-quiz</button>
        </div>
      </header>
      <div className="row-actions">
        <label className="field inline">
          Libro
          <select value={bookId} onChange={(event) => setBookId(event.target.value)} aria-label="Filtrar por libro">
            <option value="all">Todos los libros</option>
            {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
          </select>
        </label>
        <button className="btn secondary" type="button" onClick={() => { setFront(''); setBack(''); setEditing('create'); }}>Nueva tarjeta</button>
      </div>

      {mode === 'cards' && (
        current ? (
          <div className="review-stack">
            <p className="muted">{queue.length} en esta sesión · Caja {leitnerBox(current.interval)}</p>
            <button className="study-card" type="button" onClick={() => setFlipped(true)} aria-label="Voltear tarjeta">
              <small>{books.find((book) => book.id === current.bookId)?.title}</small>
              <strong>{flipped ? current.back : current.front}</strong>
              {!flipped && <em>Toca para ver la respuesta</em>}
              {flipped && current.chapterId && (
                <span className="text-btn" onClick={(event) => { event.stopPropagation(); navigate(`/leer/${current.bookId}?c=${current.chapterId}&q=${encodeURIComponent(current.front.slice(0, 80))}`); }}>
                  Ir al pasaje en el libro
                </span>
              )}
            </button>
            {flipped && (
              <div className="grades">
                {(['again', 'hard', 'good', 'easy'] as const).map((value) => (
                  <button key={value} className={value} type="button" onClick={() => grade(current, value)}>
                    <span>{value === 'again' ? 'Otra vez' : value === 'hard' ? 'Difícil' : value === 'good' ? 'Bien' : 'Fácil'}</span>
                    <small>{gradeLabel(current, value)}</small>
                  </button>
                ))}
              </div>
            )}
            <div className="row-actions">
              <button className="text-btn" type="button" onClick={() => { setFront(current.front); setBack(current.back); setEditing('edit'); }}>Editar</button>
              <button className="text-btn danger" type="button" onClick={() => { void deleteCard(current); setQueue((list) => list.filter((item) => item !== current.id)); }}>Eliminar</button>
            </div>
          </div>
        ) : (
          <div className="empty">
            <h2>Nada pendiente en este filtro</h2>
            <p>Las tarjetas vuelven solas cuando toca. Puedes adelantar el mazo si quieres practicar igual.</p>
            <button className="btn" type="button" onClick={() => setQueue(pool.map((card) => card.id))} disabled={!pool.length}>Practicar todas</button>
          </div>
        )
      )}

      {mode === 'quiz' && (
        finished || !question ? (
          <div className="empty">
            <h2>{quizPool.length ? `Resultado: ${score} de ${quizPool.length}` : 'Este libro aún no tiene mini-quiz'}</h2>
            <p>Genera preguntas desde la ficha del libro o repasa las ideas clave.</p>
            {quizPool.length > 0 && (
              <button className="btn" type="button" onClick={() => { setQuizIndex(0); setScore(0); setPicked(null); setFinished(false); }}>Repetir</button>
            )}
          </div>
        ) : (
          <article className="quiz-card">
            <p className="eyebrow">Pregunta {quizIndex + 1} de {quizPool.length}</p>
            <h2>{question.question}</h2>
            <div className="quiz-options">
              {question.options.map((option, optionIndex) => {
                const state = picked === null ? '' : optionIndex === question.correctIndex ? 'good' : optionIndex === picked ? 'bad' : '';
                return (
                  <button key={option} className={state} type="button" disabled={picked !== null} onClick={() => {
                    setPicked(optionIndex);
                    if (optionIndex === question.correctIndex) setScore((value) => value + 1);
                  }}>
                    <span>{String.fromCharCode(65 + optionIndex)}</span>
                    {option}
                  </button>
                );
              })}
            </div>
            {picked !== null && <p className="practice">{question.explanation}</p>}
            {picked !== null && (
              <button className="btn" type="button" onClick={() => {
                if (quizIndex + 1 >= quizPool.length) setFinished(true);
                else {
                  setQuizIndex((value) => value + 1);
                  setPicked(null);
                }
              }}>Siguiente</button>
            )}
          </article>
        )
      )}

      {editing && (
        <div className="modal-back" onMouseDown={() => setEditing(null)}>
          <form
            className="modal"
            role="dialog"
            aria-label="Tarjeta"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (!front.trim() || !back.trim()) return;
              if (editing === 'edit' && current) void updateCard({ ...current, front: front.trim(), back: back.trim() });
              else if (newBook) void addCard(newBook, { front: front.trim(), back: back.trim() });
              setEditing(null);
              setFront('');
              setBack('');
            }}
          >
            <h2>{editing === 'edit' ? 'Editar tarjeta' : 'Nueva tarjeta'}</h2>
            {editing === 'create' && (
              <label className="field">Libro
                <select value={newBook} onChange={(event) => setNewBook(event.target.value)}>
                  {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
                </select>
              </label>
            )}
            <label className="field">Frente<textarea value={front} onChange={(event) => setFront(event.target.value)} required rows={3} /></label>
            <label className="field">Reverso<textarea value={back} onChange={(event) => setBack(event.target.value)} required rows={3} /></label>
            <div className="row-actions">
              <button className="btn secondary" type="button" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn" type="submit">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
