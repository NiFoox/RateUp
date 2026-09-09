export class ReviewVote {
  constructor(
    public reviewId: number,
    public userId: number,
    public value: 1 | -1,
    public id?: number,
    public createdAt?: Date,
    public updatedAt?: Date | null,
  ) {}
}
