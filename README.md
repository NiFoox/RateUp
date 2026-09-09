# RateUp API – Backend Contract

Este documento describe el contrato completo de la API del backend de RateUp, incluyendo rutas, DTOs, métodos HTTP, parámetros, estructuras de datos y reglas generales. Sirve como referencia para integrar el frontend con el backend.

Base URL: `http://localhost:3000/api`  
Formato de datos: JSON  
Autenticación: JWT (Bearer Token) en el header `Authorization`

---

# Ejecución y configuración

La API corre en Node.js y PostgreSQL; `docker-compose.yml` levanta **solo PostgreSQL 16**, no la API ni el frontend. Ejecutar los comandos desde la raíz del repositorio.

1. Instalar las versiones del lockfile con `npm ci`.
2. Copiar `.env.example` a `.env`. Reemplazar el `JWT_SECRET` vacío por un secreto propio. Podés generar uno localmente con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y pegarlo en `.env`. No commitear ese archivo.
3. Levantar la base: `docker compose up -d postgres`. Esperar hasta que `docker compose exec -T postgres pg_isready -U rateup -d rateupdb` indique que acepta conexiones.
4. En una base nueva, ejecutar los scripts en este orden (Git Bash/Linux/macOS):

```bash
docker compose exec -T postgres psql -U rateup -d rateupdb -v ON_ERROR_STOP=1 < src/user/migrations/script.sql
docker compose exec -T postgres psql -U rateup -d rateupdb -v ON_ERROR_STOP=1 < src/game/migrations/script.sql
docker compose exec -T postgres psql -U rateup -d rateupdb -v ON_ERROR_STOP=1 < src/review/migrations/script.sql
docker compose exec -T postgres psql -U rateup -d rateupdb -v ON_ERROR_STOP=1 < src/review-comment/migrations/script.sql
docker compose exec -T postgres psql -U rateup -d rateupdb -v ON_ERROR_STOP=1 < src/review-vote/migrations/script.sql
```

Los scripts crean las tablas si faltan; no son un sistema de migración de versiones de tablas existentes. El volumen `postgres_data` conserva la base. Cambiar las variables de Compose no cambia automáticamente las credenciales de un volumen previamente inicializado.

5. Desarrollo: `npm run start:dev`. Ejecución compilada: `npm run build` y luego `node dist/src/server.js`.
6. Comprobaciones: `npm test -- --runInBand`, `npm run build`, `npx --no-install tsc -p tsconfig.test.json`, `npm run lint`. Los tests también cargan la configuración: requieren un `JWT_SECRET` de prueba en el entorno o `.env`.

Para preparar el primer administrador de una base local vacía, registrar una cuenta por `/auth/register` y asignar ADMIN desde la consola SQL, usando el username de esa cuenta. Por ejemplo, dentro de `docker compose exec postgres psql -U rateup -d rateupdb`:

```sql
UPDATE users SET roles = ARRAY['USER', 'ADMIN']::text[] WHERE username = 'demo-admin';
```

Después hacer login y usar su token en los ejemplos administrativos. El registro HTTP público nunca acepta roles. Los `.http` usan IDs ilustrativos: reemplazarlos por los IDs devueltos por las creaciones.

## Variables de entorno

`src/shared/config.ts` carga dotenv antes de validar con Zod. Las variables ya definidas en el proceso tienen prioridad sobre `.env`. La configuración se lee una vez al importar el módulo; cambiar el entorno requiere reiniciar la API.

| Variable | Default al omitir | Validación |
| --- | --- | --- |
| `JWT_SECRET` | Ninguno; obligatorio | String no vacío ni solo espacios; no existe fallback. |
| `PORT` | `3000` | Dígitos decimales que representen un entero entre 1 y 65535. |
| `POSTGRES_HOST` | `localhost` | String no vacío. |
| `POSTGRES_PORT` | `5432` | Mismas reglas que PORT. |
| `POSTGRES_USER` | `rateup` | String no vacío. |
| `POSTGRES_PASSWORD` | `rateup123` | String no vacío; default local compatible con Compose. |
| `POSTGRES_DB` | `rateupdb` | String no vacío. |
| `NODE_ENV` | `development` | `development`, `test` o `production`. |
| `LOG_LEVEL` | `info` en production; `debug` en otros entornos | `fatal`, `error`, `warn`, `info`, `debug`, `trace` o `silent`. |

Un valor presente pero vacío no activa un default. Puertos fraccionarios, cero, texto o fuera de rango impiden el inicio. La aplicación falla **antes de escuchar HTTP** si la configuración es inválida e informa los nombres de las variables, sin imprimir sus valores. Los defaults PostgreSQL son para la ejecución local de este proyecto; configurar credenciales propias en otros entornos.

El pool conserva máximo 10 conexiones, timeout de conexión 5 segundos e inactividad 30 segundos. Conecta de forma diferida: el mensaje de inicio HTTP no prueba por sí solo que PostgreSQL esté disponible; verificar también una petición que consulte la base.

## Cierre del servidor

`SIGINT` (Ctrl+C) y `SIGTERM` dejan de aceptar conexiones nuevas, esperan a que termine el trabajo HTTP en curso y luego ejecutan `pool.end()`. Con los recursos cerrados, Node finaliza con código 0. Señales repetidas no duplican el cierre.

Los errores no capturados, rechazos no manejados y errores del servidor/pool inician el mismo cierre con código 1. Hay un plazo total de 10 segundos: si se excede, se fuerzan las conexiones HTTP y la salida con código 1. En ese caso excepcional no se garantiza completar las peticiones pendientes.

# Convenciones comunes del contrato

Las rutas documentadas debajo omiten el prefijo `/api`. Se conservan sus diferentes estructuras (`items`, `data`, `count`, `total`, `limit`, `pageSize`); no son sinónimos intercambiables.

- Body JSON: errores de sintaxis `400 INVALID_JSON`; tamaño superior al límite de 100kb de Express `413 PAYLOAD_TOO_LARGE`.
- Entradas que incumplen un schema: `400` con `{ message: "Validation error", code: "VALIDATION_ERROR", formErrors, fieldErrors }`.
- Errores esperados: `{ message, code, field? }`; `field` se omite cuando no corresponde.
- Rutas protegidas: sesión ausente/inválida, usuario eliminado o inactivo → `401 UNAUTHENTICATED`. Sesión válida sin permiso → `403 FORBIDDEN`.
- Fallos internos: `500` con `{ message: "Internal server error", code: "INTERNAL_ERROR" }`, sin detalles de PostgreSQL.
- Estas respuestas comunes aplican aunque una sección enumere solo errores específicos. Una ruta no definida conserva el 404 de Express (puede ser HTML; no es el error de dominio de un recurso inexistente).
- En las escrituras se rechazan campos extra del body. Las query adicionales se ignoran. Home y `/reviews/:id/full` aplican defaults solo al omitir el parámetro; los listados de Games/Users/Reviews/Comments también conservan defaults ante strings vacíos o con espacios.
- Las fechas expuestas se serializan a strings ISO; los campos `updatedAt` pueden ser null donde se muestran así. Los DTOs públicos de autores no incluyen email. El email queda en Auth, perfiles privados y respuestas de Users según sus permisos.

---

# Autenticación

El JWT conserva su duración (4 horas, o 30 días con `rememberMe`). En cada petición que usa autenticación se verifica el token y se consulta al usuario por `sub`: debe existir y estar activo; sus roles actuales en PostgreSQL determinan los permisos. Los roles y el email antiguos del token no se usan para autorizar.

Las rutas con autenticación opcional conservan el acceso público: un token inválido, expirado o de una cuenta inactiva se trata como anónimo. Los fallos de infraestructura producen `500`, no una sesión anónima.

Los errores de Auth y del middleware de sesión usan el formato común `{ message, code, field? }`; ya no devuelven el antiguo campo `error`. Se conservan los estados consumidos por Angular: `401` para credenciales/sesión inválidas y `403` para falta de permisos. Los códigos son `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `FORBIDDEN` y `USER_ALREADY_EXISTS` (registro duplicado, `409`). La validación de entrada conserva `VALIDATION_ERROR`, `formErrors` y `fieldErrors`.

## POST `/auth/login`

Autentica un usuario.

**Body:**

```json
{
  "usernameOrEmail": "nuevo@example.com",
  "password": "123456",
  "rememberMe": false
}
```

### Validaciones del body

- usernameOrEmail
  - obligatorio
  - string no vacío (mínimo 1 carácter), después de `trim()`

- password
  - obligatorio
  - string no vacío (mínimo 1 carácter)

- rememberMe
  - opcional
  - boolean
  - valor por defecto: false

**Response 200:**

```json
{
  "success": true,
  "accessToken": "string",
  "expiresAt": "2025-11-29T12:34:56.000Z",
  "user": {
    "id": 1,
    "username": "nuevo",
    "email": "nuevo@example.com",
    "roles": ["USER", "ADMIN"]
  }
}
```

---

El body de login es estricto: campos adicionales se rechazan con `400 VALIDATION_ERROR`. `rememberMe` debe ser boolean real; no se convierte desde string. Credenciales incorrectas o usuario inactivo: `401 INVALID_CREDENTIALS`.

## POST `/auth/register`

Registra un usuario activo con rol `USER`. La creación administrativa sigue disponible por separado en `POST /users` para administradores.

**Body:**

```json
{
  "username": "nuevo",
  "email": "nuevo@example.com",
  "password": "12345678"
}
```

### Validaciones del body

- username
  - obligatorio
  - string no vacío (mínimo 1 carácter)
  - máximo 100 caracteres después de `trim()`

- email
  - obligatorio
  - string con formato de email válido
  - máximo 255 caracteres después de `trim()`

- password
  - obligatorio
  - string no vacío
  - mínimo 8 caracteres

- Se aplica `trim()` a username y email; la contraseña no se recorta.
- `roles`, `isActive` y cualquier otro campo adicional se rechazan con `400`.
- El servidor siempre asigna `roles: ["USER"]` e `isActive: true`.

**Response 201:**

```json
{
  "id": 1,
  "username": "nuevo",
  "email": "nuevo@example.com",
  "roles": ["USER"],
  "isActive": true,
  "createdAt": "2025-11-29T12:34:56.000Z",
  "avatarUrl": null,
  "bio": null
}
```

---

## GET `/auth/me`

Obtiene el perfil privado del usuario autenticado.

**Headers:**
- Authorization: Bearer <token>

### Validaciones de la request

- Debe existir un token JWT válido en el header Authorization.
- El token debe contener un `sub` numérico válido.
- El usuario correspondiente al `sub` debe existir y estar activo en la base de datos.

**Response 200:**

```json
{
  "id": 1,
  "username": "nuevo",
  "email": "nuevo@example.com",
  "roles": ["USER", "ADMIN"],
  "avatarUrl": null,
  "bio": null,
  "createdAt": "2025-11-29T12:34:56.000Z",
  "stats": {
    "reviewsCount": 3,
    "reputation": {
      "upvotes": 12,
      "downvotes": 1,
      "score": 11,
      "likesRate": 0.9230769230769231
    }
  }
}
```

**Posibles errores:**

- 401 — Token ausente, inválido o expirado; `sub` inválido; usuario eliminado o inactivo.
- 404 — Usuario eliminado entre la autenticación y la consulta del perfil.
- 500 — Error interno o de infraestructura.


---

# Usuarios

Todos los endpoints protegidos usan el estado y los roles vigentes obtenidos por el middleware de sesión. El perfil público no requiere autenticación.

Los errores de Users usan el middleware común: `{ "message": "...", "code": "...", "field": "..." }` (`field` solo cuando corresponde). Las respuestas antiguas con `error` se sustituyen por este formato. Se aplican los siguientes errores comunes, además de los indicados en cada endpoint:

- `400 VALIDATION_ERROR`: body, params o query inválidos; incluye `formErrors` y `fieldErrors`.
- `401 UNAUTHENTICATED`: en rutas protegidas, token ausente/inválido o cuenta eliminada/inactiva.
- `403 FORBIDDEN`: usuario autenticado sin los permisos requeridos.
- `500 INTERNAL_ERROR`: fallo interno; no se exponen consultas ni detalles de PostgreSQL.

### Roles disponibles

- **"USER"** — puede crear reseñas, comentar, votar, editar su propio perfil.
- **"ADMIN"** — puede administrar usuarios y juegos; acceso total a endpoints administrativos.

---

## GET `/users/profile/:id`

Obtiene el perfil público de un usuario por su ID.

**Path params:**

- `id`: ID numérico del usuario.

### Validaciones de los params

- id
  - obligatorio
  - número entero
  - mayor que 0
  - máximo: 2147483647 (rango del ID `SERIAL` de PostgreSQL)

**Response 200:**

```json
{
  "id": 1,
  "username": "nuevo",
  "avatarUrl": null,
  "bio": "Jugador de RPG y aventuras.",
  "createdAt": "2025-11-29T12:34:56.000Z",
  "stats": {
    "reviewsCount": 3,
    "reputation": {
      "upvotes": 12,
      "downvotes": 1,
      "score": 11,
      "likesRate": 0.9230769230769231
    }
  }
}
```

**Notas sobre los campos:**

- `score` es upvotes menos downvotes. `likesRate` es upvotes dividido por el total de votos, sin redondeo; vale 0 si no hay votos.

- `avatarUrl` puede ser:  
  - una URL (`"https://example.com/avatar.png"`), **o**  
  - `null`

- `bio` puede ser:  
  - un string descriptivo, **o**  
  - `null`

**Posibles errores:**

- 404 `USER_NOT_FOUND` — Usuario inexistente o inactivo (no se publica su perfil)

---

## POST `/users`

Crea un nuevo usuario. Solo accesible para administradores.

**Body:**

```json
{
  "username": "nuevo",
  "email": "nuevo@example.com",
  "password": "12345678",
  "roles": ["USER"],
  "isActive": true
}
```

### Validaciones del body

- username
  - obligatorio
  - string no vacío (mínimo 1 carácter)
  - máximo 100 caracteres después de `trim()`

- email
  - obligatorio
  - string con formato de email válido
  - máximo 255 caracteres después de `trim()`

- password
  - obligatorio
  - string no vacío
  - mínimo 8 caracteres

- roles
  - obligatorio
  - array con al menos un rol
  - cada elemento debe ser un rol válido (por ejemplo: "USER", "ADMIN")

- isActive
  - opcional
  - boolean
  - valor por defecto: true

Se aplica `trim()` a username y email. No se aceptan campos adicionales. El password se almacena como hash y nunca se devuelve.

**Response 201:**

```json
{
  "id": 1,
  "username": "nuevo",
  "email": "nuevo@example.com",
  "roles": ["USER"],
  "isActive": true,
  "createdAt": "2025-11-29T12:34:56.000Z",
  "avatarUrl": null,
  "bio": null
}
```

**Posibles errores:**

- 409 `USERNAME_TAKEN`, `field: "username"` — Nombre de usuario en uso.
- 409 `EMAIL_TAKEN`, `field: "email"` — Email en uso.

Los conflictos se traducen desde la restricción de unicidad de PostgreSQL, también ante creaciones concurrentes. El formato coincide con los ejemplos de conflictos de `PATCH /users/:id`.

---

## GET `/users`

Lista usuarios con paginación. Solo accesible para administradores.

**Query params:**

- `page`: número de página (opcional; vacío o solo espacios usa el valor por defecto)
- `pageSize`: cantidad de elementos por página (opcional; vacío o solo espacios usa el valor por defecto)
- `search`: término de búsqueda por username o email (opcional)

### Validaciones de los query params

- page
  - opcional
  - número entero
  - mínimo: 1
  - valor por defecto: 1

- pageSize
  - opcional
  - número entero
  - mínimo: 1
  - máximo: 100
  - valor por defecto: 10

- search
  - opcional
  - string recortado (se hace `trim()`)
  - si se envía vacío, se ignora

La búsqueda compara username y email sin distinguir mayúsculas; el resultado se ordena por ID ascendente. Las query adicionales se ignoran. Las páginas y tamaños fraccionarios (por ejemplo, `page=1.7`) se rechazan con `400`.

**Response 200:**

```json
{
  "page": 1,
  "pageSize": 10,
  "total": 2,
  "data": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "roles": ["ADMIN", "USER"],
      "isActive": true,
      "createdAt": "2025-11-29T12:34:56.000Z",
      "avatarUrl": null,
      "bio": "Administrador del sistema"
    },
    {
      "id": 2,
      "username": "nuevo",
      "email": "nuevo@example.com",
      "roles": ["USER"],
      "isActive": true,
      "createdAt": "2025-11-29T13:00:00.000Z",
      "avatarUrl": null,
      "bio": null
    }
  ]
}
```

**Posibles errores:**

- 400 `VALIDATION_ERROR` — Query inválida.
- 500 `INTERNAL_ERROR` — Error interno al listar usuarios.


---

## GET `/users/:id`

Obtiene un usuario por su ID. Solo accesible para administradores.

**Path params:**

- `id`: ID numérico del usuario.

### Validaciones de los params

- id
  - obligatorio
  - número entero
  - mayor que 0
  - máximo: 2147483647 (rango del ID `SERIAL` de PostgreSQL)

**Response 200:**

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "roles": ["ADMIN", "USER"],
  "isActive": true,
  "createdAt": "2025-11-29T12:34:56.000Z",
  "avatarUrl": null,
  "bio": "Administrador del sistema"
}
```

**Posibles errores:**

- 404 `USER_NOT_FOUND` — Usuario no encontrado

---

## PATCH `/users/:id`

Actualiza los datos de un usuario.  
Solo puede ser ejecutado por:

- el propio usuario (dueño del perfil), o
- un administrador (`"ADMIN"`).

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `id`: ID numérico del usuario.

### Validaciones de los params

- id
  - obligatorio
  - número entero
  - mayor que 0
  - máximo: 2147483647 (rango del ID `SERIAL` de PostgreSQL)

**Body:**

```json
{
  "username": "nuevo-username",
  "email": "nuevo@example.com",
  "password": "nuevacontra123",
  "isActive": true,
  "avatarUrl": "https://example.com/avatar.png",
  "bio": "Jugador de RPG y aventuras."
}
```

### Validaciones del body

- username
  - opcional
  - string no vacío (mínimo 1 carácter)
  - máximo 100 caracteres después de `trim()`
  - se aplica `trim()`

- email
  - opcional
  - string con formato de email válido
  - máximo 255 caracteres después de `trim()`
  - se aplica `trim()`

- password
  - opcional
  - string no vacío
  - mínimo 8 caracteres

- isActive
  - opcional
  - boolean
  - solo modificable por usuarios con rol `"ADMIN"`

- avatarUrl
  - opcional
  - puede ser `null` o una URL válida
  - se aplica `trim()`

- bio
  - opcional
  - puede ser `null` o string
  - máximo 300 caracteres
  - se aplica `trim()`

### Notas adicionales del body

- El body puede enviarse vacío; en ese caso no se actualiza ningún campo.
- `avatarUrl` y `bio` vacíos o con solo espacios se ignoran; `null` elimina el valor almacenado.
- `roles` se rechaza con `400` en este endpoint, incluso para ADMIN; se modifica por `PATCH /users/:id/roles`.
- No se permiten campos adicionales fuera de los definidos en este esquema (`.strict()`).

### Reglas de autorización

- Debe existir un usuario activo autenticado (`Authorization: Bearer <token>`); los permisos se toman de PostgreSQL.
- El usuario autenticado debe ser:
  - el dueño del perfil (ID autenticado igual al `id` del path), **o**
  - tener rol `"ADMIN"`.
- Si el usuario NO es admin:
  - no puede modificar `isActive` (y tampoco otros campos administrativos).

**Response 200:**

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "roles": ["ADMIN", "USER"],
  "isActive": true,
  "createdAt": "2025-11-29T12:34:56.000Z",
  "avatarUrl": "https://example.com/avatar.png",
  "bio": "Administrador del sistema"
}
```

**Posibles errores:**

- 401 `UNAUTHENTICATED` — No autenticado
- 403 `FORBIDDEN` — No es dueño ni ADMIN, o intenta modificar `isActive` sin ser ADMIN
- 404 `USER_NOT_FOUND` — Usuario no encontrado

### Errores

**409 Conflict — Conflicto de unicidad en username o email**

Este endpoint puede devolver 409 si el nuevo username o email ya existe en la base de datos.

El backend siempre incluye:

- message: mensaje legible para el usuario final.
- code: identificador estable para lógica de frontend.
- field: campo específico en conflicto ("username" o "email").

- Ejemplos:

**Username duplicado**

```json
{
  "message": "Ese nombre de usuario ya está en uso.",
  "code": "USERNAME_TAKEN",
  "field": "username"
}
```

**Email duplicado**

```json
{
  "message": "Ese email ya está en uso.",
  "code": "EMAIL_TAKEN",
  "field": "email"
}
```

---

## PATCH `/users/:id/roles`

Actualiza los roles de un usuario.  
Solo puede ser ejecutado por usuarios con rol `"ADMIN"`.

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `id`: ID numérico del usuario.

### Validaciones de los params

- id
  - obligatorio
  - número entero
  - mayor que 0
  - máximo: 2147483647 (rango del ID `SERIAL` de PostgreSQL)

**Body:**

```json
{
  "roles": ["ADMIN", "USER"]
}
```

### Validaciones del body

- roles
  - obligatorio
  - array con al menos un rol
  - cada elemento debe ser un rol válido (por ejemplo: "USER", "ADMIN")

No se aceptan campos adicionales: se rechazan con `400 VALIDATION_ERROR`. Los roles enviados reemplazan la lista anterior; no se agregan automáticamente a ella.

### Reglas de autorización

- Debe existir un usuario activo autenticado (`Authorization: Bearer <token>`); los permisos se toman de PostgreSQL.
- El usuario autenticado debe tener actualmente el rol `"ADMIN"`.
- Usuarios sin rol `"ADMIN"` no pueden modificar roles de otros usuarios.

**Response 200:**

```json
{
  "id": 2,
  "username": "nuevo",
  "email": "nuevo@example.com",
  "roles": ["ADMIN", "USER"],
  "isActive": true,
  "createdAt": "2025-11-29T13:00:00.000Z",
  "avatarUrl": null,
  "bio": null
}
```

**Posibles errores:**

- 401 `UNAUTHENTICATED` — No autenticado
- 403 `FORBIDDEN` — Solo un administrador puede modificar roles
- 404 `USER_NOT_FOUND` — Usuario no encontrado

---

## DELETE `/users/:id`

Elimina un usuario por su ID.  
Solo puede ser ejecutado por usuarios con rol `"ADMIN"`.

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `id`: ID numérico del usuario.

### Validaciones de los params

- id
  - obligatorio
  - número entero
  - mayor que 0
  - máximo: 2147483647 (rango del ID `SERIAL` de PostgreSQL)

### Reglas de autorización

- Debe existir un usuario activo autenticado (`Authorization: Bearer <token>`); los permisos se toman de PostgreSQL.
- El usuario autenticado debe tener actualmente el rol `"ADMIN"`.

La eliminación conserva los borrados en cascada de las reseñas, comentarios y votos relacionados. Los tokens del usuario eliminado dejan de autenticar en la siguiente petición protegida.

**Response 204:**

_No content._

**Posibles errores:**

- 401 `UNAUTHENTICATED` — No autenticado
- 403 `FORBIDDEN` — Solo un administrador puede eliminar usuarios
- 404 `USER_NOT_FOUND` — Usuario no encontrado

---

# Games

Lecturas públicas; escrituras solo ADMIN vigente. Se aplican los errores comunes de validación, sesión y servidor. Los nombres son únicos con comparación exacta de PostgreSQL (no se convierten a minúsculas).

---

## POST `/games`

Crea un nuevo juego.  
Solo accesible para administradores.

**Headers:**

- Authorization: Bearer `<token>`

**Body:**

```json
{
  "name": "GTA VI",
  "description": "Juego de mundo abierto con enfoque en acción y narrativa.",
  "genre": "Acción"
}
```

### Validaciones del body

- name  
  - obligatorio  
  - string no vacío  
  - se aplica `trim()`  
  - máximo 255 caracteres  

- description  
  - obligatorio  
  - string no vacío  
  - se aplica `trim()`  

- genre  
  - obligatorio  
  - string no vacío  
  - se aplica `trim()`  
  - máximo 100 caracteres  

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- El usuario autenticado debe tener rol `"ADMIN"`.

### Reglas adicionales

- El body es estricto: solo admite `name`, `description` y `genre`.
- El nombre del juego debe ser único; si el nombre ya existe, se devuelve `409` con `code: GAME_NAME_TAKEN` y `field: name`. La restricción de la base también se traduce si el conflicto ocurre durante la escritura.

**Response 201:**

Incluye el header `Location: /api/games/<id>`, que apunta al recurso creado.

```json
{
  "id": 1,
  "name": "GTA VI",
  "description": "Juego de mundo abierto con enfoque en acción y narrativa.",
  "genre": "Acción"
}
```

**Posibles errores:**

- 400 — Datos inválidos
- 409 — El nombre ya existe (`GAME_NAME_TAKEN`)
- 401 — No autenticado  
- 403 — Solo un administrador puede crear juegos  
- 500 — Error en el servidor

---

## GET `/games/:id`

Obtiene un juego por su ID.

**Path params:**

- `id`: ID numérico del juego.

### Validaciones de los params

- id  
  - obligatorio  
  - número entero  
  - mayor que 0 y como máximo 2147483647 (`SERIAL` de PostgreSQL)

**Response 200:**

```json
{
  "id": 1,
  "name": "GTA VI",
  "description": "Juego de mundo abierto con enfoque en acción y narrativa.",
  "genre": "Acción"
}
```

**Posibles errores:**

- 404 — Juego no encontrado (`GAME_NOT_FOUND`)

---

## GET `/games`

Lista juegos con soporte de paginación, búsqueda y filtrado por género.  
Si `all = true`, devuelve **todos los juegos que coinciden con los filtros** sin paginación.

**Query params:**

- `page`: número de página (opcional)
- `limit`: cantidad de elementos por página (opcional)
- `search`: término de búsqueda por nombre o descripción (opcional)
- `genre`: filtro por género del juego (opcional)
- `all`: indica si se deben devolver todos los juegos sin paginar (opcional)

### Validaciones de los query params

- page  
  - opcional  
  - número entero  
  - mínimo: 1  
  - máximo: 2147483647
  - valor por defecto: 1  

- limit  
  - opcional  
  - número entero  
  - mínimo: 1  
  - máximo: 100  
  - valor por defecto: 20  

- search  
  - opcional  
  - string  
  - se aplica `trim()`  
  - si se envía vacío (`""`), se interpreta como no enviado  

- genre  
  - opcional  
  - string  
  - se aplica `trim()`  
  - si se envía vacío (`""`), se interpreta como no enviado  

- all  
  - opcional  
  - textos `true` o `false` en la URL (se convierten a boolean)
  - otros valores no vacíos se rechazan con `400`
  - valor por defecto: false  
  - si es `true`, `page` y `limit` no se usan para paginar, pero **se validan igualmente**; `all=true&page=1.7` devuelve 400. Se aplican `search` y `genre` al listado completo

---

La búsqueda usa ILIKE en nombre/descripción; el género se compara por igualdad exacta. Ambas modalidades ordenan por ID ascendente.

### Response 200 (modo paginado: `all = false` o no enviado)

```json
{
  "page": 1,
  "limit": 20,
  "total": 2,
  "data": [
    {
      "id": 1,
      "name": "GTA VI",
      "description": "Juego de mundo abierto con enfoque en acción y narrativa.",
      "genre": "Acción"
    },
    {
      "id": 2,
      "name": "Elden Ring",
      "description": "RPG de acción en mundo abierto con alta dificultad.",
      "genre": "RPG"
    }
  ]
}
```

### Response 200 (modo listado completo: `all = true`)

```json
[
  {
    "id": 1,
    "name": "GTA VI",
    "description": "Juego de mundo abierto con enfoque en acción y narrativa.",
    "genre": "Acción"
  },
  {
    "id": 2,
    "name": "Elden Ring",
    "description": "RPG de acción en mundo abierto con alta dificultad.",
    "genre": "RPG"
  }
]
```

**Posibles errores:**

- 500 — Error al listar juegos

---

## PATCH `/games/:id`

Actualiza parcialmente un juego existente.  
Solo accesible para administradores.

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `id`: ID numérico del juego.

### Validaciones de los params

- id  
  - obligatorio  
  - número entero  
  - mayor que 0 y como máximo 2147483647 (`SERIAL` de PostgreSQL)

**Body:**

```json
{
  "name": "GTA VI (Actualizado)",
  "description": "Juego de mundo abierto con nuevas mecánicas y contenido adicional.",
  "genre": "Acción"
}
```

> Todos los campos del body son **opcionales** (actualización parcial).

### Validaciones del body

- name  
  - opcional  
  - string no vacío  
  - se aplica `trim()`  
  - máximo 255 caracteres  

- description  
  - opcional  
  - string no vacío  
  - se aplica `trim()`  

- genre  
  - opcional  
  - string no vacío  
  - se aplica `trim()`  
  - máximo 100 caracteres  

### Notas adicionales del body

- El body puede enviarse vacío; en ese caso no se actualiza ningún campo y se devuelve el juego tal como está actualmente en la base de datos.  
- No se permiten campos adicionales fuera de `name`, `description` y `genre` (el esquema es `.strict()`).

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- El usuario autenticado debe tener rol `"ADMIN"`.

**Response 200:**

```json
{
  "id": 1,
  "name": "GTA VI (Actualizado)",
  "description": "Juego de mundo abierto con nuevas mecánicas y contenido adicional.",
  "genre": "Acción"
}
```

**Posibles errores:**

- 401 — No autenticado  
- 403 — Solo un administrador puede actualizar juegos  
- 404 — Juego no encontrado (`GAME_NOT_FOUND`)
- 400 — Body inválido (no cumple las validaciones del esquema)
- 409 — El nuevo nombre ya existe (`GAME_NAME_TAKEN`)

---

## DELETE `/games/:id`

Elimina un juego por su ID.  
Solo accesible para administradores.

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `id`: ID numérico del juego.

### Validaciones de los params

- id  
  - obligatorio  
  - número entero  
  - mayor que 0 y como máximo 2147483647 (`SERIAL` de PostgreSQL)

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- El usuario autenticado debe tener rol `"ADMIN"`.

**Response 204:**

_No content._

**Posibles errores:**

- 401 — No autenticado  
- 403 — Solo un administrador puede eliminar juegos  
- 404 — Juego no encontrado (`GAME_NOT_FOUND`)

---

# Home

Ambas rutas son públicas y no personalizan por JWT. Conservan `count` como cantidad de `items` devueltos, no como total paginado.

## GET `/home/top-games`

Obtiene un listado de los juegos mejor valorados, ordenados por puntaje promedio y cantidad de reseñas.

**Query params:**

- `limit`: cantidad máxima de juegos a devolver (opcional)
- `minReviews`: cantidad mínima de reseñas que debe tener un juego para ser considerado (opcional)

### Validaciones de los query params

- `limit`: entero entre 1 y 50; default 10 solo si no se envía.
- `minReviews`: entero >= 0; default 1 solo si no se envía. Con 0 se admiten juegos sin reseñas (`avgScore: 0`, `reviewCount: 0`).
- Valores presentes inválidos, vacíos, repetidos, fraccionarios o fuera de rango devuelven `400 VALIDATION_ERROR`. Las query adicionales se ignoran.
- Orden: promedio descendente, cantidad de reseñas descendente y nombre ascendente para desempatar. Se conserva el promedio numérico sin redondearlo en la API.

**Response 200:**

```json
{
  "limit": 10,
  "minReviews": 1,
  "count": 2,
  "items": [
    {
      "id": 1,
      "name": "GTA VI",
      "genre": "Acción",
      "avgScore": 4.8,
      "reviewCount": 25
    },
    {
      "id": 2,
      "name": "Elden Ring",
      "genre": "RPG",
      "avgScore": 4.6,
      "reviewCount": 40
    }
  ]
}
```

**Posibles errores:**

- 400 — VALIDATION_ERROR (query inválido)
- 500 — INTERNAL_ERROR

---

## GET `/home/trending-reviews`

Obtiene las reseñas más relevantes ("trending") en una ventana de tiempo reciente, ordenadas por score de votos y fecha de creación.

**Query params:**

- `limit`: cantidad máxima de reseñas a devolver (opcional)
- `days`: cantidad de días hacia atrás a considerar para calcular reseñas trending (opcional)

### Validaciones de los query params

- `limit`: entero entre 1 y 50; default 10 solo si no se envía.
- `days`: entero entre 1 y 30; default 7 solo si no se envía.
- Valores presentes inválidos, vacíos, repetidos, fraccionarios o fuera de rango devuelven `400 VALIDATION_ERROR`. Las query adicionales se ignoran.
- La ventana temporal se aplica tanto a la creación de la reseña como a la creación de los votos sumados. Orden: `voteScore` descendente y fecha de reseña descendente. Sin votos, `voteScore` vale 0.
- Devuelve usuario básico sin email. No incluye `userVote`, cantidad de comentarios ni un summary desglosado de votos; esos datos están disponibles en los endpoints de Reviews.

**Response 200:**

```json
{
  "limit": 10,
  "days": 7,
  "count": 2,
  "items": [
    {
      "id": 5,
      "content": "Juego muy sólido, me encantó el combate y la historia.",
      "score": 5,
      "createdAt": "2025-11-28T18:30:00.000Z",
      "voteScore": 12,
      "user": {
        "id": 1,
        "username": "nuevo"
      },
      "game": {
        "id": 1,
        "name": "GTA VI",
        "genre": "Acción"
      }
    },
    {
      "id": 7,
      "content": "Muy desafiante pero súper gratificante cuando le agarrás la mano.",
      "score": 4,
      "createdAt": "2025-11-27T20:10:00.000Z",
      "voteScore": 9,
      "user": {
        "id": 2,
        "username": "juan"
      },
      "game": {
        "id": 2,
        "name": "Elden Ring",
        "genre": "RPG"
      }
    }
  ]
}
```

**Posibles errores:**

- 400 — VALIDATION_ERROR (query inválido)
- 500 — INTERNAL_ERROR

---

# Reviews

Las respuestas de Reviews con autor relacionado (`user`) contienen únicamente `id` y `username`; no exponen email. Esto incluye listados, `/me`, `/details` y `/full`. Se conserva `votes.reviewId`.

Los errores usan el formato común `{ message, code, field? }`: `VALIDATION_ERROR` (400, con `formErrors`/`fieldErrors`), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `REVIEW_NOT_FOUND` (404) e `INTERNAL_ERROR` (500, sin detalles internos). Las rutas protegidas usan estado y roles vigentes; las rutas con autenticación opcional tratan una sesión inválida como anónima y propagan fallos de infraestructura como 500.

Los IDs de reseña, juego y usuario, en params/body/filtros de Reviews, deben ser enteros de 1 a 2147483647; fuera de rango se devuelve 400.

---

Los listados conservan `{ page, pageSize, total, data }`, orden ascendente por ID, page=1 y pageSize=10 por defecto, máximo 100. Sus parámetros vacíos o con espacios se tratan como omitidos; fracciones en page/pageSize devuelven 400. La búsqueda compara contenido, nombre de juego y username sin distinguir mayúsculas. `/me` valida el mismo query, pero siempre reemplaza cualquier userId suministrado por el usuario autenticado; no permite consultar reseñas ajenas. Query adicionales se ignoran.

### Campo `userVote` (voto del usuario actual)

En varios endpoints de lectura de reviews se incluye el campo:

- `userVote`: `-1 | 0 | 1`

Representa el voto del **usuario autenticado actual** sobre esa review:

- `1`  → el usuario hizo upvote.
- `-1` → el usuario hizo downvote.
- `0`  → el usuario no votó esa review.

Reglas:

- Si **no hay usuario autenticado** (no se envía JWT válido):
  - El backend devuelve siempre `userVote: 0`.
- Si hay usuario autenticado:
  - Si nunca votó esa review → `userVote: 0`.
  - Si votó → `userVote: -1` o `1` según corresponda.

---

## GET `/reviews/me`

Lista las reseñas creadas por el usuario autenticado, con paginación y opción de filtrar por juego.

**Headers:**

- Authorization: Bearer `<token>`

**Query params:**

- `page`: número de página (opcional)
- `pageSize`: cantidad de reseñas por página (opcional)
- `gameId`: ID del juego para filtrar reseñas por juego (opcional)
- `search`: término de búsqueda por contenido de la reseña, nombre de juego y username (opcional)

### Validaciones de los query params

- page  
  - opcional  
  - número entero  
  - mínimo: 1  
  - valor por defecto: 1  

- pageSize  
  - opcional  
  - número entero  
  - mínimo: 1  
  - máximo: 100
  - valor por defecto: 10  

- gameId  
  - opcional  
  - número entero  
  - mayor que 0; máximo 2147483647

- search  
  - opcional  
  - string  
  - se aplica `trim()`  
  - si se envía vacío (`""`), se interpreta como no enviado  
  - filtra las reseñas cuyo `content` contenga ese texto, nombre de juego o username (búsqueda case-insensitive)

> Nota: la ruta solo devuelve reseñas del usuario autenticado (`userId` = `sub` del token).  
> El filtro `gameId` se aplica sobre ese conjunto (reseñas propias).

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- Si no hay usuario autenticado, se devuelve `401`.

**Response 200:**

```json
{
  "page": 1,
  "pageSize": 10,
  "total": 2,
  "data": [
    {
      "id": 5,
      "gameId": 1,
      "userId": 1,
      "content": "Juego muy sólido, me gustó mucho el combate.",
      "score": 5,
      "createdAt": "2025-11-26T20:51:21.877Z",
      "updatedAt": null,
      "user": {
        "id": 1,
        "username": "nuevo"
      },
      "game": {
        "id": 1,
        "name": "GTA VI",
        "genre": "Acción"
      },
      "comments": 3,
      "votes": {
        "reviewId": 5,
        "upvotes": 10,
        "downvotes": 2,
        "score": 8
      },
      "userVote": 1
    },
    {
      "id": 6,
      "gameId": 2,
      "userId": 1,
      "content": "Muy desafiante pero muy satisfactorio cuando le agarrás la mano.",
      "score": 4,
      "createdAt": "2025-11-27T15:10:00.000Z",
      "updatedAt": null,
      "user": {
        "id": 1,
        "username": "nuevo"
      },
      "game": {
        "id": 2,
        "name": "Elden Ring",
        "genre": "RPG"
      },
      "comments": 1,
      "votes": {
        "reviewId": 6,
        "upvotes": 5,
        "downvotes": 0,
        "score": 5
      },
      "userVote": 0
    }
  ]
}
```

Donde:

- `comments`: cantidad total de comentarios que tiene la reseña.  
- `votes`:
  - `reviewId`: id de la reseña a la que pertenecen estos votos  
  - `upvotes`: cantidad de votos positivos  
  - `downvotes`: cantidad de votos negativos  
  - `score`: `upvotes - downvotes`  

- `userVote`:
  - `1` → el usuario autenticado dio upvote  
  - `-1` → el usuario autenticado dio downvote  
  - `0` → el usuario autenticado no votó esta reseña  

**Posibles errores:**

- 401 — No autenticado  
- 500 `INTERNAL_ERROR` — Error interno del servidor

---

## POST `/reviews`

Crea una nueva reseña para un juego.  
Requiere usuario autenticado.

**Headers:**

- Authorization: Bearer `<token>`

**Body:**

```json
{
  "gameId": 1,
  "content": "Juego muy sólido, me gustó mucho el combate.",
  "score": 5
}
```

### Validaciones del body

- gameId  
  - obligatorio  
  - número entero  
  - mayor que 0; máximo 2147483647

- content  
  - obligatorio  
  - string no vacío  
  - se aplica `trim()`  

- score  
  - obligatorio  
  - número entero  
  - mínimo: 1  
  - máximo: 5  

### Notas adicionales del body

- No se permiten campos adicionales fuera de `gameId`, `content` y `score` (el esquema es `.strict()`).

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- El `userId` se toma del token (`sub`); no se envía en el body.

**Response 201:**

```json
{
  "id": 10,
  "gameId": 1,
  "userId": 1,
  "content": "Juego muy sólido, me gustó mucho el combate.",
  "score": 5,
  "createdAt": "2025-11-26T20:51:21.877Z",
  "updatedAt": null
}
```

**Posibles errores:**

- 404 `GAME_NOT_FOUND`, `field: "gameId"` — El juego indicado no existe (antes producía un error interno).
- 404 `USER_NOT_FOUND`, `field: "userId"` — La cuenta referenciada desapareció antes de persistir la operación.

- 400 — Datos inválidos  
- 401 — No autenticado  
- 500 `INTERNAL_ERROR` — Error interno del servidor

---

## GET `/reviews/:id`

Obtiene una reseña por su ID.

**Path params:**

- `id`: ID numérico de la reseña.

### Validaciones de los params

- id  
  - obligatorio  
  - número entero  
  - mayor que 0; máximo 2147483647

**Response 200:**

```json
{
  "id": 10,
  "gameId": 1,
  "userId": 1,
  "content": "Juego muy sólido, me gustó mucho el combate.",
  "score": 5,
  "createdAt": "2025-11-26T20:51:21.877Z",
  "updatedAt": null
}
```

**Posibles errores:**

- 404 `REVIEW_NOT_FOUND` — Reseña no encontrada

---

## GET `/reviews`

Lista reseñas con paginación y permite filtrar por juego y/o usuario.  
El endpoint es público, pero si se envía un JWT válido también incluye el campo `userVote` para el usuario autenticado.

**Headers (opcional):**

- Authorization: Bearer `<token>`

Si no se envía header `Authorization`, o el token es inválido, la request se trata como **no autenticada** y `userVote` será siempre `0`.

**Query params:**

- `page`: número de página (opcional)
- `pageSize`: cantidad de reseñas por página (opcional)
- `gameId`: ID del juego para filtrar reseñas de ese juego (opcional)
- `userId`: ID del usuario para filtrar reseñas de ese usuario (opcional)
- `search`: término de búsqueda por contenido de la reseña, nombre de juego y username (opcional)

### Validaciones de los query params

- page  
  - opcional  
  - número entero  
  - mínimo: 1  
  - valor por defecto: 1  

- pageSize  
  - opcional  
  - número entero  
  - mínimo: 1  
  - máximo: 100  
  - valor por defecto: 10  

- gameId  
  - opcional  
  - número entero  
  - mayor que 0; máximo 2147483647

- userId  
  - opcional  
  - número entero  
  - mayor que 0; máximo 2147483647

- search  
  - opcional  
  - string  
  - se aplica `trim()`  
  - si se envía vacío (`""`), se interpreta como no enviado  
  - filtra las reseñas cuyo `content` contenga ese texto, nombre de juego o username (búsqueda case-insensitive)

> Notas:
> - Si no se envían `gameId` ni `userId`, se listan reseñas de todos los juegos y usuarios.
> - Si se envía `Authorization` con un token válido, se calcula `userVote` para ese usuario; de lo contrario, `userVote` será `0` en todas las reseñas.

**Response 200:**

```json
{
  "page": 1,
  "pageSize": 10,
  "total": 2,
  "data": [
    {
      "id": 5,
      "gameId": 1,
      "userId": 1,
      "content": "Juego muy sólido, me gustó mucho el combate.",
      "score": 5,
      "createdAt": "2025-11-26T20:51:21.877Z",
      "updatedAt": null,
      "user": {
        "id": 1,
        "username": "nuevo"
      },
      "game": {
        "id": 1,
        "name": "GTA VI",
        "genre": "Acción"
      },
      "comments": 3,
      "votes": {
        "reviewId": 5,
        "upvotes": 10,
        "downvotes": 2,
        "score": 8
      },
      "userVote": 1
    },
    {
      "id": 6,
      "gameId": 2,
      "userId": 2,
      "content": "Muy desafiante pero muy satisfactorio cuando le agarrás la mano.",
      "score": 4,
      "createdAt": "2025-11-27T15:10:00.000Z",
      "updatedAt": null,
      "user": {
        "id": 2,
        "username": "juan"
      },
      "game": {
        "id": 2,
        "name": "Elden Ring",
        "genre": "RPG"
      },
      "comments": 1,
      "votes": {
        "reviewId": 6,
        "upvotes": 5,
        "downvotes": 0,
        "score": 5
      },
      "userVote": 0
    }
  ]
}
```

Donde:

- `comments`: cantidad total de comentarios de la reseña.  
- `votes`:
  - `reviewId`: id de la reseña a la que pertenecen estos votos  
  - `upvotes`: cantidad de votos positivos  
  - `downvotes`: cantidad de votos negativos  
  - `score`: `upvotes - downvotes`  

- `userVote`:
  - `1`  → el usuario autenticado hizo upvote  
  - `-1` → el usuario autenticado hizo downvote  
  - `0`  → el usuario autenticado no votó esa reseña, o no hay usuario autenticado  

**Posibles errores:**

- 500 `INTERNAL_ERROR` — Error interno del servidor

---

## GET `/reviews/:id/details`

Obtiene una reseña con información del usuario que la creó y del juego al que pertenece.

**Path params:**

- `id`: ID numérico de la reseña.

### Validaciones de los params

- id  
  - obligatorio  
  - número entero  
  - mayor que 0; máximo 2147483647

**Response 200:**

```json
{
  "id": 10,
  "content": "Juego muy sólido, me gustó mucho el combate.",
  "score": 5,
  "createdAt": "2025-11-26T20:51:21.877Z",
  "updatedAt": null,
  "user": {
    "id": 1,
    "username": "nuevo"
  },
  "game": {
    "id": 1,
    "name": "GTA VI",
    "genre": "Acción"
  }
}
```

**Posibles errores:**

- 404 `REVIEW_NOT_FOUND` — Reseña no encontrada

---

## GET `/reviews/:id/full`

Obtiene el detalle completo de una reseña, incluyendo:

- datos de la reseña,
- información del usuario que la creó,
- información del juego,
- comentarios paginados,
- resumen de votos,
- y el `userVote` del usuario autenticado (si lo hay).

**Headers (opcional):**

- Authorization: Bearer `<token>`

Si no se envía header `Authorization`, o el token es inválido, la request se trata como **no autenticada** y `userVote` será `0`.

**Path params:**

- `id`: ID numérico de la reseña.

### Validaciones de los params

- id  
  - obligatorio  
  - número entero  
  - mayor que 0; máximo 2147483647

**Query params (comentarios):**

- `commentsPage`: número de página de comentarios (opcional)
- `commentsPageSize`: cantidad de comentarios por página (opcional)

### Validaciones de los query params

- commentsPage  
  - opcional  
  - un único valor numérico entero (no arrays ni parámetros repetidos)
  - mínimo: 1  
  - valor por defecto: 1  
  - vacío, fraccionario, no numérico o `< 1` devuelve `400 VALIDATION_ERROR`

- commentsPageSize  
  - opcional  
  - un único valor numérico entero (no arrays ni parámetros repetidos)
  - mínimo: 1  
  - máximo: 100  
  - valor por defecto: 10  
  - vacío, fraccionario, no numérico, `< 1` o `> 100` devuelve `400 VALIDATION_ERROR`

> Los defaults se aplican solo si el parámetro no se envía. Por ejemplo, `commentsPage=1.7`, `commentsPage=-1` o `commentsPageSize=abc` devuelven 400. Los query adicionales se ignoran.

---

**Body:**

_No requiere body._

---

**Response 200:**

```json
{
  "reviewId": 10,
  "review": {
    "id": 10,
    "content": "Juego muy sólido, me gustó mucho el combate.",
    "score": 5,
    "createdAt": "2025-11-26T20:51:21.877Z",
    "updatedAt": null,
    "user": {
      "id": 1,
      "username": "nuevo"
    },
    "game": {
      "id": 1,
      "name": "GTA VI",
      "genre": "Acción"
    }
  },
  "comments": {
    "page": 1,
    "pageSize": 10,
    "total": 2,
    "data": [
      {
        "id": 1,
        "reviewId": 10,
        "content": "Totalmente de acuerdo, el combate está muy bien logrado.",
        "createdAt": "2025-11-27T10:00:00.000Z",
        "updatedAt": null,
        "user": {
          "id": 2,
          "username": "juan"
        }
      },
      {
        "id": 2,
        "reviewId": 10,
        "content": "A mí me gustó más la historia que el combate.",
        "createdAt": "2025-11-27T11:30:00.000Z",
        "updatedAt": null,
        "user": {
          "id": 3,
          "username": "maria"
        }
      }
    ]
  },
  "votes": {
    "reviewId": 10,
    "upvotes": 10,
    "downvotes": 2,
    "score": 8
  },
  "userVote": 1
}
```

Donde:

- `comments.total`: cantidad total de comentarios que tiene la reseña.  
- `comments.data`: página de comentarios según `commentsPage` y `commentsPageSize`, ordenados por fecha de creación ascendente e ID ascendente para desempatar.
- `votes`:
  - `reviewId`: id de la reseña a la que pertenecen estos votos  
  - `upvotes`: cantidad de votos positivos  
  - `downvotes`: cantidad de votos negativos  
  - `score`: `upvotes - downvotes`  

- `userVote`:
  - `1`  → el usuario autenticado hizo upvote  
  - `-1` → el usuario autenticado hizo downvote  
  - `0`  → el usuario autenticado no votó esta reseña, o no hay usuario autenticado  

**Posibles errores:**

- 400 `VALIDATION_ERROR` — Params/query inválidos
- 404 `REVIEW_NOT_FOUND` — Reseña no encontrada
- 500 `INTERNAL_ERROR` — Internal server error

---

## PATCH `/reviews/:id`

Actualiza parcialmente una reseña existente.  
Solo puede ser ejecutado por:

- el autor de la reseña, o  
- un usuario con rol `"ADMIN"`.

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `id`: ID numérico de la reseña.

### Validaciones de los params

- id  
  - obligatorio  
  - número entero  
  - mayor que 0; máximo 2147483647

**Body:**

```json
{
  "gameId": 1,
  "content": "Actualicé mi opinión después de jugar más horas.",
  "score": 4
}
```

> Todos los campos del body son **opcionales** (actualización parcial).

### Validaciones del body

- gameId  
  - opcional  
  - número entero  
  - mayor que 0; máximo 2147483647

- content  
  - opcional  
  - string no vacío  
  - se aplica `trim()`  

- score  
  - opcional  
  - número entero  
  - mínimo: 1  
  - máximo: 5  

### Notas adicionales del body

- Si se actualiza al menos un campo, cambia `updatedAt`; `createdAt` y el autor se conservan.
- El body puede enviarse vacío; en ese caso:
  - no se actualiza ningún campo,
  - se devuelve la reseña tal como está actualmente en la base de datos.
- No se permiten campos adicionales fuera de `gameId`, `content` y `score` (el esquema es `.strict()`).
- El `userId` **no** se puede modificar desde este endpoint; solo se actualizan los campos de la reseña definidos en el esquema.

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- Se obtiene la reseña actual:
  - si no existe → `404 Reseña no encontrada`.  
- Solo se permite continuar si:
  - el usuario autenticado es el dueño de la reseña (`existing.userId === sub`), **o**
  - el usuario tiene rol `"ADMIN"`.  
- Si no se cumple lo anterior → `403 FORBIDDEN`, con mensaje `No autorizado para modificar o eliminar esta reseña`.

**Response 200:**

```json
{
  "id": 10,
  "gameId": 1,
  "userId": 1,
  "content": "Actualicé mi opinión después de jugar más horas.",
  "score": 4,
  "createdAt": "2025-11-26T20:51:21.877Z",
  "updatedAt": "2025-11-29T18:30:00.000Z"
}
```

**Posibles errores:**

- 404 `GAME_NOT_FOUND`, `field: "gameId"` — El juego indicado no existe (antes producía un error interno).

- 400 — Datos inválidos  
- 401 — No autenticado  
- 403 `FORBIDDEN` — No autorizado para modificar o eliminar esta reseña
- 404 `REVIEW_NOT_FOUND` — Reseña no encontrada
- 500 `INTERNAL_ERROR` — Error interno del servidor

---

## DELETE `/reviews/:id`

Elimina una reseña por su ID.  
Solo puede ser ejecutado por:

- el autor de la reseña, o  
- un usuario con rol `"ADMIN"`.

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `id`: ID numérico de la reseña.

### Validaciones de los params

- id  
  - obligatorio  
  - número entero  
  - mayor que 0; máximo 2147483647

**Body:**

_No requiere body._

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- Se busca primero la reseña:
  - si no existe → `404 Reseña no encontrada`.  
- Solo se permite eliminar si:
  - el usuario autenticado es el dueño de la reseña (`existing.userId === sub`), **o**
  - el usuario tiene rol `"ADMIN"`.  
- Si no se cumple lo anterior → `403 FORBIDDEN`, con mensaje `No autorizado para modificar o eliminar esta reseña`.

**Response 204:**

_No content._

**Posibles errores:**

- 401 — No autenticado  
- 403 `FORBIDDEN` — No autorizado para modificar o eliminar esta reseña
- 404 `REVIEW_NOT_FOUND` — Reseña no encontrada
- 500 `INTERNAL_ERROR` — Error interno del servidor

---

# Comentarios de Reviews

Todos los IDs de estas rutas (`reviewId`, `commentId`) deben ser enteros entre **1 y 2147483647** (rango positivo de `SERIAL`). Se convierten desde el path; los valores fuera de rango devuelven 400.

Los errores usan el middleware común:

- `400 VALIDATION_ERROR`: `{ message: "Validation error", code, formErrors, fieldErrors }`.
- `401 UNAUTHENTICATED`: sesión ausente, inválida o usuario desactivado en rutas protegidas; mensaje `No autenticado o sesión inválida`.
- `403 FORBIDDEN`: sesión válida sin permiso de dueño o ADMIN; se conservan los mensajes específicos de modificación/borrado de comentarios.
- `404 COMMENT_NOT_FOUND`: `Comment not found`; comentario inexistente o que pertenece a otra review.
- `404 REVIEW_NOT_FOUND`: `Review not found`, con `field: "reviewId"`, cuando se intenta crear un comentario o voto sobre una review inexistente.
- `404 USER_NOT_FOUND`: `User not found`, con `field: "userId"`, si el usuario fue eliminado entre la autenticación y la escritura.
- `500 INTERNAL_ERROR`: `Internal server error`, sin detalles internos. JSON mal formado devuelve `400 INVALID_JSON` y un body demasiado grande `413 PAYLOAD_TOO_LARGE`.

Los errores de dominio tienen la forma `{ message, code, field? }`. Los roles se toman del usuario vigente en PostgreSQL mediante Auth, no de permisos antiguos del JWT. Los listados de comentarios son públicos; GET de votos usa autenticación opcional.

## POST `/reviews/:reviewId/comments`

Crea un nuevo comentario en una reseña.  
Requiere usuario autenticado.

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `reviewId`: ID numérico de la reseña.

### Validaciones de los params

- reviewId  
  - obligatorio  
  - número entero  
  - entre 1 y 2147483647

**Body:**

```json
{
  "content": "Totalmente de acuerdo, el combate está muy bien logrado."
}
```

### Validaciones del body

- content  
  - obligatorio  
  - string no vacío  
  - se aplica `trim()`  
  - mensaje de error base: `"content is required"` cuando está vacío

### Notas adicionales del body

- No se permiten campos adicionales fuera de `content` (el esquema es `.strict()`).  
- El `userId` se toma del token (`sub`); no se envía en el body.  
- El `reviewId` se toma del path param; tampoco se envía en el body.

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- Si no hay usuario autenticado → `401 UNAUTHENTICATED`.

**Response 201:**

```json
{
  "id": 3,
  "reviewId": 10,
  "userId": 1,
  "content": "Totalmente de acuerdo, el combate está muy bien logrado.",
  "createdAt": "2025-11-27T10:00:00.000Z",
  "updatedAt": null
}
```

**Posibles errores:**

- 400 — VALIDATION_ERROR (errores de validación del body/params)
- 401 — UNAUTHENTICATED
- 404 — REVIEW_NOT_FOUND (field: reviewId) o USER_NOT_FOUND (field: userId)
- 500 — INTERNAL_ERROR

---

## GET `/reviews/:reviewId/comments`

Lista comentarios de una reseña, con paginación simple.

**Path params:**

- `reviewId`: ID numérico de la reseña.

### Validaciones de los params

- reviewId  
  - obligatorio  
  - número entero  
  - entre 1 y 2147483647

**Query params:**

- `page`: número de página (opcional)
- `pageSize`: cantidad de comentarios por página (opcional)

### Validaciones de los query params

- page  
  - opcional  
  - número entero  
  - mínimo: 1  
  - valor por defecto: 1  

- pageSize  
  - opcional  
  - número entero  
  - mínimo: 1  
  - máximo: 100
  - valor por defecto: 10  

Los defaults también se aplican a query vacíos o con espacios, como antes. `page=1.7`, `pageSize=101`, negativos o texto inválido devuelven 400. Query adicionales se ignoran. El orden es `createdAt ASC, id ASC`: el ID desempata fechas iguales y evita un orden ambiguo entre páginas.

**Body:**

_No requiere body._

**Response 200:**

```json
{
  "reviewId": 10,
  "page": 1,
  "pageSize": 10,
  "data": [
    {
      "id": 1,
      "reviewId": 10,
      "userId": 2,
      "content": "Totalmente de acuerdo, el combate está muy bien logrado.",
      "createdAt": "2025-11-27T10:00:00.000Z",
      "updatedAt": null
    },
    {
      "id": 2,
      "reviewId": 10,
      "userId": 3,
      "content": "A mí me enganchó más la historia que el gameplay.",
      "createdAt": "2025-11-27T11:30:00.000Z",
      "updatedAt": null
    }
  ]
}
```

> Nota: si no hay comentarios, la review no existe o la página excede el listado, devuelve 200 con `data: []`. Este endpoint conserva su respuesta sin `count` ni `total`.

**Posibles errores:**

- 400 — VALIDATION_ERROR (validación de params/query)
- 500 — INTERNAL_ERROR

---

## GET `/reviews/:reviewId/comments/details`

Lista comentarios de una reseña, incluyendo la información básica del usuario que hizo cada comentario, con paginación simple.

**Path params:**

- `reviewId`: ID numérico de la reseña.

### Validaciones de los params

- reviewId  
  - obligatorio  
  - número entero  
  - entre 1 y 2147483647

**Query params:**

- `page`: número de página (opcional)
- `pageSize`: cantidad de comentarios por página (opcional)

### Validaciones de los query params

- page  
  - opcional  
  - número entero  
  - mínimo: 1  
  - valor por defecto: 1  

- pageSize  
  - opcional  
  - número entero  
  - mínimo: 1  
  - máximo: 100
  - valor por defecto: 10  

Los defaults también se aplican a query vacíos o con espacios, como antes. `page=1.7`, `pageSize=101`, negativos o texto inválido devuelven 400. Query adicionales se ignoran. El orden es `createdAt ASC, id ASC`: el ID desempata fechas iguales y evita un orden ambiguo entre páginas.

**Body:**

_No requiere body._

**Response 200:**

```json
{
  "reviewId": 10,
  "page": 1,
  "pageSize": 10,
  "count": 2,
  "total": 2,
  "data": [
    {
      "id": 1,
      "reviewId": 10,
      "content": "Totalmente de acuerdo, el combate está muy bien logrado.",
      "createdAt": "2025-11-27T10:00:00.000Z",
      "updatedAt": null,
      "user": {
        "id": 2,
        "username": "juan"
      }
    },
    {
      "id": 2,
      "reviewId": 10,
      "content": "A mí me enganchó más la historia que el gameplay.",
      "createdAt": "2025-11-27T11:30:00.000Z",
      "updatedAt": null,
      "user": {
        "id": 3,
        "username": "maria"
      }
    }
  ]
}
```

Donde:

- `total`: cantidad total de comentarios de la reseña, independientemente de la página. Angular debe priorizar `total` sobre `count` para paginar.
- `count`: cantidad de comentarios devueltos en esta página (igual a `data.length`).  
- `data`: lista de comentarios con información del usuario que los creó.

**Posibles errores:**

- 400 — VALIDATION_ERROR (errores de validación en params/query)
- 500 — INTERNAL_ERROR

Si la review no existe, devuelve 200 con `data: []`, `count: 0` y `total: 0`. Una página fuera del listado conserva el total real, con `count: 0` y `data: []`.

---

## PATCH `/reviews/:reviewId/comments/:commentId`

Actualiza parcialmente el contenido de un comentario de una reseña.  
Solo puede ser ejecutado por:

- el autor del comentario, o  
- un usuario con rol `"ADMIN"`.

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `reviewId`: ID numérico de la reseña.
- `commentId`: ID numérico del comentario.

### Validaciones de los params

- reviewId  
  - obligatorio  
  - número entero  
  - entre 1 y 2147483647

- commentId  
  - obligatorio  
  - número entero  
  - entre 1 y 2147483647

**Body:**

```json
{
  "content": "Edité mi comentario después de pensarlo mejor."
}
```

> Todos los campos del body son **opcionales** (actualización parcial).

### Validaciones del body

- content  
  - opcional  
  - string no vacío  
  - se aplica `trim()`  
  - mensaje base: `"content is required"` cuando está vacío  

### Notas adicionales del body

- El body puede enviarse vacío; en ese caso:
  - no se actualiza ningún campo,
  - se devuelve el comentario tal como está actualmente en la base de datos.
- No se permiten campos adicionales fuera de `content` (el esquema es `.strict()`).

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- Se busca el comentario por `commentId`:
  - si no existe, o su `reviewId` no coincide con el del path → `404 COMMENT_NOT_FOUND`.
- Solo se permite continuar si:
  - el usuario autenticado es el dueño del comentario (`existing.userId === sub`), **o**
  - el usuario tiene rol `"ADMIN"`.  
- Si no se cumple lo anterior → `403 Not authorized to modify this comment`.

**Response 200:**

```json
{
  "id": 3,
  "reviewId": 10,
  "userId": 1,
  "content": "Edité mi comentario después de pensarlo mejor.",
  "createdAt": "2025-11-27T10:00:00.000Z",
  "updatedAt": "2025-11-27T12:15:00.000Z"
}
```

**Posibles errores:**

- 400 — VALIDATION_ERROR (errores de validación en params/body)
- 401 — UNAUTHENTICATED
- 403 — FORBIDDEN: Not authorized to modify this comment
- 404 — COMMENT_NOT_FOUND: Comment not found
- 500 — INTERNAL_ERROR

---

## DELETE `/reviews/:reviewId/comments/:commentId`

Elimina un comentario de una reseña.  
Solo puede ser ejecutado por:

- el autor del comentario, o  
- un usuario con rol `"ADMIN"`.

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `reviewId`: ID numérico de la reseña.
- `commentId`: ID numérico del comentario.

### Validaciones de los params

- reviewId  
  - obligatorio  
  - número entero  
  - entre 1 y 2147483647

- commentId  
  - obligatorio  
  - número entero  
  - entre 1 y 2147483647

**Body:**

_No requiere body._

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- Se busca el comentario por `commentId`:
  - si no existe, o su `reviewId` no coincide con el del path → `404 COMMENT_NOT_FOUND`.
- Solo se permite eliminar si:
  - el usuario autenticado es el dueño del comentario (`existing.userId === sub`), **o**
  - el usuario tiene rol `"ADMIN"`.  
- Si no se cumple lo anterior → `403 Not authorized to delete this comment`.

Si la operación se realiza correctamente:

**Response 204:**

_No content._

**Posibles errores:**

- 400 — VALIDATION_ERROR (params inválidos)
- 401 — UNAUTHENTICATED
- 403 — FORBIDDEN: Not authorized to delete this comment
- 404 — COMMENT_NOT_FOUND: Comment not found
- 500 — INTERNAL_ERROR

---

# Votos de Reviews

## GET `/reviews/:reviewId/votes`

Obtiene el resumen de votos de una reseña, incluyendo el voto del usuario autenticado (si lo hay).

**Headers (opcional):**

- Authorization: Bearer `<token>`

Si no se envía header `Authorization`, o el token es inválido, la request se trata como **no autenticada** y `userVote` será `0`.

**Path params:**

- `reviewId`: ID numérico de la reseña.

### Validaciones de los params

- reviewId  
  - obligatorio  
  - número entero  
  - entre 1 y 2147483647

**Body:**

_No requiere body._

---

**Response 200:**

```json
{
  "reviewId": 10,
  "upvotes": 12,
  "downvotes": 3,
  "score": 9,
  "userVote": 1
}
```

Donde:

- `reviewId`: ID de la reseña.
- `upvotes`: cantidad de votos positivos (`value = 1`).
- `downvotes`: cantidad de votos negativos (`value = -1`).
- `score`: suma total de los valores de voto (`upvotes - downvotes`).
- `userVote`:
  - `1`  → el usuario autenticado hizo upvote  
  - `-1` → el usuario autenticado hizo downvote  
  - `0`  → el usuario autenticado no votó la reseña, o no hay usuario autenticado  

Una review inexistente conserva el resultado 200 con `reviewId` solicitado y todos los contadores y `userVote` en 0. Una sesión inválida o desactivada se trata como anónima; un fallo de infraestructura devuelve 500.

**Posibles errores:**

- 400 — VALIDATION_ERROR (params inválidos)
- 500 — INTERNAL_ERROR

---

## POST `/reviews/:reviewId/votes`

Crea o actualiza (upsert) el voto de un usuario sobre una reseña.  
Si el usuario ya había votado esa reseña, el voto se actualiza.

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `reviewId`: ID numérico de la reseña.

### Validaciones de los params

- reviewId  
  - obligatorio  
  - número entero  
  - entre 1 y 2147483647

**Body:**

```json
{
  "value": 1
}
```

### Validaciones del body

- value  
  - obligatorio  
  - solo se aceptan los valores:
    - `1`  → upvote  
    - `-1` → downvote  

### Notas adicionales del body

- No se permiten campos adicionales fuera de `value` (el esquema es `.strict()`).
- No se acepta `0` ni strings como `"1"` como valor; para quitar el voto se usa `DELETE /reviews/:reviewId/votes`.
- El `userId` **no** se envía en el body:
  - se obtiene del token JWT (`sub` del usuario autenticado).

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- Si no hay usuario autenticado → `401 UNAUTHENTICATED`.
- Si la `reviewId` no existe (violación de foreign key en BD) → `404 REVIEW_NOT_FOUND`, con `field: "reviewId"`.

---

**Response 200:**

```json
{
  "reviewId": 10,
  "userId": 1,
  "value": 1,
  "upvotes": 12,
  "downvotes": 3,
  "score": 9
}
```

Donde:

- `reviewId`: ID de la reseña votada.
- `userId`: ID del usuario que realizó el voto.
- `value`: voto actual del usuario sobre la reseña (`1` o `-1`).
- `upvotes`: cantidad total de votos positivos de la reseña.
- `downvotes`: cantidad total de votos negativos de la reseña.
- `score`: suma total de los votos (`upvotes - downvotes`).

**Posibles errores:**

- 400 — VALIDATION_ERROR (errores de validación en params/body)
- 401 — UNAUTHENTICATED
- 404 — REVIEW_NOT_FOUND (field: reviewId) o USER_NOT_FOUND (field: userId)
- 500 — INTERNAL_ERROR

---

## DELETE `/reviews/:reviewId/votes`

Elimina el voto del usuario autenticado sobre una reseña (si existe).

**Headers:**

- Authorization: Bearer `<token>`

**Path params:**

- `reviewId`: ID numérico de la reseña.

### Validaciones de los params

- reviewId  
  - obligatorio  
  - número entero  
  - entre 1 y 2147483647

**Body:**

_No requiere body._

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- El `userId` se obtiene del token (`sub` del usuario autenticado).  
- Si no hay usuario autenticado → `401 UNAUTHENTICATED`.

---

**Response 200:**

```json
{
  "reviewId": 10,
  "deleted": true,
  "upvotes": 11,
  "downvotes": 3,
  "score": 8
}
```

Donde:

- `reviewId`: ID de la reseña.  
- `deleted`:
  - `true`  → se eliminó un voto que existía.  
  - `false` → no había voto previo para ese usuario y esa reseña.  
- `upvotes`: cantidad total de votos positivos después de la operación.  
- `downvotes`: cantidad total de votos negativos después de la operación.  
- `score`: suma total de los votos (`upvotes - downvotes`) después de la operación.

Quitar un voto que no existe sigue devolviendo 200 con `deleted: false`. Esto incluye una review inexistente, cuyo resumen queda en cero. Repetir el DELETE no crea un error ni cambia el resultado final (operación idempotente).

**Posibles errores:**

- 400 — VALIDATION_ERROR (errores de validación en params)
- 401 — UNAUTHENTICATED
- 500 — INTERNAL_ERROR

---
