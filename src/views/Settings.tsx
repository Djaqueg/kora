import { useEffect, useState } from 'react';
import { DrivePanel } from '../components/DrivePanel';
import { BrightnessSlider, ScrollSwitch, TextSizePicker } from '../components/TypeControls';
import { useKora } from '../context';

export function Settings({ section }: { section?: string }) {
  const {
    settings, streak, updateSettings, updateGoals, exportBackup, importBackup, restoreExamples,
    installEvent, promptInstall, toast,
  } = useKora();
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (section === 'sync') document.getElementById('sincronizacion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [section]);

  useEffect(() => {
    void navigator.serviceWorker?.ready.then(() => setOffline(true)).catch(() => setOffline(false));
  }, []);

  const standalone = window.matchMedia('(display-mode: standalone)').matches;

  return (
    <div className="page settings" data-testid="settings-view">
      <header className="page-head">
        <div>
          <p className="eyebrow">Ajustes</p>
          <h1>Kora en este dispositivo</h1>
        </div>
      </header>

      <section className="setting-card">
        <h2>Lectura</h2>
        <p className="muted">Estos valores se usan al abrir cualquier libro. También puedes cambiarlos dentro del lector.</p>
        <div className="theme-picks">
          {(['claro', 'sepia', 'oscuro'] as const).map((theme) => (
            <button key={theme} className={settings.theme === theme ? 'on' : ''} type="button" onClick={() => void updateSettings({ theme })}>
              {theme === 'claro' ? 'Claro' : theme === 'sepia' ? 'Sepia' : 'Oscuro'}
            </button>
          ))}
        </div>
        <label className="field">Fuente
          <select value={settings.fontFamily} onChange={(event) => void updateSettings({ fontFamily: event.target.value as typeof settings.fontFamily })}>
            <option value="newsreader">Newsreader</option>
            <option value="playfair">Playfair Display</option>
            <option value="literata">Literata</option>
            <option value="jakarta">Plus Jakarta Sans</option>
            <option value="outfit">Outfit</option>
            <option value="serif">Serif del sistema</option>
          </select>
        </label>
        <div className="sheet-split">
          <div>
            <p className="sheet-label">Tamaño de texto</p>
            <TextSizePicker value={settings.fontSize} onChange={(fontSize) => void updateSettings({ fontSize })} />
          </div>
          <div>
            <p className="sheet-label">Desplazamiento</p>
            <ScrollSwitch value={settings.scrollMode} onChange={(scrollMode) => void updateSettings({ scrollMode })} />
          </div>
        </div>
        <p className="sheet-label">Brillo y calidez</p>
        <BrightnessSlider value={settings.brightness} onChange={(brightness) => void updateSettings({ brightness })} />
        <label className="field">Interlineado {settings.lineHeight.toFixed(2)}
          <input type="range" min={1.4} max={2} step={0.05} value={settings.lineHeight} onChange={(event) => void updateSettings({ lineHeight: Number(event.target.value) })} />
        </label>
      </section>

      <section className="setting-card">
        <h2>Meta diaria</h2>
        <p className="muted">La racha suma cuando llegas a los minutos o a las cápsulas. Una cápsula marcada como hecha también suma 2 minutos.</p>
        <div className="split">
          <label className="field">Minutos
            <input type="number" min={5} max={180} value={streak.dailyGoalMinutes} onChange={(event) => void updateGoals({ dailyGoalMinutes: Number(event.target.value) || 15 })} />
          </label>
          <label className="field">Cápsulas
            <input type="number" min={1} max={12} value={streak.dailyCapsuleGoal} onChange={(event) => void updateGoals({ dailyCapsuleGoal: Number(event.target.value) || 1 })} />
          </label>
        </div>
      </section>

      <section className="setting-card" id="ia">
        <h2>Inteligencia artificial</h2>
        <p className="muted">Las claves se guardan solo en este navegador y las peticiones salen directo a Gemini o a tu endpoint. Sin clave, el modo local sigue disponible.</p>
        <fieldset className="choice-set">
          <legend>Proveedor preferido</legend>
          <label><input type="radio" name="provider" checked={settings.aiProvider === 'none'} onChange={() => void updateSettings({ aiProvider: 'none' })} /> Solo local</label>
          <label><input type="radio" name="provider" checked={settings.aiProvider === 'gemini'} onChange={() => void updateSettings({ aiProvider: 'gemini' })} /> Google Gemini</label>
          <label><input type="radio" name="provider" checked={settings.aiProvider === 'nvidia'} onChange={() => void updateSettings({ aiProvider: 'nvidia' })} /> NVIDIA Build / API compatible con OpenAI</label>
        </fieldset>
        <label className="field">Clave de Gemini
          <input type="password" value={settings.geminiKey} autoComplete="off" onChange={(event) => void updateSettings({ geminiKey: event.target.value.trim() })} placeholder="AIza…" />
        </label>
        <label className="field">Modelo de Gemini
          <input value={settings.geminiModel} onChange={(event) => void updateSettings({ geminiModel: event.target.value.trim() })} placeholder="gemini-2.0-flash" />
        </label>
        <label className="field">Clave de NVIDIA Build
          <input type="password" value={settings.nvidiaKey} autoComplete="off" onChange={(event) => void updateSettings({ nvidiaKey: event.target.value.trim() })} placeholder="nvapi-…" />
        </label>
        <label className="field">Base URL
          <input value={settings.nvidiaBaseUrl} onChange={(event) => void updateSettings({ nvidiaBaseUrl: event.target.value.trim() })} placeholder="https://integrate.api.nvidia.com/v1" />
        </label>
        <label className="field">Modelo
          <input value={settings.nvidiaModel} onChange={(event) => void updateSettings({ nvidiaModel: event.target.value.trim() })} placeholder="meta/llama-3.1-70b-instruct" />
        </label>
      </section>

      <section className="setting-card">
        <h2>Sincronización</h2>
        <DrivePanel />
      </section>

      <section className="setting-card">
        <h2>Respaldo</h2>
        <p className="muted">El JSON incluye libros, progreso, subrayados, cápsulas, tarjetas, racha y las claves guardadas. No lo compartas en público.</p>
        <div className="row-actions">
          <button className="btn" type="button" onClick={() => void exportBackup()}>Exportar respaldo</button>
          <label className="btn secondary file-btn">
            Combinar JSON
            <input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importBackup(file, 'merge').catch((reason) => setMessage(reason instanceof Error ? reason.message : 'No se pudo importar.'));
              event.target.value = '';
            }} />
          </label>
          <label className="btn secondary file-btn">
            Reemplazar con JSON
            <input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (window.confirm('Esto sustituye la biblioteca local por el archivo.')) {
                void importBackup(file, 'replace').catch((reason) => setMessage(reason instanceof Error ? reason.message : 'No se pudo importar.'));
              }
              event.target.value = '';
            }} />
          </label>
        </div>
        <button className="btn secondary" type="button" onClick={() => void restoreExamples()}>Restaurar libros de ejemplo</button>
        {message && <p className="form-error" role="alert">{message}</p>}
      </section>

      <section className="setting-card">
        <h2>Instalar la app</h2>
        <p className="muted">
          {standalone ? 'Kora ya se está ejecutando como aplicación.' : 'En Android Chrome: menú ⋮ → Instalar aplicación o Añadir a pantalla principal. En el PC: icono de instalar en la barra de Chrome o Edge.'}
        </p>
        {installEvent && <button className="btn" type="button" onClick={() => void promptInstall()}>Instalar Kora</button>}
        <p className="muted">{offline ? 'Lista para usarse sin conexión.' : 'El service worker se activará tras la primera carga completa.'}</p>
        <button className="text-btn" type="button" onClick={() => toast('Kora guarda todo en este dispositivo.')}>Acerca de la privacidad</button>
      </section>

      <section className="setting-card">
        <h2>Acerca de</h2>
        <p>Kora 1.0 lee en el dispositivo, resume en cápsulas de quince minutos y repasa con SM-2. Los tres libros iniciales son textos originales para probar la app. No hay cuenta ni servidor de Kora.</p>
      </section>
    </div>
  );
}
