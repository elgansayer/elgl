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
    public readonly mentionedUserIds?: string[],
  ) {}
}

export class ChatMessageEvent {
  constructor(
    public readonly senderId: string,
    public readonly receiverId: string,
    public readonly roomId: string,
    public readonly messageType: string,
    public readonly preview: string,
  ) {}
}

export class ChatMentionEvent {
  constructor(
    public readonly actorId: string,
    public readonly mentionedUserId: string,
    public readonly roomId: string,
    public readonly messagePreview?: string,
  ) {}
}
