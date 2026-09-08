# RateUp API – Backend Contract

Este documento describe el contrato completo de la API del backend de RateUp, incluyendo rutas, DTOs, métodos HTTP, parámetros, estructuras de datos y reglas generales. Sirve como referencia para integrar el frontend con el backend.

Base URL: `http://localhost:3000/api`  
Formato de datos: JSON  
Autenticación: JWT (Bearer Token) en el header `Authorization`

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
  - string no vacío (mínimo 1 carácter)

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

- email
  - obligatorio
  - string con formato de email válido

- password
  - obligatorio
  - string no vacío
  - mínimo 8 caracteres

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
      "likesRate": 0.92
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
      "likesRate": 0.92
    }
  }
}
```

**Notas sobre los campos:**

- `avatarUrl` puede ser:  
  - una URL (`"https://example.com/avatar.png"`), **o**  
  - `null`

- `bio` puede ser:  
  - un string descriptivo, **o**  
  - `null`

**Posibles errores:**

- 404 — Usuario no encontrado

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

- email
  - obligatorio
  - string con formato de email válido

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

- 409 — El nombre de usuario o email ya existen  
- 500 — Error al crear usuario

---

## GET `/users`

Lista usuarios con paginación. Solo accesible para administradores.

**Query params:**

- `page`: número de página (opcional)
- `pageSize`: cantidad de elementos por página (opcional)
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

- 500 — Error al listar usuarios


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

- 404 — Usuario no encontrado

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
  - se aplica `trim()`

- email
  - opcional
  - string con formato de email válido
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
- No se permiten campos adicionales fuera de los definidos en este esquema (`.strict()`).

### Reglas de autorización

- Debe existir un usuario autenticado en el token (`Authorization: Bearer <token>`).
- El usuario autenticado debe ser:
  - el dueño del perfil (`sub` del token igual al `id` del path), **o**
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

- 401 — No autenticado  
- 403 — No estás autorizado para modificar este usuario / No estás autorizado para modificar roles o estado del usuario  
- 404 — Usuario no encontrado

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

### Reglas de autorización

- Debe existir un usuario autenticado en el token (`Authorization: Bearer <token>`).
- El usuario autenticado debe tener el rol `"ADMIN"`.
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

- 401 — No autenticado  
- 403 — Solo un administrador puede modificar roles  
- 404 — Usuario no encontrado

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

### Reglas de autorización

- Debe existir un usuario autenticado en el token (`Authorization: Bearer <token>`).
- El usuario autenticado debe tener rol `"ADMIN"`.

**Response 204:**

_No content._

**Posibles errores:**

- 401 — No autenticado  
- 403 — Solo un administrador puede eliminar usuarios  
- 404 — Usuario no encontrado

---

# Games

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
  - si es `true`, se ignoran `page` y `limit` y se aplican `search` y `genre` al listado completo

---

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

## GET `/home/top-games`

Obtiene un listado de los juegos mejor valorados, ordenados por puntaje promedio y cantidad de reseñas.

**Query params:**

- `limit`: cantidad máxima de juegos a devolver (opcional)
- `minReviews`: cantidad mínima de reseñas que debe tener un juego para ser considerado (opcional)

### Validaciones de los query params

- limit  
  - opcional  
  - se interpreta como número si viene en formato string  
  - si no es un número válido, o es `<= 0`, o es `> 50`, se usa el valor por defecto `10`  
  - valor por defecto: 10  

- minReviews  
  - opcional  
  - se interpreta como número si viene en formato string  
  - si no es un número válido, o es `< 0`, se usa el valor por defecto `1`  
  - valor por defecto: 1  

> Nota: si los parámetros son inválidos, el backend **normaliza** los valores (no retorna 400).

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

- 500 — Internal server error

---

## GET `/home/trending-reviews`

Obtiene las reseñas más relevantes ("trending") en una ventana de tiempo reciente, ordenadas por score de votos y fecha de creación.

**Query params:**

- `limit`: cantidad máxima de reseñas a devolver (opcional)
- `days`: cantidad de días hacia atrás a considerar para calcular reseñas trending (opcional)

### Validaciones de los query params

- limit  
  - opcional  
  - se interpreta como número si viene en formato string  
  - si no es un número válido, o es `<= 0`, o es `> 50`, se usa el valor por defecto `10`  
  - valor por defecto: 10  

- days  
  - opcional  
  - se interpreta como número si viene en formato string  
  - si no es un número válido, o es `<= 0`, o es `> 30`, se usa el valor por defecto `7`  
  - valor por defecto: 7  

> Nota: si los parámetros son inválidos, el backend **normaliza** los valores (no retorna 400).

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

- 500 — Internal server error

---

# Reviews

---

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
  - valor por defecto: 10  

- gameId  
  - opcional  
  - número entero  
  - mayor que 0

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
        "username": "nuevo",
        "email": "nuevo@example.com"
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
        "username": "nuevo",
        "email": "nuevo@example.com"
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
- 500 — Error interno del servidor

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
  - mayor que 0  

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

- 400 — Datos inválidos  
- 401 — No autenticado  
- 500 — Error interno del servidor

---

## GET `/reviews/:id`

Obtiene una reseña por su ID.

**Path params:**

- `id`: ID numérico de la reseña.

### Validaciones de los params

- id  
  - obligatorio  
  - número entero  
  - mayor que 0  

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

- 404 — Reseña no encontrada

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
  - mayor que 0  

- userId  
  - opcional  
  - número entero  
  - mayor que 0  

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
        "username": "nuevo",
        "email": "nuevo@example.com"
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
        "username": "juan",
        "email": "juan@example.com"
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

- 500 — Error interno del servidor

---

## GET `/reviews/:id/details`

Obtiene una reseña con información del usuario que la creó y del juego al que pertenece.

**Path params:**

- `id`: ID numérico de la reseña.

### Validaciones de los params

- id  
  - obligatorio  
  - número entero  
  - mayor que 0  

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
    "username": "nuevo",
    "email": "nuevo@example.com"
  },
  "game": {
    "id": 1,
    "name": "GTA VI",
    "genre": "Acción"
  }
}
```

**Posibles errores:**

- 404 — Reseña no encontrada

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
  - mayor que 0  

**Query params (comentarios):**

- `commentsPage`: número de página de comentarios (opcional)
- `commentsPageSize`: cantidad de comentarios por página (opcional)

### Validaciones de los query params

- commentsPage  
  - opcional  
  - se interpreta como número si viene en formato string  
  - mínimo: 1  
  - valor por defecto: 1  
  - si el valor no es numérico o es `< 1`, se normaliza a `1`  

- commentsPageSize  
  - opcional  
  - se interpreta como número si viene en formato string  
  - mínimo: 1  
  - máximo: 100  
  - valor por defecto: 10  
  - si el valor no es numérico, es `< 1` o `> 100`, se normaliza a `10`  

> Nota: si los parámetros son inválidos, el backend **normaliza** los valores (no retorna 400 por eso).

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
      "username": "nuevo",
      "email": "nuevo@example.com"
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
    "total": 3,
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
- `comments.data`: página de comentarios según `commentsPage` y `commentsPageSize`.  
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

- 400 — Invalid data (error de validación en params/query)  
- 404 — Review not found  
- 500 — Internal server error

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
  - mayor que 0  

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
  - mayor que 0  

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
- Si no se cumple lo anterior → `403 No autorizado para modificar esta reseña`.

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

- 400 — Datos inválidos  
- 401 — No autenticado  
- 403 — No autorizado para modificar esta reseña  
- 404 — Reseña no encontrada  
- 500 — Error interno del servidor

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
  - mayor que 0  

**Body:**

_No requiere body._

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- Se busca primero la reseña:
  - si no existe → `404 Reseña no encontrada`.  
- Solo se permite eliminar si:
  - el usuario autenticado es el dueño de la reseña (`existing.userId === sub`), **o**
  - el usuario tiene rol `"ADMIN"`.  
- Si no se cumple lo anterior → `403 No autorizado para eliminar esta reseña`.

**Response 204:**

_No content._

**Posibles errores:**

- 401 — No autenticado  
- 403 — No autorizado para eliminar esta reseña  
- 404 — Reseña no encontrada  
- 500 — Error interno del servidor

---

# Comentarios de Reviews

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
  - mayor que 0  

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
- Si no hay usuario autenticado → `401 Not authenticated`.

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

- 400 — Invalid data (errores de validación del body/params)  
- 401 — Not authenticated  
- 500 — Internal server error

---

## GET `/reviews/:reviewId/comments`

Lista comentarios de una reseña, con paginación simple.

**Path params:**

- `reviewId`: ID numérico de la reseña.

### Validaciones de los params

- reviewId  
  - obligatorio  
  - número entero  
  - mayor que 0  

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
  - valor por defecto: 10  

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

> Nota: si no hay comentarios para la reseña, se devuelve `data` como un array vacío.

**Posibles errores:**

- 400 — Parámetros inválidos (validación de params/query)  
- 500 — Error interno del servidor

---

## GET `/reviews/:reviewId/comments/details`

Lista comentarios de una reseña, incluyendo la información básica del usuario que hizo cada comentario, con paginación simple.

**Path params:**

- `reviewId`: ID numérico de la reseña.

### Validaciones de los params

- reviewId  
  - obligatorio  
  - número entero  
  - mayor que 0  

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
  - valor por defecto: 10  

**Body:**

_No requiere body._

**Response 200:**

```json
{
  "reviewId": 10,
  "page": 1,
  "pageSize": 10,
  "count": 2,
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

- `count`: cantidad de comentarios devueltos en esta página (igual a `data.length`).  
- `data`: lista de comentarios con información del usuario que los creó.

**Posibles errores:**

- 400 — Invalid data (errores de validación en params/query)  
- 500 — Internal server error

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
  - mayor que 0  

- commentId  
  - obligatorio  
  - número entero  
  - mayor que 0  

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
  - si no existe, o su `reviewId` no coincide con el del path → `404 Comment not found`.  
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

- 400 — Invalid data (errores de validación en params/body)  
- 401 — Not authenticated  
- 403 — Not authorized to modify this comment  
- 404 — Comment not found  
- 500 — Internal server error

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
  - mayor que 0  

- commentId  
  - obligatorio  
  - número entero  
  - mayor que 0  

**Body:**

_No requiere body._

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- Se busca el comentario por `commentId`:
  - si no existe, o su `reviewId` no coincide con el del path → `404 Comment not found`.  
- Solo se permite eliminar si:
  - el usuario autenticado es el dueño del comentario (`existing.userId === sub`), **o**
  - el usuario tiene rol `"ADMIN"`.  
- Si no se cumple lo anterior → `403 Not authorized to delete this comment`.

Si la operación se realiza correctamente:

**Response 204:**

_No content._

**Posibles errores:**

- 401 — Not authenticated  
- 403 — Not authorized to delete this comment  
- 404 — Comment not found  
- 500 — Internal server error

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
  - mayor que 0  

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

**Posibles errores:**

- 500 — Internal server error

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
  - mayor que 0  

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
- No se acepta `0` como valor; para “quitar” un voto deberá implementarse otro endpoint (no es responsabilidad de este).
- El `userId` **no** se envía en el body:
  - se obtiene del token JWT (`sub` del usuario autenticado).

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- Si no hay usuario autenticado → `401 Not authenticated`.
- Si la `reviewId` no existe (violación de foreign key en BD) → `404 Review not found`.

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

- 400 — Invalid data (errores de validación en params/body)  
- 401 — Not authenticated  
- 404 — Review not found  
- 500 — Internal server error

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
  - mayor que 0  

**Body:**

_No requiere body._

### Reglas de autorización

- Debe existir un usuario autenticado (`Authorization: Bearer <token>`).  
- El `userId` se obtiene del token (`sub` del usuario autenticado).  
- Si no hay usuario autenticado → `401 Not authenticated`.

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

**Posibles errores:**

- 400 — Invalid data (errores de validación en params)  
- 401 — Not authenticated  
- 500 — Internal server error

---
