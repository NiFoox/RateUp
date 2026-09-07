import { DomainError } from './domain-error.js';

export function mapPostgresErrorToDomainError(error: unknown): DomainError | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    error.code !== '23505' ||
    !('constraint' in error)
  ) {
    return null;
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
