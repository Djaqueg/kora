import { useEffect, useMemo, useRef, useState } from 'react';
import { GenerateDialog } from '../components/GenerateDialog';
import { IconBack, IconHeadphones, IconSearch, IconSpark } from '../components/Icons';
import { useKora } from '../context';
import { getFile } from '../db';
import { blocksFromHtml, htmlToPlain, markSearch, scrollToQuote, selectionOffsets, wrapHighlights } from '../lib/html';
import { renderPdfPage } from '../lib/pdf';
import { navigate } from '../router';
import type { Chapter, Highlight, HighlightColor } from '../types';

const COLORS: { id: HighlightColor; label: string }[] = [
  { id: 'yellow', label: 'Amarillo' },
  { id: 'green', label: 'Verde' },
  { id: 'blue', label: 'Azul' },
  { id: 'rose', label: 'Rosa' },
];

export function Reader({ id, chapterId, quote }: { id: string; chapterId?: string; quote?: string }) {
  const kora = useKora();
  const book = kora.books.find((item) => item.id === id);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentId, setCurrentId] = useState(chapterId || '');
  const [toc, setToc] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const [searchOpen, setSearchOpen] = useState(Boolean(quote));
  const [search, setSearch] = useState('');
  const [generate, setGenerate] = useState(false);
  const [pdfNote, setPdfNote] = useState('');
  const [selection, setSelection] = useState<{ text: string; start: number; end: number; x: number; y: number; below: boolean } | null>(null);
  const [note, setNote] = useState<Highlight | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const quoteRef = useRef(quote || '');
  const selectRef = useRef<() => void>(() => undefined);
  const clickRef = useRef<(event: Event) => void>(() => undefined);
  const positionRef = useRef(book?.lastPosition);
  const toastRef = useRef(kora.toast);
  const recordRef = useRef(kora.recordMinutes);
  const saveTimer = useRef(0);
  positionRef.current = book?.lastPosition;
  toastRef.current = kora.toast;
  recordRef.current = kora.recordMinutes;
  const bootChapter = useRef(chapterId || book?.lastPosition?.chapterId || '');

  useEffect(() => {
    let alive = true;
    void kora.loadChapters(id).then((list) => {
      if (!alive) return;
      setChapters(list);
      setCurrentId((current) => current || bootChapter.current || list[0]?.id || '');
    });
    return () => {
      alive = false;
    };
  }, [id, kora.loadChapters]);

  const chapter = chapters.find((item) => item.id === currentId) || chapters[0];
  const chapterHighlights = kora.highlights.filter((item) => item.chapterId === chapter?.id);
  const hlSig = chapterHighlights.map((item) => `${item.id}:${item.start}:${item.end}:${item.color}`).join('|');

  useEffect(() => {
    const root = bodyRef.current;
    const scroller = scrollerRef.current;
    if (!root || !chapter) return;
    const previousChapter = root.dataset.chapter;
    const previousScroll = scroller?.scrollTop || 0;
    root.dataset.chapter = chapter.id;
    root.innerHTML = chapter.html;
    wrapHighlights(root, chapterHighlights.map((item) => ({ id: item.id, start: item.start, end: item.end, color: item.color })));
    if (search.trim().length >= 2) markSearch(root, search);
    const jumping = quoteRef.current;
    if (jumping) {
      const found = scrollToQuote(root, jumping);
      quoteRef.current = '';
      if (!found) toastRef.current('Abrí el capítulo, pero no encontré la cita exacta.');
      return;
    }
    if (previousChapter === chapter.id && scroller) {
      scroller.scrollTop = previousScroll;
      return;
    }
    const position = positionRef.current;
    if (scroller && position?.chapterId === chapter.id) {
      const max = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTop = position.scrollRatio * Math.max(max, 0);
    } else if (scroller) scroller.scrollTop = 0;
  }, [chapter, hlSig, search]);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const onUp = () => selectRef.current();
    const onClick = (event: Event) => clickRef.current(event);
    root.addEventListener('mouseup', onUp);
    root.addEventListener('touchend', onUp);
    root.addEventListener('click', onClick);
    return () => {
      root.removeEventListener('mouseup', onUp);
      root.removeEventListener('touchend', onUp);
      root.removeEventListener('click', onClick);
    };
  }, [chapter?.id]);

  selectRef.current = () => {
    const root = bodyRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.isCollapsed || !sel.rangeCount) {
      return;
    }
    const range = sel.getRangeAt(0);
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2 || !root.contains(range.startContainer)) return;
    const offsets = selectionOffsets(root, range);
    if (!offsets || offsets.end - offsets.start < 2) return;
    const rect = range.getBoundingClientRect();
    const below = rect.top < 168;
    setNote(null);
    setSelection({
      text,
      start: offsets.start,
      end: offsets.end,
      x: Math.min(window.innerWidth - 24, Math.max(24, rect.left + rect.width / 2)),
      y: below ? rect.bottom : rect.top,
      below,
    });
  };

  clickRef.current = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const mark = target?.closest?.('mark.hl');
    if (!mark) return;
    const highlight = kora.highlights.find((item) => item.id === mark.getAttribute('data-hl-id'));
    if (!highlight) return;
    setSelection(null);
    setNote(highlight);
    setNoteDraft(highlight.note);
  };

  useEffect(() => {
    if (!book || book.format !== 'PDF' || !chapter || !canvasRef.current) {
      setPdfNote('');
      return;
    }
    let cancel = false;
    setPdfNote('Cargando página…');
    void getFile(book.id).then(async (file) => {
      if (cancel || !canvasRef.current) return;
      if (!file) {
        setPdfNote('La vista de página no está en este dispositivo. El texto extraído sí se puede leer, subrayar y escuchar.');
        return;
      }
      const data = await file.blob.arrayBuffer();
      if (cancel || !canvasRef.current) return;
      await renderPdfPage(book.id, data, chapter.index + 1, canvasRef.current);
      if (!cancel) setPdfNote('');
    }).catch(() => {
      if (!cancel) setPdfNote('No se pudo dibujar la página. El texto sigue disponible debajo.');
    });
    return () => {
      cancel = true;
    };
  }, [book, chapter]);

  useEffect(() => {
    let acc = 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      acc += 0.25;
      if (acc >= 0.5) {
        const chunk = acc;
        acc = 0;
        void recordRef.current(chunk);
      }
    }, 15000);
    return () => {
      window.clearInterval(timer);
      if (acc > 0) void recordRef.current(acc);
    };
  }, [id]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || !chapter || !book) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      const ratio = max <= 0 ? 1 : scroller.scrollTop / max;
      const at = chapters.findIndex((item) => item.id === chapter.id);
      const progress = chapters.length ? Math.round(((at + Math.min(1, Math.max(0, ratio))) / chapters.length) * 100) : 0;
      void kora.saveProgress(book.id, { chapterId: chapter.id, scrollRatio: ratio }, progress);
    }, 400);
  }

  async function paint(color: HighlightColor) {
    if (!selection || !chapter || !book) return;
    const highlight = await kora.addHighlight({
      bookId: book.id,
      chapterId: chapter.id,
      text: selection.text,
      note: '',
      color,
      start: selection.start,
      end: selection.end,
    });
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    kora.toast('Subrayado guardado.');
    return highlight;
  }

  async function toCard() {
    const highlight = await paint('yellow');
    if (!highlight || !book) return;
    await kora.addCard(book.id, {
      front: highlight.text,
      back: 'Explícalo con tus palabras y vuelve al pasaje si lo necesitas.',
      chapterId: highlight.chapterId,
      highlightId: highlight.id,
    });
    kora.toast('Flashcard creada.');
  }

  async function toCapsule() {
    const highlight = await paint('green');
    if (!highlight || !book) return;
    await kora.addCapsule(book.id, {
      title: highlight.text.split(/\s+/).slice(0, 6).join(' '),
      idea: highlight.text,
      practice: 'Convierte esta frase en una acción concreta hoy.',
      quote: highlight.text,
      chapterId: highlight.chapterId,
      highlightId: highlight.id,
    });
  }

  function listen(scope: 'chapter' | 'book') {
    if (!chapter) return;
    const source = scope === 'book' ? chapters : [chapter];
    const items = source.flatMap((item) => blocksFromHtml(item.html).map((text, index, all) => ({
      text,
      label: `${item.title} · ${index + 1}/${all.length}`,
      chapterId: item.id,
    })));
    const start = scope === 'book' ? items.findIndex((item) => item.chapterId === chapter.id) : 0;
    kora.tts.play(items, Math.max(0, start));
  }

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) return [];
    return chapters.flatMap((item) => {
      const plain = htmlToPlain(item.html);
      const at = plain.toLowerCase().indexOf(query);
      if (at < 0) return [];
      const snippet = plain.slice(Math.max(0, at - 40), at + query.length + 70).trim();
      return [{ id: item.id, title: item.title, snippet }];
    });
  }, [chapters, search]);

  if (!book || !chapter) {
    return <div className="page"><p>Cargando libro…</p></div>;
  }

  const index = chapters.findIndex((item) => item.id === chapter.id);

  return (
    <section className={`reader theme-${kora.settings.theme}`} data-testid="reader">
      <header className="reader-top">
        <button className="icon-btn" type="button" onClick={() => navigate(`/libro/${book.id}`)} aria-label="Volver al libro">
          <IconBack />
        </button>
        <div className="reader-title">
          <strong>{book.title}</strong>
          <span>{Math.round(book.progress)}%</span>
        </div>
        <button className="icon-btn" type="button" onClick={() => { setToc((value) => !value); setSearchOpen(false); setAppearance(false); }} aria-label="Capítulos">☰</button>
        <button className="icon-btn" type="button" onClick={() => { setSearchOpen((value) => !value); setToc(false); }} aria-label="Buscar en el libro"><IconSearch /></button>
        <button className="icon-btn" type="button" onClick={() => { setAppearance((value) => !value); setToc(false); }} aria-label="Apariencia">Aa</button>
        <button className="icon-btn" type="button" onClick={() => listen('chapter')} aria-label="Escuchar capítulo"><IconHeadphones /></button>
        <button className="icon-btn" type="button" onClick={() => setGenerate(true)} aria-label="Generar síntesis"><IconSpark /></button>
      </header>
      <div className="reader-progress" aria-hidden="true"><span style={{ width: `${book.progress}%` }} /></div>
      {toc && (
        <div className="reader-panel">
          {chapters.map((item) => (
            <button key={item.id} className={item.id === chapter.id ? 'current' : ''} type="button" onClick={() => { setCurrentId(item.id); setToc(false); quoteRef.current = ''; }}>
              {item.index + 1}. {item.title}
            </button>
          ))}
        </div>
      )}
      {searchOpen && (
        <div className="reader-panel">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en el libro" aria-label="Buscar en el libro" />
          <ul className="search-results">
            {results.map((result) => (
              <li key={result.id}>
                <button type="button" onClick={() => { quoteRef.current = search; setCurrentId(result.id); setSearchOpen(false); }}>
                  <strong>{result.title}</strong>
                  <span>{result.snippet}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {appearance && (
        <div className="reader-panel appearance">
          <label className="field">Fuente
            <select value={kora.settings.fontFamily} onChange={(event) => void kora.updateSettings({ fontFamily: event.target.value as typeof kora.settings.fontFamily })}>
              <option value="literata">Literata</option>
              <option value="outfit">Outfit</option>
              <option value="serif">Serif del sistema</option>
            </select>
          </label>
          <label className="field">Tamaño {kora.settings.fontSize}px
            <input type="range" min={16} max={28} value={kora.settings.fontSize} onChange={(event) => void kora.updateSettings({ fontSize: Number(event.target.value) })} />
          </label>
          <label className="field">Interlineado {kora.settings.lineHeight.toFixed(2)}
            <input type="range" min={1.4} max={2} step={0.05} value={kora.settings.lineHeight} onChange={(event) => void kora.updateSettings({ lineHeight: Number(event.target.value) })} />
          </label>
          <div className="theme-picks">
            {(['claro', 'sepia', 'oscuro'] as const).map((theme) => (
              <button key={theme} className={kora.settings.theme === theme ? 'on' : ''} type="button" onClick={() => void kora.updateSettings({ theme })}>
                {theme === 'claro' ? 'Claro' : theme === 'sepia' ? 'Sepia' : 'Oscuro'}
              </button>
            ))}
          </div>
          <button className="btn secondary" type="button" onClick={() => listen('book')}>Escuchar el libro completo</button>
        </div>
      )}
      <div className="reader-scroll" ref={scrollerRef} onScroll={onScroll}>
        {book.format === 'PDF' && (
          <div className="pdf-stage">
            <canvas ref={canvasRef} />
            {pdfNote && <p className="muted">{pdfNote}</p>}
          </div>
        )}
        <p className="eyebrow">Capítulo {index + 1} de {chapters.length}</p>
        <h1>{chapter.title}</h1>
        <article
          ref={bodyRef}
          className="reader-body"
          data-testid="reader-body"
          data-font={kora.settings.fontFamily}
          style={{ fontSize: `${kora.settings.fontSize}px`, lineHeight: kora.settings.lineHeight }}
        />
        <div className="chapter-nav">
          <button className="btn secondary" type="button" disabled={index <= 0} onClick={() => { quoteRef.current = ''; setCurrentId(chapters[index - 1].id); }}>Capítulo anterior</button>
          <button className="btn secondary" type="button" disabled={index >= chapters.length - 1} onClick={() => { quoteRef.current = ''; setCurrentId(chapters[index + 1].id); }}>Capítulo siguiente</button>
        </div>
      </div>
      {selection && (
        <div className={`sel-pop${selection.below ? ' below' : ''}`} data-testid="selection-toolbar" style={{ left: selection.x, top: selection.y }} onMouseDown={(event) => event.preventDefault()}>
          {COLORS.map((color) => (
            <button key={color.id} className={`dot dot-${color.id}`} type="button" aria-label={color.label} onClick={() => void paint(color.id)} />
          ))}
          <button type="button" onClick={() => void paint('yellow').then((highlight) => { if (!highlight) return; setNote(highlight); setNoteDraft(''); })}>Nota</button>
          <button type="button" onClick={() => void toCard()}>Flashcard</button>
          <button type="button" onClick={() => void toCapsule()}>Idea clave</button>
        </div>
      )}
      {note && (
        <div className="modal-back" onMouseDown={() => setNote(null)}>
          <div className="modal" role="dialog" aria-label="Nota del subrayado" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Subrayado</h2>
            <blockquote>«{note.text}»</blockquote>
            <div className="theme-picks">
              {COLORS.map((color) => (
                <button key={color.id} className={note.color === color.id ? 'on' : ''} type="button" onClick={() => {
                  const next = { ...note, color: color.id };
                  setNote(next);
                  void kora.updateHighlight(next);
                }}>{color.label}</button>
              ))}
            </div>
            <label className="field">Nota
              <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={4} />
            </label>
            <div className="row-actions">
              <button className="btn" type="button" onClick={() => { const next = { ...note, note: noteDraft }; void kora.updateHighlight(next); setNote(null); }}>Guardar nota</button>
              <button className="btn secondary" type="button" onClick={() => void kora.addCard(book.id, { front: note.text, back: noteDraft || 'Repasa este pasaje.', chapterId: note.chapterId, highlightId: note.id }).then(() => kora.toast('Flashcard creada.'))}>Flashcard</button>
              <button className="text-btn danger" type="button" onClick={() => void kora.deleteHighlight(note).then(() => setNote(null))}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
      {generate && <GenerateDialog book={book} chapters={chapters} initialChapterId={chapter.id} onClose={() => setGenerate(false)} />}
    </section>
  );
}
