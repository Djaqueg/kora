import { useState } from 'react';
import { useKora } from '../context';
import { downloadDriveFile, listBookFiles, listFolders, requestGoogleToken, type DriveItem } from '../lib/drive';

export function DrivePanel() {
  const { settings, updateSettings, importDriveBuffer, pushSync, pullSync, toast } = useKora();
  const [folders, setFolders] = useState<DriveItem[]>([]);
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const connected = Boolean(settings.googleAccessToken) && settings.googleTokenExpiry > Date.now();

  function fail(reason: unknown) {
    const text = reason instanceof Error ? reason.message : 'No se pudo hablar con Google Drive.';
    if (text === 'TOKEN_EXPIRED') {
      void updateSettings({ googleAccessToken: '', googleTokenExpiry: 0 });
      setMessage('El token caducó. Vuelve a conectar la cuenta.');
      return;
    }
    setMessage(text);
    toast(text);
  }

  async function connect() {
    if (!settings.googleClientId.trim()) {
      setMessage('Primero pega el Client ID de Google Cloud.');
      return;
    }
    setBusy('Conectando…');
    try {
      const token = await requestGoogleToken(settings.googleClientId.trim());
      await updateSettings({
        googleAccessToken: token.accessToken,
        googleTokenExpiry: Date.now() + token.expiresIn * 1000,
      });
      setMessage('Cuenta conectada en este dispositivo.');
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy('');
    }
  }

  function usePastedToken() {
    const token = settings.googleAccessToken.trim();
    if (!token) {
      setMessage('Pega un token de acceso.');
      return;
    }
    void updateSettings({ googleTokenExpiry: Date.now() + 50 * 60 * 1000 });
    setMessage('Token guardado solo en este navegador.');
  }

  async function loadFolders() {
    setBusy('Buscando carpetas…');
    try {
      const found = await listFolders(settings.googleAccessToken);
      setFolders(found);
      setMessage(found.length ? `${found.length} carpetas encontradas.` : 'No aparecen carpetas. Prueba a pegar el ID.');
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
    setMessage(name ? `Carpeta «${name}» seleccionada.` : 'ID de carpeta guardado.');
  }

  async function loadFiles() {
    if (!settings.driveFolderId) {
      setMessage('Elige una carpeta primero.');
      return;
    }
    setBusy('Listando libros…');
    try {
      const found = await listBookFiles(settings.googleAccessToken, settings.driveFolderId);
      setFiles(found);
      setPicked(found.map((file) => file.id));
      setMessage(found.length ? `${found.length} archivos listos para descargar.` : 'Esa carpeta no tiene EPUB, PDF, TXT ni MD.');
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
      setMessage(`${chosen.length} archivo(s) importados a la biblioteca.`);
      toast('Libros de Drive importados.');
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy('');
    }
  }

  async function push() {
    setBusy('Subiendo sincronización…');
    try {
      await pushSync();
      setMessage('kora-sync.json actualizado en la carpeta.');
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy('');
    }
  }

  async function pull() {
    setBusy('Bajando sincronización…');
    try {
      await pullSync();
      setMessage('Datos combinados desde kora-sync.json.');
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="stack" id="sincronizacion">
      <p className="muted">
        Kora no tiene servidor. El token y el Client ID viven en IndexedDB de este dispositivo. Drive sirve para traer libros y para compartir <code>kora-sync.json</code> entre el PC y Android.
      </p>
      <ol className="steps">
        <li>En Google Cloud Console crea un proyecto y activa la API de Google Drive.</li>
        <li>Crea un ID de cliente OAuth de tipo <strong>Aplicación web</strong>.</li>
        <li>En orígenes autorizados añade <code>http://localhost:5173</code>, <code>http://127.0.0.1:4173</code> y, si publicas en Pages, <code>https://tu-usuario.github.io</code> (sin la ruta del repositorio).</li>
        <li>Pega aquí el Client ID y pulsa Conectar. Acepta los permisos de lectura y de archivos creados por la app.</li>
        <li>Si aún no tienes Client ID, exporta el respaldo JSON y súbelo a la carpeta a mano: también sirve para mover la biblioteca.</li>
      </ol>
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
        <button className="btn" type="button" onClick={() => void connect()} disabled={Boolean(busy)}>Conectar cuenta Google</button>
        <span className="pill">{connected ? 'Conectada' : 'Sin conectar'}</span>
      </div>
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
        <button className="btn secondary" type="button" onClick={() => void loadFolders()} disabled={!settings.googleAccessToken || Boolean(busy)}>Buscar carpetas</button>
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
      {message && <p className="form-note" role="status">{message}</p>}
    </div>
  );
}
