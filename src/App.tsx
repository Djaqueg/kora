import { IconCards, IconClose, IconHeadphones, IconLibrary, IconPause, IconPlay, IconSettings } from './components/Icons';
import { KoraProvider, useKora } from './context';
import { navigate, useRoute, type Route } from './router';
import { BookDetail } from './views/BookDetail';
import { Library } from './views/Library';
import { Reader } from './views/Reader';
import { Review } from './views/Review';
import { Settings } from './views/Settings';
import { Synthesis } from './views/Synthesis';

function navTarget(route: Route) {
  if (route.name === 'review') return 'review';
  if (route.name === 'settings') return 'settings';
  return 'library';
}

function Shell() {
  const route = useRoute();
  const { tts, toasts } = useKora();
  const active = navTarget(route);
  const items = [
    { id: 'library', label: 'Biblioteca', href: '/', icon: <IconLibrary /> },
    { id: 'review', label: 'Repaso', href: '/repaso', icon: <IconCards /> },
    { id: 'settings', label: 'Ajustes', href: '/ajustes', icon: <IconSettings /> },
  ];

  return (
    <div className={`app ${route.name === 'read' ? 'app-read' : ''} ${tts.active ? 'has-audio' : ''}`}>
      <aside className="sidebar" data-testid="sidebar">
        <div className="brand">
          <span className="logo-mark">K</span>
          <span>
            <strong>Kora</strong>
            <small>Lee. Sintetiza. Recuerda.</small>
          </span>
        </div>
        <nav>
          {items.map((item) => (
            <button key={item.id} className={active === item.id ? 'active' : ''} type="button" onClick={() => navigate(item.href)} aria-current={active === item.id ? 'page' : undefined}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        {route.name === 'library' && <Library />}
        {route.name === 'book' && <BookDetail id={route.id} />}
        {route.name === 'read' && <Reader id={route.id} chapterId={route.chapterId} quote={route.quote} />}
        {route.name === 'synthesis' && <Synthesis id={route.id} />}
        {route.name === 'review' && <Review />}
        {route.name === 'settings' && <Settings section={route.section} />}
      </main>
      <nav className="bottom-nav" data-testid="bottom-nav" aria-label="Principal">
        {items.map((item) => (
          <button key={item.id} className={active === item.id ? 'active' : ''} type="button" onClick={() => navigate(item.href)} aria-current={active === item.id ? 'page' : undefined}>
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      {tts.active && (
        <div className="audio-bar" data-testid="audio-bar">
          <button className="icon-btn light" type="button" onClick={tts.toggle} aria-label={tts.playing ? 'Pausar' : 'Reproducir'}>
            {tts.playing ? <IconPause /> : <IconPlay />}
          </button>
          <div className="audio-copy">
            <strong>{tts.label || 'Audio'}</strong>
            <span>{tts.voiceHint || `${Math.min(tts.index + 1, tts.total)} / ${tts.total}`}</span>
          </div>
          <label className="audio-rate">
            <span>{tts.rate.toFixed(2)}×</span>
            <input type="range" min={0.75} max={2} step={0.05} value={tts.rate} aria-label="Velocidad" onChange={(event) => tts.setRate(Number(event.target.value))} />
          </label>
          <button className="text-btn light" type="button" onClick={() => tts.skip(-1)} aria-label="Párrafo anterior">Párrafo</button>
          <button className="text-btn light" type="button" onClick={() => tts.skip(1)} aria-label="Párrafo siguiente">Siguiente</button>
          <button className="text-btn light" type="button" onClick={() => tts.skipChapter(1)} aria-label="Capítulo siguiente">Capítulo</button>
          <button className="icon-btn light" type="button" onClick={tts.stop} aria-label="Cerrar audio"><IconClose /></button>
          <IconHeadphones className="sr-only" />
        </div>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((item) => <div key={item.id} className="toast" role="status">{item.text}</div>)}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <KoraProvider>
      <Shell />
    </KoraProvider>
  );
}
