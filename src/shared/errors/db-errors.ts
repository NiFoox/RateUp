import { DomainError } from './domain-error.js';

export function mapPostgresErrorToDomainError(error: unknown): DomainError | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error.code !== '23505' && error.code !== '23503') ||
    !('constraint' in error)
  ) {
    return null;
  }

  if (error.code === '23503') {
    switch (error.constraint) {
      case 'review_comments_review_id_fkey':
      case 'review_votes_review_id_fkey':
        return new DomainError('REVIEW_NOT_FOUND', 'Review not found', 404, 'reviewId');
      case 'review_comments_user_id_fkey':
      case 'review_votes_user_id_fkey':
        return new DomainError('USER_NOT_FOUND', 'User not found', 404, 'userId');
      default:
        return null;
    }
  }

  switch (error.constraint) {
    case 'games_name_key':
      return new DomainError('GAME_NAME_TAKEN', 'El nombre del juego ya está en uso.', 409, 'name');
    case 'users_username_key':
      return new DomainError(
        'USERNAME_TAKEN',
        'Ese nombre de usuario ya está en uso.',
        409,
        'username',
      );
    case 'users_email_key':
      return new DomainError('EMAIL_TAKEN', 'Ese email ya está en uso.', 409, 'email');
    default:
      return null;
  }
}
