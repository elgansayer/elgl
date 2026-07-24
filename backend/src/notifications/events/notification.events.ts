export class ProfileViewEvent {
  constructor(
    public readonly viewerId: string,
    public readonly viewedUserId: string,
  ) {}
