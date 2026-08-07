import { Component } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-classrooms-marketplace',
  imports: [TranslatePipe],
  templateUrl: './classrooms-marketplace.html',
  styleUrl: './classrooms-marketplace.scss',
})
export class ClassroomsMarketplace {}
