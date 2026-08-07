import { Component } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-visitor-logs',
  imports: [TranslatePipe],
  templateUrl: './visitor-logs.html',
  styleUrl: './visitor-logs.scss',
})
export class VisitorLogs {}
