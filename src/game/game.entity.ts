export class Game {
  constructor(
    public name: string,
    public description: string,
    public genre: string,
    public id?: number,
  ) {}
}

export type StoredGame = Game & { id: number };
