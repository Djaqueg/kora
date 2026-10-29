import { useState } from 'react';
import { useKora } from '../context';
import { testGeminiKey } from '../lib/ai';
import { GEMINI_MODELS, maskGeminiKey } from '../lib/settings';

export function GeminiSettings() {
  const { settings, updateSettings } = useKora();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const saved = settings.geminiKey.trim();
  const mask = maskGeminiKey(saved);
  const models = GEMINI_MODELS.some((model) => model.id === settings.geminiModel)
    ? GEMINI_MODELS
    : [...GEMINI_MODELS, { id: settings.geminiModel, label: settings.geminiModel }];
  const shown = editing ? draft : mask;
  const revealed = editing && visible;

  function note(text: string, error = false) {
    setIsError(error);
    setMessage(text);
  }

  async function saveKey(value: string) {
    const next = value.trim();
    if (!next || next === mask) return;
    await updateSettings({ geminiKey: next, aiProvider: 'gemini' });
  }

  async function clearKey() {
    setEditing(false);
    setDraft('');
    setVisible(false);
    await updateSettings({ geminiKey: '', aiProvider: 'none' });
    note('Clave de Gemini borrada de este dispositivo.');
  }

  async function probe() {
    const candidate = editing && draft.trim() ? draft.trim() : saved;
    if (!candidate || candidate === mask) {
      note('Añade tu clave de Gemini.', true);
      return;
    }
    setBusy(true);
    try {
      await testGeminiKey(candidate, settings.geminiModel);
      if (editing && draft.trim()) await saveKey(draft);
      note('La clave de Gemini funciona.');
    } catch (reason) {
      note(reason instanceof Error ? reason.message : 'No se pudo probar la clave de Gemini.', true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="setting-card" id="ia">
      <h2>Inteligencia artificial</h2>
      <p className="muted">La clave se guarda en este navegador y las peticiones salen directo a Gemini. Para llevarla a otro dispositivo, actívala en Datos: se cifra y la contraseña no se sube. Sin clave, el modo local sigue disponible.</p>
      <div className="field">
        <label htmlFor="gemini-key">Clave de Gemini</label>
        <span className="secret-input">
          <input
            id="gemini-key"
            type={revealed ? 'text' : editing ? 'password' : 'text'}
            value={shown}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="AIza…"
            onFocus={() => {
              setEditing(true);
              setDraft('');
              setVisible(false);
            }}
            onChange={(event) => {
              const next = event.target.value.trim();
              setEditing(true);
              setDraft(next);
              if (next && next !== mask) void saveKey(next);
            }}
            onBlur={() => {
              setEditing(false);
              setDraft('');
              setVisible(false);
            }}
          />
          <button
            className="text-btn"
            type="button"
            aria-label={visible ? 'Ocultar clave' : 'Mostrar clave'}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? 'Ocultar' : 'Mostrar'}
          </button>
        </span>
      </div>
      <p className="muted">Restringe la clave en Google AI Studio o Cloud Console al referente HTTP <code>https://djaqueg.github.io/*</code>.</p>
      <label className="field" htmlFor="gemini-model">Modelo de Gemini
        <select
          id="gemini-model"
          value={settings.geminiModel}
          onChange={(event) => void updateSettings({ geminiModel: event.target.value })}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>{model.label}</option>
          ))}
        </select>
      </label>
      <div className="row-actions">
        <button className="btn" type="button" onClick={() => void probe()} disabled={busy}>Probar clave</button>
        <button className="btn secondary" type="button" onClick={() => void clearKey()} disabled={busy || !saved}>Borrar clave</button>
      </div>
      {message && <p className={isError ? 'form-error' : 'form-note'} role={isError ? 'alert' : 'status'}>{message}</p>}
    </section>
  );
}
