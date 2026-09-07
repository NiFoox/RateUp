import { createPgPool } from './db.js';
import { GamePostgresRepository } from '../game/game.postgres.repository.js';
import { GameService } from '../game/game.service.js';
import { UserPostgresRepository } from '../user/user.postgres.repository.js';
import { UserService } from '../user/user.service.js';
import { ReviewPostgresRepository } from '../review/review.postgres.repository.js';
import { ReviewCommentPostgresRepository } from '../review-comment/review-comment.postgres.repository.js';
import { ReviewVotePostgresRepository } from '../review-vote/review-vote.postgres.repository.js';
import { AuthService } from '../auth/auth.service.js';

const pool = createPgPool();

const gameRepository = new GamePostgresRepository(pool);
const gameService = new GameService(gameRepository);
const userRepository = new UserPostgresRepository(pool);
const userService = new UserService(userRepository);
const authService = new AuthService(userRepository);
const reviewRepository = new ReviewPostgresRepository(pool);
const reviewCommentRepository = new ReviewCommentPostgresRepository(pool);
const reviewVoteRepository = new ReviewVotePostgresRepository(pool);

export const container = {
  gameRepository,
  gameService,
  userRepository,
  userService,
  authService,
  reviewRepository,
  reviewCommentRepository,
  reviewVoteRepository,
};
