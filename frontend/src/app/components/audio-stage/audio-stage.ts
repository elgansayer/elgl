import { Component } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-audio-stage',
  imports: [TranslatePipe],
  templateUrl: './audio-stage.html',
  styleUrl: './audio-stage.scss',
})
export class AudioStage {}
