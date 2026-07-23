import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ProfileEditComponent } from './profile-edit.component';

@NgModule({
  declarations: [ProfileEditComponent],
  imports: [CommonModule, ReactiveFormsModule],
  exports: [ProfileEditComponent],
})
export class ProfileEditModule {}
