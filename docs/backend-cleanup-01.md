# Primera entrega: errores comunes y módulo de juegos

Esta entrega parte de `develop`, commit `f022589`, y se trabaja en `refactor/backend-cleanup`. El objetivo es tener un módulo de referencia que puedas explicar y usar como criterio para ordenar los demás.

## Qué cambió y dónde estudiarlo

| Responsabilidad                     | Archivo                                      | Qué mirar                                                                                  |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Conectar las dependencias           | `src/shared/container.ts`                    | Se construye el repositorio con el pool y el servicio con ese repositorio.                 |
| Publicar los endpoints              | `src/game/game.routes.ts`                    | Orden de autenticación, autorización, validación y controlador.                            |
| Validar entradas                    | `src/game/dto/*.dto.ts`                      | Cada esquema de entrada exporta su tipo inferido con `z.output`.                           |
| Ejecutar la validación HTTP         | `src/shared/middlewares/validate.ts`         | `body`, `params` y `query` se guardan ya convertidos en `res.locals.validated`.            |
| Responder por HTTP                  | `src/game/game.controller.ts`                | Usa datos validados, llama al servicio y responde con el estado y cuerpo correspondientes. |
| Coordinar el caso de uso            | `src/game/game.service.ts`                   | Comprueba nombres existentes, calcula paginación y decide cuándo un recurso falta.         |
| Consultar PostgreSQL                | `src/game/game.postgres.repository.ts`       | SQL parametrizado, filtros comunes, escritura y traducción de conflictos.                  |
| Definir la dependencia del servicio | `src/game/game.repository.interface.ts`      | El servicio depende de las operaciones del repositorio y no del cliente `pg`.              |
| Responder ante errores              | `src/shared/errors/http-error.middleware.ts` | Único middleware final de errores, con logging y respuestas controladas.                   |

El DTO describe los datos de entrada o salida. El esquema Zod valida y transforma la entrada en ejecución; el tipo inferido permite comprobar su uso al compilar. `GameDto` declara los cuatro campos públicos del juego. `StoredGame` distingue un juego persistido, cuyo `id` ya existe, del objeto que se va a crear.

## Recorrido para defender: crear un juego

1. Llega `POST /api/games` con un token y los campos `name`, `description` y `genre`.
2. La ruta ejecuta `requireAuth` y `requireRole('ADMIN')`.
3. `validateBody(GameCreateSchema)` comprueba campos, longitudes y valores vacíos, y aplica `trim()` donde corresponde. Rechaza campos de más.
4. El controlador toma `res.locals.validated.body` y llama a `GameService.create`.
5. El servicio comprueba si existe ese nombre y pide al repositorio que guarde el juego.
6. El repositorio ejecuta el `INSERT` con parámetros y devuelve los campos públicos del registro creado.
7. El controlador responde `201` y `Location: /api/games/<id>`.

Hay dos comprobaciones relacionadas con el nombre: la consulta previa permite detectar un conflicto conocido y la restricción `UNIQUE` de PostgreSQL garantiza la unicidad incluso si dos solicitudes se superponen. La violación de esa restricción también se traduce a `GAME_NAME_TAKEN`, estado `409`.

Los servicios no reciben `Request` ni `Response`. Los controladores de juegos tampoco vuelven a parsear lo que validó el middleware. El `.bind(controller)` de las rutas conserva el `this` de la instancia al entregar su método a Express.

## Recorrido para defender: listar juegos

Para `GET /api/games?page=2&limit=10&all=false`, Zod convierte los números y transforma el texto `false` en el booleano `false`. El servicio calcula `offset = (page - 1) * limit`, en este caso `10`.

El repositorio aplica los mismos filtros a la consulta de conteo y a la página. `total` es la cantidad de coincidencias en todo el listado; `data.length` es la cantidad que llegó en esa página. Con `all=true` se conserva la respuesta como un array y se aplican también `search` y `genre`.

Los filtros se envían como valores de parámetros SQL. Los nombres de columnas que se permiten actualizar están definidos en el código. Esto evita introducir directamente texto recibido del usuario como estructura de una consulta.

## Cómo quedaron los errores

Se eliminó `src/shared/middlewares/error.ts`, que duplicaba el manejador conectado a `app.ts`. Las tres piezas que siguen tienen propósitos distintos:

- `DomainError`: representa un fallo esperado, con código, mensaje y metadatos para su respuesta.
- `db-errors.ts`: traduce violaciones conocidas de PostgreSQL a errores de la aplicación. Se conservan los códigos de username/email que usa el perfil y se agrega el conflicto de nombre de juego.
- `http-error.middleware.ts`: convierte el error recibido en una respuesta HTTP; registra los fallos inesperados sin devolver sus detalles internos.

El middleware reconoce `ZodError` de Zod 4 y conserva `formErrors` y `fieldErrors`, agregando `code: VALIDATION_ERROR`. También clasifica JSON mal formado como `400` y exceso de tamaño como `413`. Si una respuesta ya empezó a enviarse, delega el error con `next` para evitar escribirla otra vez.

Los handlers asíncronos de Express 5 propagan sus errores al middleware cuando devuelven una promesa rechazada. Por eso el controlador de juegos ya no necesita un `try/catch` que repita la misma respuesta. Referencias: [Express](https://expressjs.com/en/guide/error-handling/) y [Zod 4](https://zod.dev/v4/changelog#drops-errors).

Esta consolidación establece el mecanismo común. Los controladores de otros módulos todavía conservan respuestas de error propias que se revisarán en sus entregas.

## Cambios observables del contrato de juegos

| Caso                                  | Resultado                                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Listado paginado                      | Se mantiene `{ page, limit, total, data }`.                                                                                      |
| `all=true`                            | Se mantiene el array, ahora con filtros aplicados.                                                                               |
| `all=false` como texto                | Se interpreta correctamente como falso.                                                                                          |
| `all=no`, `all=0` o valores repetidos | Se rechazan con `400`; se aceptan los textos `true` y `false`.                                                                   |
| Nombre duplicado al crear o editar    | `409`, con `code: GAME_NAME_TAKEN` y `field: name`. Al crear antes se devolvía `400`; al editar la violación SQL no se traducía. |
| Recurso inexistente                   | `404`, con `code: GAME_NOT_FOUND`.                                                                                               |
| `Location` de creación                | Apunta al endpoint `/api/games/<id>`.                                                                                            |
| `PATCH {}`                            | Se conserva como operación sin cambios que devuelve el juego existente.                                                          |
| ID fuera del rango de `SERIAL`        | Se rechaza con `400` antes de consultar PostgreSQL.                                                                              |

Las respuestas de juegos seleccionan explícitamente `id`, `name`, `description` y `genre`. Algunas consultas anteriores devolvían además `created_at` por usar `SELECT *`; ese campo no formaba parte del DTO documentado ni del modelo de juegos de Angular.

## Cómo comprobar esta entrega

Instalá las dependencias del lockfile y ejecutá:

```bash
npm ci
npm run build
npm test -- --runInBand
npx tsc -p tsconfig.test.json
npm run lint
```

La configuración de tests hereda las opciones de módulos del proyecto e incluye explícitamente los tests en el chequeo de tipos. Se corrigieron los imports inexistentes y el mock de paginación de la suite inicial. Al separar el servicio, esas pruebas se trasladaron a las reglas del servicio y a peticiones HTTP reales contra Express.

Resultado de esta entrega: **47 pruebas aprobadas**, compilación correcta, chequeo de tipos correcto y lint sin advertencias. Las pruebas HTTP de la suite usan un repositorio simulado; comprueban la integración de rutas, permisos, esquemas, controlador, servicio y middleware.

Además se realizaron **13 comprobaciones con las migraciones y consultas del proyecto en PostgreSQL embebido, mediante PGlite 0.5.8 / PostgreSQL 18.3**: persistencia, filtros, conteos, conflictos reales de unicidad, cambios parciales, el contrato de rankings del home y borrado en cascada. PGlite se usó como herramienta temporal de verificación y no es una dependencia de RateUp. Estas comprobaciones no reemplazan la prueba de conexión a la instancia PostgreSQL 16 de Docker ni la demostración en Angular. La ejecución se verificó con Node 24.19.0.

## Preguntas para explicarlo sin leer

1. ¿Qué responsabilidades tenía antes `GameController` y a qué archivos se trasladaron?
2. ¿Qué aporta el tipo inferido del esquema y qué parte necesita validación en ejecución?
3. ¿Por qué `res.locals` puede contener `id` numérico si la URL lleva texto?
4. ¿Por qué una consulta previa de existencia no reemplaza una restricción `UNIQUE`?
5. ¿Qué diferencia hay entre el total de resultados y el tamaño de la página?
6. ¿Por qué conservar tres piezas de errores y eliminar el segundo middleware?
7. ¿Qué garantiza una prueba HTTP con repositorio simulado y qué requiere comprobar SQL?

Para practicar, seguí primero un `GET` paginado y después un `POST` correcto y uno duplicado. En cada paso ubicá el archivo responsable y explicá qué dato recibe y qué entrega.
