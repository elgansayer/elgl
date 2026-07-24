export class ChatMessageEvent {
  constructor(
    public readonly senderId: string,
    public readonly receiverId: string,
    public readonly roomId: string,
    public readonly messageType: string,
    public readonly messagePreview: string,
  ) {}
}

export class MomentCommentEvent {
  constructor(
    public readonly commenterId: string,
    public readonly momentAuthorId: string,
    public readonly momentId: string,
    public readonly commentPreview: string,
  ) {}
}

export class ProfileViewEvent {
  constructor(
    public readonly viewerId: string,
    public readonly viewedUserId: string,
  ) {}
}
