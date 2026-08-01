import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

export interface Milestone {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

export interface MilestoneProgress {
  total: number;
  completed: number;
  percentage: number;
}

interface MilestoneRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

@Injectable()
export class MilestonesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private toMilestone(row: MilestoneRow): Milestone {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      completed: row.completed,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }

  async create(dto: CreateMilestoneDto, userId: string): Promise<Milestone> {
    const supabase = this.supabaseService.getClient();
    const { error } = await this.validateDto(dto);
    if (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }
    const { data, error: insertError } = await supabase
      .from('milestones')
      .insert({
        user_id: userId,
        title: dto.title,
        description: dto.description ?? null,
      })
      .select()
      .single();

    if (insertError || !data) {
      throw new Error(`Failed to create milestone: ${insertError?.message}`);
    }
    return this.toMilestone(data as MilestoneRow);
  }

  async findAllForUser(userId: string): Promise<Milestone[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('milestones')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch milestones: ${error.message}`);
    }
    return ((data ?? []) as MilestoneRow[]).map((row) => this.toMilestone(row));
  }

  async findOneForUser(
    userId: string,
    milestoneId: string,
  ): Promise<Milestone> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('milestones')
      .select()
      .eq('id', milestoneId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch milestone: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundException('Milestone not found');
    }
    return this.toMilestone(data as MilestoneRow);
  }

  async markCompleted(milestoneId: string, userId: string): Promise<Milestone> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('milestones')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', milestoneId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to complete milestone: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundException('Milestone not found');
    }
    return this.toMilestone(data as MilestoneRow);
  }

  async remove(milestoneId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', milestoneId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to delete milestone: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundException('Milestone not found');
    }
  }

  async getProgress(userId: string): Promise<MilestoneProgress> {
    const milestones = await this.findAllForUser(userId);
    const total = milestones.length;
    const completed = milestones.filter((m) => m.completed).length;
    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}
