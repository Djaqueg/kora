import { useRef } from 'react';
import { useKora } from '../context';
import { formatMinutes, greeting, viewStreak } from '../lib/dates';
import { isDue } from '../lib/sm2';
import { navigate } from '../router';

export function Library() {
  const { books, capsules, cards, streak, importFiles, installEvent, promptInstall } = useKora();
  const inputRef = useRef<HTMLInputElement>(null);
  const goal = viewStreak(streak);
  const due = cards.filter((card) => isDue(card)).length;
  const minutePct = Math.min(100, goal.goalMinutes ? (goal.minutesToday / goal.goalMinutes) * 100 : 0);

  return (
    <div className="page" data-testid="library">
      <header className="page-head library-head">
        <span className="avatar-btn" aria-hidden="true" />
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1>¿Qué quieres recordar hoy?</h1>
        </div>
        <div className="row-actions">
          <button className="btn" type="button" onClick={() => inputRef.current?.click()}>Importar archivo</button>
          <button className="btn secondary" type="button" onClick={() => navigate('/ajustes?seccion=sync')}>Desde Google Drive</button>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".epub,.pdf,.txt,.md,.markdown,application/epub+zip,application/pdf,text/plain,text/markdown"
            multiple
            aria-label="Importar libros"
            onChange={(event) => {
              const list = event.target.files ? [...event.target.files] : [];
              if (list.length) void importFiles(list);
              event.target.value = '';
            }}
          />
        </div>
      </header>

      <section className="streak" data-testid="streak-widget" aria-label="Meta de hoy">
        <div>
          <p className="streak-kicker">Hoy</p>
          <p className="streak-count">{goal.current === 0 ? 'Sin racha todavía' : goal.current === 1 ? '1 día de racha' : `${goal.current} días de racha`}</p>
          <p className="streak-copy">
            Cumples la meta con {goal.goalMinutes} min de lectura o {goal.goalCapsules} cápsula.
            {goal.met ? ' Meta de hoy cumplida.' : ''}
          </p>
          <div className="streak-stats">
            <span>{goal.capsulesToday} cápsula{goal.capsulesToday === 1 ? '' : 's'} hoy</span>
            <span>{due} tarjeta{due === 1 ? '' : 's'} para hoy</span>
          </div>
        </div>
        <div className="ring-wrap">
          <div className="ring" style={{ background: `conic-gradient(#9BB8C5 ${minutePct}%, #E4EEF2 0)` }}>
            <div className="ring-inner">
              <strong>{formatMinutes(goal.minutesToday)}</strong>
              <small>de {goal.goalMinutes} min</small>
            </div>
          </div>
        </div>
      </section>

      {installEvent && (
        <button className="install-banner" type="button" onClick={() => void promptInstall()}>
          Instalar Kora en este dispositivo
        </button>
      )}

      <div
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const list = [...event.dataTransfer.files];
          if (list.length) void importFiles(list);
        }}
      >
        <p>También puedes soltar aquí un EPUB, PDF, TXT o MD.</p>
      </div>

      {books.length === 0 ? (
        <div className="empty">
          <h2>Tu estantería está vacía</h2>
          <p>Importa un libro o restaura los tres de ejemplo desde Ajustes.</p>
        </div>
      ) : (
        <div className="book-grid">
          {books.map((book) => {
            const capsuleCount = capsules.filter((item) => item.bookId === book.id).length;
            const cardCount = cards.filter((item) => item.bookId === book.id).length;
            return (
              <button key={book.id} className="book-card" type="button" onClick={() => navigate(`/libro/${book.id}`)}>
                <img src={book.cover} alt="" />
                <span>
                  <span className="card-topline">
                    <span className={`badge badge-${book.format.toLowerCase()}`}>{book.format}</span>
                    <span className="muted">{Math.round(book.progress)}%</span>
                  </span>
                  <strong className="book-title">{book.title}</strong>
                  <span className="muted">Por: {book.author}</span>
                  <span className="bar" aria-hidden="true"><span style={{ width: `${Math.min(100, book.progress)}%` }} /></span>
                  <span className="card-meta">{capsuleCount} cápsulas · {cardCount} tarjetas</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
