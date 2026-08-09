import { Component } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';

@Component({
  selector: 'app-toast',
  imports: [TranslatePipe],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
})
export class Toast {}
