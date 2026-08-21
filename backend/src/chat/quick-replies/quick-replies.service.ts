import { Injectable } from '@nestjs/common';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';

export interface QuickReply {
  id: string;
  key: string;
}

@Injectable()
export class QuickRepliesService {
  private readonly replies: QuickReply[] = [
    { id: 'hello', key: 'chat.quickReply.hello' },
    { id: 'where-from', key: 'chat.quickReply.whereFrom' },
    { id: 'what-languages', key: 'chat.quickReply.whatLanguages' },
    { id: 'sorry-busy', key: 'chat.quickReply.sorryBusy' },
    { id: 'how-are-you', key: 'chat.quickReply.howAreYou' },
  ];

  getQuickReplies(): QuickReply[] {
    return this.replies;
  }

  createQuickReply(dto: CreateQuickReplyDto): QuickReply {
    const newReply: QuickReply = {
      id: dto.id,
      key: dto.key,
    };
    const exists = this.replies.some((reply) => reply.id === dto.id);
    if (!exists) {
      this.replies.push(newReply);
    }
    return newReply;
  }
}
