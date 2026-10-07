# Invitación: la recibida de Tomás

Página estática (HTML, CSS y JS, sin build) con confirmación de asistencia que guarda las respuestas en Supabase.

| Archivo | Para qué sirve |
| --- | --- |
| `index.html`, `styles.css`, `script.js` | La invitación y el formulario |
| `admin.html`, `admin.js` | La lista de confirmados (pide la clave del admin) |
| `img/`, `favicon.svg` | Imágenes |
| `supabase/schema.sql` | La tabla y la función para el admin |

## 1. Crear la tabla en Supabase

1. Entrá a [supabase.com](https://supabase.com), creá una cuenta y un proyecto nuevo.
2. En el menú de la izquierda, abrí **SQL Editor** y tocá **New query**.
3. Pegá todo el contenido de `supabase/schema.sql` y tocá **Run**.

Esto crea la tabla `rsvps`, que los invitados pueden completar pero no leer, y la función `listar_rsvps`, que usa la página de admin.

## 2. Pegar las keys

1. En Supabase, abrí **Project Settings → API Keys** (la URL del proyecto también aparece en **Data API**).
2. Copiá la **Project URL** y la **publishable key** (`sb_publishable_…`). En proyectos viejos se llama **anon public**.
3. Abrí `script.js` y pegalas en las dos constantes del principio:

```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xxxx';
```

No pongas nunca la **secret key** ni la **service_role**: esa key saltea toda la seguridad y la página es pública. La página de admin usa estas mismas dos constantes, así que no hace falta pegarlas en otro lado.

## 3. Subirlo a Netlify Drop

1. Entrá a [app.netlify.com/drop](https://app.netlify.com/drop).
2. Arrastrá **la carpeta completa** (la que tiene `index.html`).
3. Netlify te da una URL tipo `https://nombre-raro.netlify.app`. Si te creás una cuenta, podés cambiarle el nombre y el sitio no se borra.

Para actualizar el sitio después de cambiar algo, entrá al sitio en Netlify, andá a **Deploys** y volvé a arrastrar la carpeta.

Todo lo que está en la carpeta queda público, incluidos este README y el SQL. No pasa nada, porque no hay ningún secreto en ellos.

## 4. Ver las respuestas

**Desde la página de admin** (lo más cómodo, también desde el celu): abrí `https://TU-SITIO.netlify.app/admin.html`, escribí la clave y tocá **Ver la lista**.

La clave no está guardada en ningún archivo, porque esta carpeta queda pública. No distingue mayúsculas y queda recordada hasta que cerrás la pestaña. El panel muestra cuántas personas vienen en total (cada respuesta más sus acompañantes), quiénes vienen con los nombres de su familia y quiénes no pueden ir.

Si alguien confirmó dos veces con el mismo nombre, se cuenta la respuesta más nueva. Las anteriores quedan abajo, en **Respuestas reemplazadas**.

**Desde Supabase:** abrí **Table Editor → rsvps**. Para exportar, usá el botón **Export** de la tabla (o el menú **⋯ → Export data**) y elegí CSV, que se abre con Excel o Google Sheets. Para borrar una fila, por ejemplo una de prueba, marcala y tocá **Delete**.

## Cambiar la clave del admin

1. Elegí una clave nueva, larga y difícil de adivinar.
2. En el SQL Editor corré esto (con tu clave) y copiá el resultado:
   ```sql
   select encode(sha256(convert_to(lower('MI-CLAVE-NUEVA'), 'UTF8')), 'hex');
   ```
3. En `supabase/schema.sql`, reemplazá el hash que está dentro de `listar_rsvps` por el nuevo. Después pegá solo el bloque `create or replace function … ;` en el SQL Editor y corrélo.
4. Desde ese momento la página de admin pide la clave nueva y la vieja deja de funcionar.

## Probarlo en tu compu

Desde esta carpeta corré `python -m http.server 8080` y abrí `http://localhost:8080`. Para verlo desde el celu, conectado al mismo Wi-Fi, usá la IP de la compu en vez de `localhost`.
