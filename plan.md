1. Use `replace_with_git_merge_diff` to modify `frontend/src/app/components/visual-diff/visual-diff.component.ts`.
   ```
   <<<<<<< SEARCH
   import { TranslatePipe } from '../../services/translate.pipe';
   import { FlashcardService } from '../../services/flashcard.service';
   import { showToast } from '../../services/toast.service';
   =======
   import { TranslatePipe } from '../../services/translate.pipe';
   import { VocabularyStore } from '../../services/vocabulary.store';
   import { showToast } from '../../services/toast.service';
   >>>>>>> REPLACE
   ```
   ```
   <<<<<<< SEARCH
     readonly showActions = input<boolean>(false);

     private flashcardService = inject(FlashcardService);
     private i18n = inject(I18nService);
   =======
     readonly showActions = input<boolean>(false);

     private vocabStore = inject(VocabularyStore);
     private i18n = inject(I18nService);
   >>>>>>> REPLACE
   ```
   ```
   <<<<<<< SEARCH
     async createFlashcard() {
       try {
         const wordToken = this.corrected().substring(0, 200);
         const translation = this.original().substring(0, 500);
         const originalContext = this.explanation() ? this.explanation()!.substring(0, 1000) : undefined;

         await this.flashcardService.createFlashcard({
           word_token: wordToken,
           translation: translation,
           original_context: originalContext,
         });
         showToast(this.i18n.translate('correction.flashcardCreatedAlert') || 'Flashcard created');
       } catch (err) {
   =======
     async createFlashcard() {
       try {
         const wordToken = this.corrected().substring(0, 200);
         const translation = this.original().substring(0, 500);
         const originalContext = this.explanation() ? this.explanation()!.substring(0, 1000) : undefined;

         await this.vocabStore.saveWord({
           word_token: wordToken,
           translation: translation,
           original_context: originalContext,
         });
         showToast(this.i18n.translate('correction.flashcardCreatedAlert') || 'Flashcard created');
       } catch (err) {
   >>>>>>> REPLACE
   ```
2. Use `replace_with_git_merge_diff` to modify `frontend/src/app/components/visual-diff/visual-diff.component.spec.ts`.
   ```
   <<<<<<< SEARCH
   import { ChatService } from '../../services/chat.service';
   import { FlashcardService } from '../../services/flashcard.service';
   import { I18nService } from '../../services/i18n.service';
   =======
   import { ChatService } from '../../services/chat.service';
   import { VocabularyStore } from '../../services/vocabulary.store';
   import { I18nService } from '../../services/i18n.service';
   >>>>>>> REPLACE
   ```
   ```
   <<<<<<< SEARCH
         providers: [
           {
             provide: FlashcardService,
             useValue: { createFlashcard: vi.fn().mockResolvedValue(undefined) },
           },
           {
             provide: I18nService,
   =======
         providers: [
           {
             provide: VocabularyStore,
             useValue: { saveWord: vi.fn().mockResolvedValue(undefined) },
           },
           {
             provide: I18nService,
   >>>>>>> REPLACE
   ```
3. Run `npm run lint:check` using `run_in_bash_session`.
4. Run `npm run build` using `run_in_bash_session`.
5. Run `npm run test` using `run_in_bash_session`.
6. Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
7. Submit the change using `message_user` followed by `done`.
