# Kora

Kora es una PWA en español, pensada para Android y el PC, que junta dos maneras de leer: la de un lector de libros (EPUB, PDF, TXT y Markdown, con subrayados, notas y voz) y la de un microaprendizaje de quince minutos (ideas clave, audio resumen, racha diaria y flashcards con repaso espaciado).

Todo vive en el dispositivo. No hay servidor de Kora. La app se instala, funciona sin red y puede intercambiar un archivo `kora-sync.json` con una carpeta de Google Drive.

## Qué incluye

- **Biblioteca.** Portadas, autor, formato, progreso, cápsulas y tarjetas. Meta de 15 minutos o 1 cápsula, y la racha del día.
- **Tres libros de ejemplo**, escritos para Kora, listos al abrir la app: *Semillas de atención* (MD), *El cuaderno de las decisiones* (TXT) y *Memoria viva* (EPUB). Traen capítulos completos, subrayados, ideas clave, flashcards y mini-quiz.
- **Lector.** Página blanca de libro, capitular, «Capítulo N» y «Página X». Al tocar la página se abre una hoja con audio, modo noche, capítulos, tamaño (A A A), desplazamiento continuo o paginado, y brillo. El texto se selecciona para subrayar en cuatro colores, anotar y convertir el pasaje en flashcard o idea clave. Temas Claro, Sepia y Oscuro.
- **Voz.** El lector y el resumen de cápsulas usan la Web Speech API, con preferencia por voces en español, velocidad de 0,75× a 2×, pausa y salto de párrafo o capítulo.
- **Síntesis de 15 min.** Cápsulas con título, idea, «En la práctica» y cita. El audio resumen las lee seguidas. Cada una vuelve al pasaje del libro.
- **IA opcional.** Gemini o un endpoint compatible con OpenAI (NVIDIA Build, por defecto `https://integrate.api.nvidia.com/v1`). La clave se guarda en este navegador. Si lo activas, también puede viajar cifrada en `kora-sync.json`; la contraseña no sale del dispositivo.
- **Modo local.** Sin clave se pueden crear cápsulas y tarjetas a mano, o generar una síntesis extractiva a partir de los capítulos y los subrayados.
- **Repaso.** Tarjetas vencidas con *Otra vez, Difícil, Bien y Fácil* (SM-2) y un mini-quiz.
- **Drive y respaldo.** OAuth con Client ID propio, descarga de EPUB/PDF/TXT/MD, subida y bajada de `kora-sync.json`, y exportar o importar un JSON completo.

## Arrancar en local

Hace falta Node.js 22.

```bash
npm ci
npm run dev
```

Abre `http://localhost:5173`. El atajo `npm run build && npm run preview` sirve la versión que se instala, en `http://127.0.0.1:4173` si usas el puerto de las pruebas.

```bash
npm run build
npm test:e2e
```

`test:e2e` compila la app y la recorre en Chromium sin ventana: biblioteca, lectura, subrayado a flashcard, cápsulas, generación local, repaso, ajustes, importación de TXT/MD/EPUB/PDF, y el mismo flujo en un viewport de móvil.

## Publicar en GitHub Pages

El archivo `.github/workflows/deploy.yml` publica `dist/` en GitHub Pages cada vez que `main` recibe un push.

1. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Fusiona a `main`. La acción `Deploy Kora to GitHub Pages` deja la app en `https://<usuario>.github.io/kora/`.
3. La base de Vite es `./`, así que los archivos funcionan en un sitio de proyecto sin reescribir rutas. La navegación usa el hash (`#/leer/...`), y el build copia `index.html` a `404.html` por si el servidor pide otra ruta.

## Instalar en Android y en el PC

Hace falta servir la app por HTTPS (Pages) o por `localhost`.

- **Android (Chrome):** menú ⋮ → **Instalar aplicación** o **Añadir a pantalla principal**. El manifest pide `standalone`, iconos de 192 y 512, y un icono enmascarable. El service worker deja la biblioteca usable sin red después de la primera visita.
- **PC (Chrome o Edge):** icono de instalar en la barra de direcciones, o el botón **Instalar Kora** dentro de Ajustes cuando el navegador ofrece `beforeinstallprompt`.

En el teléfono la navegación va abajo. En una ventana ancha, a la izquierda.

## Google Drive

Kora no pide un backend. Tú creas el cliente OAuth y la app habla con Drive desde el navegador.

1. Entra en [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto y activa **Google Drive API**.
2. En **APIs y servicios → Credenciales**, crea un **ID de cliente OAuth** de tipo **Aplicación web**.
3. En **orígenes de JavaScript autorizados** añade el origen exacto, sin ruta:
   - `http://localhost:5173`
   - `http://127.0.0.1:4173`
   - `https://<usuario>.github.io` si publicas en Pages
4. En Kora, abre **Ajustes → Sincronización**, pega el Client ID y pulsa **Conectar cuenta Google**.
5. Acepta estos alcances: lectura de Drive (`drive.readonly`) y archivos que la app cree (`drive.file`).
6. Elige la carpeta, o pega el ID que aparece en `https://drive.google.com/drive/folders/<ID>`.
7. **Ver libros de la carpeta** lista `.epub`, `.pdf`, `.txt` y `.md`. **Descargar seleccionados** los guarda en IndexedDB.
8. **Subir kora-sync.json** escribe progreso, subrayados, cápsulas, tarjetas, quiz, racha y ajustes de lectura. **Bajar y combinar** une ese archivo con lo que ya hay en el dispositivo. Si hay conflicto, gana la copia más reciente. Borrar un libro deja una marca para que la sincronización no lo restaure.
9. Las claves de IA no se suben en claro. Con **Sincronizar claves de IA cifradas en Drive** activo, Kora deriva una clave con PBKDF2 y cifra con AES-GCM. En Drive solo va el bloque cifrado, la sal y el IV. La contraseña se queda en el navegador. En el otro dispositivo, activa el mismo control, escribe la misma contraseña y baja el archivo. Si la contraseña no coincide, los libros y el progreso igual se combinan.

Si todavía no tienes Client ID, usa **Exportar respaldo** y sube el JSON a la carpeta a mano. En el otro dispositivo, **Combinar JSON**. Ese respaldo local sí incluye las claves de API en claro: no lo compartas.

También puedes pegar un token de acceso OAuth que ya tengas. Caduca; cuando Drive responda 401, vuelve a conectar.

## Gemini

1. Crea una clave en [Google AI Studio](https://aistudio.google.com/apikey).
2. En **Ajustes → IA** elige **Google Gemini**, pega la clave y el modelo (por defecto `gemini-2.0-flash`).
3. En un libro, **Generar** y elige Gemini, para el libro entero o un capítulo.

La petición va de tu navegador a `generativelanguage.googleapis.com`. Kora pide de 8 a 12 ideas clave, un resumen, flashcards y un mini-quiz, y solo acepta JSON. Las cápsulas y tarjetas creadas a mano no se sustituyen.

## NVIDIA Build u otra API compatible

1. Crea una clave en [NVIDIA Build](https://build.nvidia.com/).
2. En Ajustes elige **NVIDIA Build**, pega la clave, la base (`https://integrate.api.nvidia.com/v1` u otro endpoint `/v1`) y el modelo, por ejemplo `meta/llama-3.1-70b-instruct`.
3. Genera igual que con Gemini. Kora llama a `POST {base}/chat/completions` con `Authorization: Bearer`.

Sin red, o sin clave, usa **Modo local, sin API**. Ordena frases del libro, prioriza las que coinciden con tus subrayados y arma cápsulas, tarjetas de hueco y un quiz.

## Privacidad

Libros, progreso, subrayados, cápsulas, tarjetas, racha, Client ID, claves de API y la contraseña de cifrado están en IndexedDB de ese navegador. La contraseña no se incluye en `kora-sync.json`. La voz la sintetiza el propio sistema. Gemini, NVIDIA y Google solo reciben datos cuando tú pulsas generar, conectar o sincronizar.

## Tecnologías

React, TypeScript y Vite (`base: './'`), IndexedDB (`idb`), JSZip para EPUB, PDF.js para PDF, Workbox a través de `vite-plugin-pwa`, y la Web Speech API.
