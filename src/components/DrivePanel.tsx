import { useEffect, useState } from 'react';
import { useKora } from '../context';
import { loadAiSyncPassword, saveAiSyncPassword } from '../db';
import { downloadDriveFile, listBookFiles, listFolders, requestGoogleToken, type DriveItem } from '../lib/drive';

export function DrivePanel() {
  const { settings, updateSettings, importDriveBuffer, pushSync, pullSync, toast } = useKora();
  const [folders, setFolders] = useState<DriveItem[]>([]);
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [help, setHelp] = useState(false);
  const [password, setPassword] = useState('');
  const connected = Boolean(settings.googleAccessToken) && settings.googleTokenExpiry > Date.now();

  useEffect(() => {
    let live = true;
    void loadAiSyncPassword().then((value) => {
      if (live) setPassword(value);
    });
    return () => {
      live = false;
    };
  }, []);

  function note(text: string, error = false) {
    setIsError(error);
    setMessage(text);
    if (error) toast(text);
  }

  function fail(reason: unknown) {
    const text = reason instanceof Error ? reason.message : 'No se pudo hablar con Google Drive.';
    if (text === 'TOKEN_EXPIRED') {
      void updateSettings({ googleAccessToken: '', googleTokenExpiry: 0 });
      note('El token caducó. Vuelve a conectar la cuenta.', true);
      return;
    }
    note(text, true);
  }

  async function connect() {
    if (!settings.googleClientId.trim()) {
      note('Primero pega el Client ID de Google Cloud.', true);
      return;
    }
    setBusy('Conectando…');
    try {
      const token = await requestGoogleToken(settings.googleClientId.trim());
      await updateSettings({
        googleAccessToken: token.accessToken,
        googleTokenExpiry: Date.now() + token.expiresIn * 1000,
      });
      note('Cuenta conectada en este dispositivo.');
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy('');
    }
  }

  async function disconnect() {
    await updateSettings({ googleAccessToken: '', googleTokenExpiry: 0 });
    setFolders([]);
    setFiles([]);
    setPicked([]);
    note('Cuenta desconectada en este dispositivo.');
  }

  function usePastedToken() {
    const token = settings.googleAccessToken.trim();
    if (!token) {
      note('Pega un token de acceso.', true);
      return;
    }
    void updateSettings({ googleTokenExpiry: Date.now() + 50 * 60 * 1000 });
    note('Token guardado solo en este navegador.');
  }

  async function loadFolderList() {
    setBusy('Buscando carpetas…');
    try {
      const found = await listFolders(settings.googleAccessToken);
      setFolders(found);
      note(found.length ? `${found.length} carpetas encontradas.` : 'No aparecen carpetas. Prueba a pegar el ID.');
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy('');
    }
  }

  async function chooseFolder(id: string, name: string) {
    await updateSettings({ driveFolderId: id, driveFolderName: name });
    setFiles([]);
    setPicked([]);
    note(name ? `Carpeta «${name}» seleccionada.` : 'ID de carpeta guardado.');
  }

  async function loadFiles() {
    if (!settings.driveFolderId) {
      note('Elige una carpeta primero.', true);
      return;
    }
    setBusy('Listando libros…');
    try {
      const found = await listBookFiles(settings.googleAccessToken, settings.driveFolderId);
      setFiles(found);
      setPicked(found.map((file) => file.id));
      note(found.length ? `${found.length} archivos listos para descargar.` : 'Esa carpeta no tiene EPUB, PDF, TXT ni MD.');
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy('');
    }
  }

  async function downloadPicked() {
    const chosen = files.filter((file) => picked.includes(file.id));
    if (!chosen.length) return;
    setBusy('Descargando…');
    try {
      for (const file of chosen) {
        const data = await downloadDriveFile(settings.googleAccessToken, file.id);
        await importDriveBuffer(file.name, data, file.id);
      }
      note(`${chosen.length} archivo(s) importados a la biblioteca.`);
      toast('Libros de Drive importados.');
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy('');
    }
  }

  async function rememberPassword(value: string) {
    setPassword(value);
    await saveAiSyncPassword(value);
  }

  async function push() {
    setBusy('Subiendo sincronización…');
    try {
      await saveAiSyncPassword(password);
      await updateSettings({ syncEncryptedAiKeys: settings.syncEncryptedAiKeys });
      await pushSync();
      note(settings.syncEncryptedAiKeys
        ? 'kora-sync.json actualizado. Las claves de IA van cifradas.'
        : 'kora-sync.json actualizado en la carpeta.');
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy('');
    }
  }

  async function pull() {
    setBusy('Bajando sincronización…');
    try {
      await saveAiSyncPassword(password);
      await updateSettings({ syncEncryptedAiKeys: settings.syncEncryptedAiKeys });
      await pullSync();
      note('Datos combinados desde kora-sync.json.');
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="stack" id="sincronizacion">
      <label className="field">
        Client ID de Google
        <input
          value={settings.googleClientId}
          onChange={(event) => void updateSettings({ googleClientId: event.target.value.trim() })}
          placeholder="1234567890-abc.apps.googleusercontent.com"
          autoComplete="off"
        />
      </label>
      <div className="row-actions">
        {connected ? (
          <button className="btn secondary" type="button" onClick={() => void disconnect()} disabled={Boolean(busy)}>Desconectar</button>
        ) : (
          <button className="btn" type="button" onClick={() => void connect()} disabled={Boolean(busy)}>Conectar cuenta Google</button>
        )}
        <span className="pill">{connected ? 'Conectada' : 'Sin conectar'}</span>
      </div>
      <button
        className="text-btn help-link"
        type="button"
        aria-expanded={help}
        aria-controls="client-id-help"
        onClick={() => setHelp((open) => !open)}
      >
        ¿Cómo obtengo el Client ID?
      </button>
      {help && (
        <div id="client-id-help">
          <p className="muted">Kora no tiene servidor. El token y el Client ID viven en este dispositivo.</p>
          <ol className="steps">
            <li>En Google Cloud Console crea un proyecto y activa la API de Google Drive.</li>
            <li>Crea un ID de cliente OAuth de tipo <strong>Aplicación web</strong>.</li>
            <li>En orígenes autorizados añade <code>http://localhost:5173</code>, <code>http://127.0.0.1:4173</code> y, si publicas en Pages, <code>https://tu-usuario.github.io</code> (sin la ruta del repositorio).</li>
            <li>Pega aquí el Client ID y pulsa Conectar. Acepta los permisos de lectura y de archivos creados por la app.</li>
            <li>Si aún no tienes Client ID, exporta el respaldo JSON y súbelo a la carpeta a mano: también sirve para mover la biblioteca.</li>
          </ol>
        </div>
      )}

      <div className="sync-lock">
        <div>
          <strong id="sync-ai-label">Sincronizar claves de IA cifradas en Drive</strong>
          <p className="muted">Gemini y NVIDIA se cifran aquí. La contraseña no se sube.</p>
        </div>
        <button
          className={`switch${settings.syncEncryptedAiKeys ? ' on' : ''}`}
          type="button"
          role="switch"
          aria-checked={settings.syncEncryptedAiKeys}
          aria-labelledby="sync-ai-label"
          onClick={() => void updateSettings({ syncEncryptedAiKeys: !settings.syncEncryptedAiKeys })}
        />
      </div>
      {settings.syncEncryptedAiKeys && (
        <label className="field">
          Contraseña de cifrado
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            placeholder="La misma en cada dispositivo"
            onChange={(event) => void rememberPassword(event.target.value)}
          />
        </label>
      )}

      <label className="field">
        O pega un token de acceso (OAuth)
        <input
          type="password"
          value={settings.googleAccessToken}
          onChange={(event) => void updateSettings({ googleAccessToken: event.target.value.trim() })}
          placeholder="ya29…"
          autoComplete="off"
        />
      </label>
      <button className="btn secondary" type="button" onClick={usePastedToken}>Usar este token</button>
      <div className="row-actions">
        <button className="btn secondary" type="button" onClick={() => void loadFolderList()} disabled={!settings.googleAccessToken || Boolean(busy)}>Buscar carpetas</button>
        {folders.length > 0 && (
          <select
            aria-label="Carpeta de Drive"
            value={settings.driveFolderId}
            onChange={(event) => {
              const folder = folders.find((item) => item.id === event.target.value);
              void chooseFolder(event.target.value, folder?.name || '');
            }}
          >
            <option value="">Elige una carpeta</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        )}
      </div>
      <label className="field">
        ID de carpeta (lo que va después de /folders/ en la URL de Drive)
        <input
          value={settings.driveFolderId}
          onChange={(event) => void updateSettings({ driveFolderId: event.target.value.trim() })}
          placeholder="1AbC…"
        />
      </label>
      {settings.driveFolderName && <p className="muted">Carpeta activa: {settings.driveFolderName}</p>}
      <div className="row-actions">
        <button className="btn secondary" type="button" onClick={() => void loadFiles()} disabled={Boolean(busy)}>Ver libros de la carpeta</button>
        <button className="btn secondary" type="button" onClick={() => void push()} disabled={Boolean(busy)}>Subir kora-sync.json</button>
        <button className="btn secondary" type="button" onClick={() => void pull()} disabled={Boolean(busy)}>Bajar y combinar</button>
      </div>
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file) => (
            <li key={file.id}>
              <label>
                <input
                  type="checkbox"
                  checked={picked.includes(file.id)}
                  onChange={(event) => setPicked((list) => event.target.checked ? [...list, file.id] : list.filter((id) => id !== file.id))}
                />
                {file.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <button className="btn" type="button" onClick={() => void downloadPicked()} disabled={Boolean(busy) || !picked.length}>
          Descargar seleccionados
        </button>
      )}
      {busy && <p className="muted">{busy}</p>}
      {message && <p className={isError ? 'form-error' : 'form-note'} role={isError ? 'alert' : 'status'}>{message}</p>}
    </div>
  );
}
