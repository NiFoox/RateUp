import cors from 'cors';
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
    container.reviewService,
    container.authMiddleware,
  ),
);

// comentarios de review
app.use(
  '/api/reviews/:reviewId/comments',
  buildReviewCommentRouter(container.reviewCommentService, container.authMiddleware),
);

// votos de review
app.use(
  '/api/reviews/:reviewId/votes',
  buildReviewVoteRouter(container.reviewVoteService, container.authMiddleware),
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
