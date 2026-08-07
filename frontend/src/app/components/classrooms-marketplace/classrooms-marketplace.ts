import { Component } from '@angular/core';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-classrooms-marketplace',
  imports: [SanitiseHtmlPipe, TranslatePipe],
  templateUrl: './classrooms-marketplace.html',
  styleUrl: './classrooms-marketplace.scss',
})
export class ClassroomsMarketplace {}
