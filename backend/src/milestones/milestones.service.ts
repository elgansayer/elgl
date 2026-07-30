import { Injectable } from '@nestjs/common';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

@Injectable()
export class MilestonesService {
  // In-memory store per user for quick demo; real data should go to DB
  private userMilestones = new Map<string, any[]>();

  async create(dto: CreateMilestoneDto, userId: string) {
    const milestone = {
      id: Date.now().toString(),
      userId,
      ...dto,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const list = this.userMilestones.get(userId) || [];
    list.push(milestone);
    this.userMilestones.set(userId, list);
    return milestone;
  }

  async findAllForUser(userId: string) {
    return this.userMilestones.get(userId) || [];
  }

  async findOneForUser(userId: string, milestoneId: string) {
    const userMilestones = this.userMilestones.get(userId) || [];
    return userMilestones.find((m) => m.id === milestoneId) || null;
  }

  async markCompleted(milestoneId: string, userId: string) {
    const userMilestones = this.userMilestones.get(userId);
    if (!userMilestones) return null;
    const milestone = userMilestones.find((m) => m.id === milestoneId);
    if (milestone) {
      milestone.completed = true;
      return milestone;
    }
    return null;
  }

  async getProgress(userId: string) {
    const milestones = this.userMilestones.get(userId) || [];
    const total = milestones.length;
    const completed = milestones.filter((m) => m.completed).length;
    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}
