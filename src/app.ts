import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import buildGameRouter from './game/game.routes.js';
import buildReviewRouter from './review/review.routes.js';
import buildUserRouter from './user/user.routes.js';
import buildAuthRouter from './auth/auth.routes.js';
import buildReviewCommentRouter from './review-comment/review-comment.routes.js';
import buildReviewVoteRouter from './review-vote/review-vote.routes.js';
import buildHomeRouter from './home/home.routes.js';
import { container } from './shared/container.js';
import { httpErrorMiddleware } from './shared/errors/http-error.middleware.js';

const app = express();

app.use(
  cors({
    origin: '*', // Para producción poner dominio real
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: false,
  }),
);

app.use(express.json({ limit: '100kb' }));
app.use(helmet());

app.use('/api/games', buildGameRouter(container.gameService, container.authMiddleware));
app.use('/api/reviews',   buildReviewRouter(
    container.reviewRepository,
    container.reviewCommentRepository,
    container.reviewVoteRepository,
    container.authMiddleware,
  ),
);

// comentarios de review
app.use(
  '/api/reviews/:reviewId/comments',
  buildReviewCommentRouter(container.reviewCommentRepository, container.authMiddleware),
);

// votos de review
app.use(
  '/api/reviews/:reviewId/votes',
  buildReviewVoteRouter(container.reviewVoteRepository, container.authMiddleware),
);

app.use('/api/users', buildUserRouter(container.userService, container.authMiddleware));
app.use('/api/auth', buildAuthRouter(
  container.authService,
  container.authMiddleware,
));

app.use(
  '/api/home',
  buildHomeRouter(
    container.gameRepository,
    container.reviewRepository,
  ),
);

app.use(httpErrorMiddleware);

export default app;

// TODO:
// - Refactor dto (matar validators y meter todo en dto por separado)
// - Usar ORM tipo TypeORM o Prisma?
// - Usar más los types en vez de tanto any?
// - Más tests
// - Levantar api en docker?
// - Probar llamar api externa?
// - Agregar total en comments/details para que soporte paginación
// - Refactorizar PATCH de Users
// - Refactorizar controllers para no repetir tanto el parseo/validación de dto
// - Refactorizar los servicios para que lancen errores específicos y no genéricos
// - Refactorizar los repos para que lancen errores específicos y no genéricos
// - Refactorizar para estandarizar las respuestas de listas (data + total)
// - Refactorizar para estandarizar el RequireAuth middleware
