export class ProfileViewEvent {
  constructor(
    public readonly viewerId: string,
    public readonly viewedUserId: string,
    public readonly identityVisible: boolean,
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

export class FollowEvent {
  constructor(
    public readonly followerId: string,
    public readonly followedUserId: string,
  ) {}
}

export class LikeEvent {
  constructor(
    public readonly actorId: string,
    public readonly targetUserId: string,
    public readonly targetType: 'profile' | 'moment',
    public readonly targetId?: string,
  ) {}
}

export class SystemAlertEvent {
  constructor(
    public readonly recipientId: string,
    public readonly message: string,
    public readonly actorId?: string,
    public readonly entityId?: string,
  ) {}
}
