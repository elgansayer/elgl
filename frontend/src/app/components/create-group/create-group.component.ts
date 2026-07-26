import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserProfile } from '../../services/user.service';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col h-full max-h-[80vh] bg-white dark:bg-slate-900 rounded-xl shadow-xl overflow-hidden">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <h2 class="text-lg font-semibold text-slate-800 dark:text-white">Create Group Chat</h2>
        <span class="text-sm text-slate-500">{{ selectedUsers().length }} / 50</span>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Group Name -->
        <div>
          <label for="groupName" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Group Name</label>
          <input 
            id="groupName"
            type="text" 
            [(ngModel)]="groupName"
            placeholder="Enter group name..."
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-transparent text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <!-- Selected Users Chips -->
        @if (selectedUsers().length > 0) {
          <div class="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            @for (user of selectedUsers(); track user.id) {
              <div class="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-sm">
                <img [src]="user.avatar_url || 'assets/default-avatar.png'" class="w-5 h-5 rounded-full object-cover" alt="avatar">
                <span class="max-w-[100px] truncate">{{ user.display_name }}</span>
                <button (click)="removeUser(user)" class="ms-1 hover:text-blue-600 dark:hover:text-blue-400">
                  &times;
                </button>
              </div>
            }
          </div>
        }

        <!-- Search Input -->
        <div>
          <input 
            type="text" 
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearch($event)"
            placeholder="Search users to add..."
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-transparent text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <!-- Search Results -->
        <div class="space-y-2">
          @for (user of searchResults(); track user.id) {
            <div 
              (click)="toggleUser(user)"
              (keydown.enter)="toggleUser(user)"
              tabindex="0"
              class="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
            >
              <div class="flex items-center gap-3">
                <img [src]="user.avatar_url || 'assets/default-avatar.png'" class="w-10 h-10 rounded-full object-cover" alt="avatar">
                <div>
                  <p class="font-medium text-slate-900 dark:text-white">{{ user.display_name }}</p>
                  <p class="text-xs text-slate-500">{{ user.native_languages?.join(', ') }}</p>
                </div>
              </div>
              <div class="w-5 h-5 rounded border flex items-center justify-center"
                   [class.bg-blue-500]="isSelected(user)"
                   [class.border-blue-500]="isSelected(user)"
                   [class.border-slate-300]="!isSelected(user)">
                @if (isSelected(user)) {
                  <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Footer -->
      <div class="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
        <button class="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          Cancel
        </button>
        <button 
          [disabled]="!isValid()"
          (click)="createGroup()"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Create Group
        </button>
      </div>
    </div>
  `
})
export class CreateGroupComponent {
  private userService = inject(UserService);

  groupName = signal<string>('');
  searchQuery = signal<string>('');
  selectedUsers = signal<UserProfile[]>([]);
  searchResults = signal<UserProfile[]>([]); // In a real app, populate this via a search service

  isValid = computed(() => {
    return this.groupName().trim().length > 0 && 
           this.selectedUsers().length > 0 && 
           this.selectedUsers().length <= 50;
  });

  onSearch(query: string) {
    this.searchQuery.set(query);
    // TODO: Implement actual search logic via UserService
    // this.userService.searchUsers(query).then(results => this.searchResults.set(results));
  }

  isSelected(user: UserProfile): boolean {
    return this.selectedUsers().some(u => u.id === user.id);
  }

  toggleUser(user: UserProfile) {
    if (this.isSelected(user)) {
      this.removeUser(user);
    } else {
      if (this.selectedUsers().length < 50) {
        this.selectedUsers.update(users => [...users, user]);
      }
    }
  }

  removeUser(user: UserProfile) {
    this.selectedUsers.update(users => users.filter(u => u.id !== user.id));
  }

  createGroup() {
    if (!this.isValid()) return;
    
    const payload = {
      name: this.groupName(),
      memberIds: this.selectedUsers().map(u => u.id)
    };
    
    console.log('Creating group:', payload);
    // TODO: Emit event or call service to create the group channel
  }
}
