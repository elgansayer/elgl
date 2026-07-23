import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ProfileEditComponent } from './profile-edit.component';

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, ProfileEditComponent],
  exports: [ProfileEditComponent],
})
export class ProfileEditModule {}
