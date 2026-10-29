import { useEffect, useState } from 'react';

export type Route =
  | { name: 'library' }
  | { name: 'book'; id: string }
  | { name: 'read'; id: string; chapterId?: string; quote?: string }
  | { name: 'synthesis'; id: string }
  | { name: 'review' }
  | { name: 'settings'; section?: string };

export function parseHash(hash: string): Route {
  const raw = (hash || '#/').replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'libro' && parts[1]) return { name: 'book', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'leer' && parts[1]) {
    return {
      name: 'read',
      id: decodeURIComponent(parts[1]),
      chapterId: params.get('c') || undefined,
      quote: params.get('q') || undefined,
    };
  }
  if (parts[0] === 'sintesis' && parts[1]) return { name: 'synthesis', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'repaso') return { name: 'review' };
  if (parts[0] === 'ajustes') return { name: 'settings', section: params.get('seccion') || undefined };
  return { name: 'library' };
}

export function navigate(to: string) {
  const next = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`;
  if (window.location.hash === next) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = next;
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parseHash(hash);
}
