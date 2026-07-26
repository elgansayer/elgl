import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="p-4 bg-[#121212] text-white min-h-screen">
      <h2 class="text-xl font-bold mb-4">{{ 'group.createTitle' | t }}</h2>
      
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">{{ 'group.nameLabel' | t }}</label>
        <input 
          type="text" 
          [(ngModel)]="groupName" 
          class="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
          placeholder="{{ 'group.namePlaceholder' | t }}"
        />
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">{{ 'group.addMembers' | t }} ({{ selectedMembers().length }}/49)</label>
        <div class="flex gap-2 mb-2">
          <input 
            type="text" 
            [(ngModel)]="newMemberId" 
            class="flex-1 p-2 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
            placeholder="{{ 'group.userIdPlaceholder' | t }}"
          />
          <button 
            (click)="addMember()" 
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold transition-colors"
            [disabled]="selectedMembers().length >= 49 || !newMemberId.trim()"
          >
            {{ 'group.addBtn' | t }}
          </button>
        </div>
        
        <ul class="space-y-2 mt-4">
          @for (member of selectedMembers(); track member) {
            <li class="flex justify-between items-center bg-gray-800 p-2 rounded">
              <span class="text-sm">{{ member }}</span>
              <button (click)="removeMember(member)" class="text-red-400 hover:text-red-300 text-sm font-bold">
                {{ 'group.removeBtn' | t }}
              </button>
            </li>
          }
        </ul>
      </div>

      <button 
        (click)="createGroup()" 
        class="w-full py-3 bg-green-600 hover:bg-green-700 rounded-full font-bold transition-colors mt-6"
        [disabled]="isCreating() || !groupName.trim() || selectedMembers().length === 0"
      >
        @if (isCreating()) {
          {{ 'group.creatingBtn' | t }}...
        } @else {
          {{ 'group.createBtn' | t }}
        }
      </button>

      @if (error()) {
        <p class="text-red-400 mt-4 text-sm text-center">{{ error() }}</p>
      }
      @if (success()) {
        <p class="text-green-400 mt-4 text-sm text-center">{{ 'group.successMsg' | t }}</p>
      }
    </div>
  `
})
export class CreateGroupComponent {
  private chatService = inject(ChatService);

  groupName = '';
  newMemberId = '';
  selectedMembers = signal<string[]>([]);
  isCreating = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  addMember() {
    const id = this.newMemberId.trim();
    if (id && !this.selectedMembers().includes(id) && this.selectedMembers().length < 49) {
      this.selectedMembers.update(members => [...members, id]);
      this.newMemberId = '';
    }
  }

  removeMember(id: string) {
    this.selectedMembers.update(members => members.filter(m => m !== id));
  }

  async createGroup() {
    if (!this.groupName.trim() || this.selectedMembers().length === 0) return;

    this.isCreating.set(true);
    this.error.set(null);
    this.success.set(false);

    try {
      await this.chatService.createGroup(this.groupName.trim(), this.selectedMembers());
      this.success.set(true);
      this.groupName = '';
      this.selectedMembers.set([]);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to create group');
    } finally {
      this.isCreating.set(false);
    }
  }
}
