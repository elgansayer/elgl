import { Component } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-linked-accounts',
  imports: [TranslatePipe],
  templateUrl: './linked-accounts.html',
  styleUrl: './linked-accounts.scss',
})
export class LinkedAccounts {}
