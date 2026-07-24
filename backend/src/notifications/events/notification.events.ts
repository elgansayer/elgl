export class ProfileViewEvent {
  constructor(
    public readonly viewerId: string,
    public readonly viewedUserId: string,
  ) {}
}

export class MomentCommentEvent {
  constructor(
    public readonly momentId: string,
    public readonly commenterId: string,
    public readonly momentAuthorId: string,
    public readonly commentPreview?: string,
    public readonly parentCommentId?: string,
    public readonly replyToUserId?: string,
  ) {}
}
