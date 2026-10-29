import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { GenerateDialog } from '../components/GenerateDialog';
import { IconBack, IconBluetooth, IconBookmark, IconHeadphones, IconMoon, IconSun } from '../components/Icons';
import { BrightnessSlider, ScrollSwitch, TextSizePicker } from '../components/TypeControls';
import { useKora } from '../context';
import { getFile } from '../db';
import { blocksFromHtml, htmlToPlain, markSearch, scrollToQuote, selectionOffsets, wrapHighlights } from '../lib/html';
import { renderPdfPage } from '../lib/pdf';
import { navigate } from '../router';
import type { Chapter, Highlight, HighlightColor, ReaderTheme } from '../types';

const COLORS: { id: HighlightColor; label: string }[] = [
  { id: 'yellow', label: 'Amarillo' },
  { id: 'green', label: 'Verde' },
  { id: 'blue', label: 'Azul' },
  { id: 'rose', label: 'Rosa' },
];

function applyDropCap(root: HTMLElement) {
  const paragraph = root.querySelector('p');
  if (!paragraph) return;
  paragraph.classList.add('drop-cap');
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  let node: Text | null = null;
  while (walker.nextNode()) {
    const current = walker.currentNode as Text;
    if (current.data.trim()) {
      node = current;
      break;
    }
  }
  if (!node || node.parentElement?.classList.contains('drop')) return;
  const index = node.data.search(/\p{L}/u);
  if (index < 0) return;
  const letter = node.data.slice(index, index + 1);
  const before = node.data.slice(0, index);
  const after = node.data.slice(index + 1);
  const span = document.createElement('span');
  span.className = 'drop';
  span.textContent = letter;
  const fragment = document.createDocumentFragment();
  if (before) fragment.append(before);
  fragment.append(span);
  if (after) fragment.append(after);
  node.replaceWith(fragment);
}

function mix(from: string, to: string, t: number): string {
  const parse = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const a = parse(from);
  const b = parse(to);
  const amount = Math.min(1, Math.max(0, t));
  const channel = a.map((value, index) => Math.round(value + (b[index] - value) * amount));
  return `rgb(${channel[0]}, ${channel[1]}, ${channel[2]})`;
}

export function paperColor(theme: ReaderTheme, brightness: number): string {
  const t = Math.min(100, Math.max(0, brightness)) / 100;
  if (theme === 'oscuro') return mix('#10161b', '#31414b', t);
  if (theme === 'sepia') return mix('#e7d4b8', '#fbf6ee', t);
  return mix('#f1e2d4', '#ffffff', t);
}

export function Reader({ id, chapterId, quote }: { id: string; chapterId?: string; quote?: string }) {
  const kora = useKora();
  const book = kora.books.find((item) => item.id === id);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentId, setCurrentId] = useState(chapterId || '');
  const [sheet, setSheet] = useState(false);
  const [sheetPanel, setSheetPanel] = useState<'main' | 'marks' | 'quick'>('main');
  const [search, setSearch] = useState('');
  const [generate, setGenerate] = useState(false);
  const [pdfNote, setPdfNote] = useState('');
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
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
  const pageRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const scrollModeRef = useRef(kora.settings.scrollMode);
  const goPageRef = useRef<(next: number) => void>(() => undefined);
  positionRef.current = book?.lastPosition;
  toastRef.current = kora.toast;
  recordRef.current = kora.recordMinutes;
  pageRef.current = page;
  scrollModeRef.current = kora.settings.scrollMode;
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

  function readPager() {
    const scroller = scrollerRef.current;
    if (!scroller) return { page: 0, count: 1, height: 1 };
    const height = Math.max(scroller.clientHeight, 1);
    const count = Math.max(1, Math.ceil((scroller.scrollHeight - 4) / height));
    const current = Math.min(count - 1, Math.floor((scroller.scrollTop + 1) / height));
    return { page: current, count, height };
  }

  function publishPager() {
    const metrics = readPager();
    setPage(metrics.page);
    setPageCount(metrics.count);
    return metrics;
  }

  useEffect(() => {
    const root = bodyRef.current;
    const scroller = scrollerRef.current;
    if (!root || !chapter) return;
    const previousChapter = root.dataset.chapter;
    const previousScroll = scroller?.scrollTop || 0;
    root.dataset.chapter = chapter.id;
    root.innerHTML = chapter.html;
    wrapHighlights(root, chapterHighlights.map((item) => ({ id: item.id, start: item.start, end: item.end, color: item.color })));
    applyDropCap(root);
    if (search.trim().length >= 2) markSearch(root, search);
    const jumping = quoteRef.current;
    if (jumping) {
      const found = scrollToQuote(root, jumping, scrollModeRef.current === 'page' ? 'auto' : 'smooth');
      quoteRef.current = '';
      if (!found) toastRef.current('Abrí el capítulo, pero no encontré la cita exacta.');
      requestAnimationFrame(() => {
        const live = scrollerRef.current;
        const target = root.querySelector('.flash-target');
        if (scrollModeRef.current === 'page' && live && target) {
          const top = target.getBoundingClientRect().top - live.getBoundingClientRect().top + live.scrollTop;
          const height = Math.max(live.clientHeight, 1);
          const next = Math.max(0, Math.floor(top / height));
          live.scrollTop = next * height;
        }
        publishPager();
      });
      return;
    }
    if (previousChapter === chapter.id && scroller) {
      scroller.scrollTop = previousScroll;
      requestAnimationFrame(publishPager);
      return;
    }
    const position = positionRef.current;
    if (scroller && position?.chapterId === chapter.id) {
      const max = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTop = position.scrollRatio * Math.max(max, 0);
    } else if (scroller) scroller.scrollTop = 0;
    requestAnimationFrame(() => {
      if (scrollModeRef.current === 'page') {
        const metrics = readPager();
        if (scroller) scroller.scrollTop = metrics.page * metrics.height;
      }
      publishPager();
    });
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

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || kora.settings.scrollMode !== 'page') return;
    let locked = false;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (locked || Math.abs(event.deltaY) < 6) return;
      locked = true;
      goPageRef.current(pageRef.current + (event.deltaY > 0 ? 1 : -1));
      window.setTimeout(() => {
        locked = false;
      }, 420);
    };
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, [kora.settings.scrollMode, chapter?.id]);

  useEffect(() => {
    if (kora.settings.scrollMode !== 'page') {
      publishPager();
      return;
    }
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const height = Math.max(scroller.clientHeight, 1);
    const count = Math.max(1, Math.ceil((scroller.scrollHeight - 4) / height));
    const current = Math.min(count - 1, Math.round(scroller.scrollTop / height));
    scroller.scrollTop = current * height;
    setPage(current);
    setPageCount(count);
  }, [kora.settings.scrollMode, kora.settings.fontSize, kora.settings.lineHeight, kora.settings.fontFamily, chapter?.id]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

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
    publishPager();
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      const ratio = max <= 0 ? 1 : scroller.scrollTop / max;
      const at = chapters.findIndex((item) => item.id === chapter.id);
      const progress = chapters.length ? Math.round(((at + Math.min(1, Math.max(0, ratio))) / chapters.length) * 100) : 0;
      void kora.saveProgress(book.id, { chapterId: chapter.id, scrollRatio: ratio }, progress);
    }, 400);
  }

  function goPage(next: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const height = Math.max(scroller.clientHeight, 1);
    const count = Math.max(1, Math.ceil((scroller.scrollHeight - 4) / height));
    const target = Math.max(0, Math.min(count - 1, next));
    scroller.scrollTo({ top: target * height, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setPage(target);
    setPageCount(count);
  }
  goPageRef.current = goPage;

  function openSheet(panel: 'main' | 'marks' | 'quick' = 'main') {
    setSheetPanel(panel);
    setSheet(true);
  }

  function onReaderClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, mark.hl')) return;
    const liveSelection = window.getSelection();
    if (liveSelection && !liveSelection.isCollapsed && liveSelection.toString().trim()) return;
    if (kora.settings.scrollMode === 'page') {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < rect.width * 0.16) {
        goPage(pageRef.current - 1);
        return;
      }
      if (x > rect.width * 0.84) {
        goPage(pageRef.current + 1);
        return;
      }
    }
    setSheetPanel('main');
    setSheet((open) => !open);
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
    setSheet(false);
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

  const bookCapsules = kora.capsules.filter((item) => item.bookId === book?.id && (!chapter || item.chapterId === chapter.id || !item.chapterId));

  if (!book || !chapter) {
    return <div className="page"><p>Cargando libro…</p></div>;
  }

  const index = chapters.findIndex((item) => item.id === chapter.id);
  const paper = paperColor(kora.settings.theme, kora.settings.brightness);
  const ink = kora.settings.theme === 'oscuro' ? '#e7eef2' : kora.settings.theme === 'sepia' ? '#3a3128' : '#1c242b';

  return (
    <section className={`reader theme-${kora.settings.theme}`} data-testid="reader" style={{ background: paper, color: ink }}>
      <header className="reader-kicker">
        <button className="reader-back" type="button" onClick={() => navigate(`/libro/${book.id}`)} aria-label="Volver al libro">
          <IconBack />
        </button>
        <h1>
          <button className="kicker-btn" type="button" onClick={() => openSheet('main')}>
            Capítulo {index + 1}
          </button>
        </h1>
      </header>
      <div
        className={`reader-scroll mode-${kora.settings.scrollMode === 'page' ? 'page' : 'scroll'}`}
        data-testid="reader-scroll"
        ref={scrollerRef}
        onScroll={onScroll}
        onClick={onReaderClick}
        onTouchStart={(event) => {
          const point = event.changedTouches[0];
          touchRef.current = { x: point.clientX, y: point.clientY };
        }}
        onTouchEnd={(event) => {
          if (kora.settings.scrollMode !== 'page' || !touchRef.current) return;
          const point = event.changedTouches[0];
          const dy = point.clientY - touchRef.current.y;
          const dx = point.clientX - touchRef.current.x;
          touchRef.current = null;
          if (Math.abs(dy) < 56 || Math.abs(dy) < Math.abs(dx)) return;
          if (window.getSelection()?.toString().trim()) return;
          goPage(pageRef.current + (dy < 0 ? 1 : -1));
        }}
      >
        {book.format === 'PDF' && (
          <div className="pdf-stage">
            <canvas ref={canvasRef} />
            {pdfNote && <p className="muted">{pdfNote}</p>}
          </div>
        )}
        <p className="sr-only">{chapter.title}</p>
        <article
          ref={bodyRef}
          className="reader-body"
          data-testid="reader-body"
          data-font={kora.settings.fontFamily}
          style={{ fontSize: `${kora.settings.fontSize}px`, lineHeight: kora.settings.lineHeight }}
        />
        <div className="chapter-nav">
          <button className="text-btn" type="button" disabled={index <= 0} onClick={() => { quoteRef.current = ''; setCurrentId(chapters[index - 1].id); }}>Capítulo anterior</button>
          <button className="text-btn" type="button" disabled={index >= chapters.length - 1} onClick={() => { quoteRef.current = ''; setCurrentId(chapters[index + 1].id); }}>Capítulo siguiente</button>
        </div>
      </div>
      <p className="page-label" data-testid="page-label" data-pages={pageCount}>Página {page + 1}</p>
      {sheet && (
        <div className="sheet-overlay" data-testid="reader-overlay" onMouseDown={() => setSheet(false)}>
          <div
            className="reader-sheet"
            data-testid="reader-sheet"
            role="dialog"
            aria-label="Controles de lectura"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drag-handle" />
            <div className="sheet-icons">
              <button className={kora.tts.active ? 'on' : ''} type="button" aria-label="Escuchar capítulo" aria-pressed={kora.tts.active} onClick={() => listen('chapter')}>
                <IconHeadphones />
              </button>
              <button
                className={kora.settings.theme === 'oscuro' ? 'on' : ''}
                type="button"
                aria-label="Modo noche"
                aria-pressed={kora.settings.theme === 'oscuro'}
                onClick={() => void kora.updateSettings({ theme: kora.settings.theme === 'oscuro' ? 'claro' : 'oscuro' })}
              >
                <IconMoon />
              </button>
              <button className={sheetPanel === 'marks' ? 'on' : ''} type="button" aria-label="Subrayados y cápsulas" aria-pressed={sheetPanel === 'marks'} onClick={() => setSheetPanel((panel) => panel === 'marks' ? 'main' : 'marks')}>
                <IconBookmark />
              </button>
              <button className={sheetPanel === 'quick' ? 'on' : ''} type="button" aria-label="Acciones rápidas" aria-pressed={sheetPanel === 'quick'} onClick={() => setSheetPanel((panel) => panel === 'quick' ? 'main' : 'quick')}>
                <IconBluetooth />
              </button>
            </div>
            {sheetPanel === 'main' && (
              <>
                <label className="sheet-field">
                  <span>Capítulos</span>
                  <select
                    className="chapter-select"
                    aria-label="Capítulos"
                    value={chapter.id}
                    onChange={(event) => {
                      quoteRef.current = '';
                      setCurrentId(event.target.value);
                    }}
                  >
                    {chapters.map((item) => (
                      <option key={item.id} value={item.id}>{item.index + 1}&nbsp;&nbsp;{item.title}</option>
                    ))}
                  </select>
                </label>
                <div className="sheet-split">
                  <div>
                    <p className="sheet-label">Tamaño de texto</p>
                    <TextSizePicker value={kora.settings.fontSize} onChange={(fontSize) => void kora.updateSettings({ fontSize })} />
                  </div>
                  <div className="sheet-scroll">
                    <p className="sheet-label">Desplazamiento</p>
                    <ScrollSwitch value={kora.settings.scrollMode} onChange={(scrollMode) => void kora.updateSettings({ scrollMode })} />
                  </div>
                </div>
                <div className="bright-row">
                  <IconSun />
                  <BrightnessSlider value={kora.settings.brightness} onChange={(brightness) => void kora.updateSettings({ brightness })} />
                  <IconMoon />
                </div>
              </>
            )}
            {sheetPanel === 'marks' && (
              <div className="sheet-panel">
                <p className="sheet-label">Subrayados y cápsulas</p>
                {chapterHighlights.length === 0 && bookCapsules.length === 0 && <p className="muted">Todavía no hay marcas en este capítulo.</p>}
                <ul className="search-results">
                  {chapterHighlights.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => { quoteRef.current = item.text; setCurrentId(item.chapterId); setSheet(false); }}>
                        <strong>{item.text}</strong>
                        {item.note && <span>{item.note}</span>}
                      </button>
                    </li>
                  ))}
                  {bookCapsules.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => navigate(`/sintesis/${book.id}`)}>
                        <strong>{item.title}</strong>
                        <span>Cápsula de 15 min</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sheetPanel === 'quick' && (
              <div className="sheet-panel">
                <p className="sheet-label">Buscar, síntesis y audio</p>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en el libro" aria-label="Buscar en el libro" />
                <ul className="search-results">
                  {results.map((result) => (
                    <li key={result.id}>
                      <button type="button" onClick={() => { quoteRef.current = search; setCurrentId(result.id); setSheet(false); }}>
                        <strong>{result.title}</strong>
                        <span>{result.snippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="row-actions">
                  <button className="btn secondary" type="button" onClick={() => listen('book')}>Escuchar el libro completo</button>
                  <button className="btn" type="button" onClick={() => { setSheet(false); setGenerate(true); }}>Generar síntesis</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
