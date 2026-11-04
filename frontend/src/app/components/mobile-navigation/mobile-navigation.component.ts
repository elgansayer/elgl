import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SeriousLearnerModeService } from '../../services/serious-learner-mode.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { UnreadCounterService } from '../../services/unread-counter.service';

@Component({
  selector: 'app-mobile-navigation',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './mobile-navigation.component.html',
})
export class MobileNavigationComponent {
  readonly unreadCounter = inject(UnreadCounterService);
  readonly seriousLearnerMode = inject(SeriousLearnerModeService);
}
