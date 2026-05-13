# Control de Iglesias

PWA en Next.js para publicar noticias o publicidad de la iglesia, crear eventos y notificar a usuarios incluso sin cuenta, siempre que tengan la app instalada y el permiso de notificaciones activo.

## Qué incluye

- Feed de noticias y publicidad
- Calendario mensual de eventos
- Panel de administración para crear contenido
- Registro local de suscripciones y persistencia en navegador
- Rutas API preparadas para Vercel Postgres
- Manifest y service worker para instalar como PWA

## Ejecución

```bash
npm run dev
```

## Base de datos

La app intenta usar `POSTGRES_URL`, `VERCEL_POSTGRES_URL` o `DATABASE_URL`.

Si no existe conexión, cae automáticamente a modo local con `localStorage` para que la interfaz siga funcionando.

## Variables sugeridas

```env
AUTH_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
POSTGRES_URL=
DATABASE_URL=
POSTGRES_URL_NON_POOLING=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

## Acceso de administrador

- URL de acceso: `/login`
- Valores de desarrollo por defecto:
  - correo: `admin@iglesia.local`
  - contraseña: `admin1234`

## Notas

- La capa de notificaciones está lista para extenderse con push real desde backend.
- El panel administrativo actualmente crea contenido y lo sincroniza si la base responde; si no, conserva el estado localmente.
- Si configuras `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `AUTH_SECRET` en Vercel, el login queda listo para producción.
