1. Install `dompurify` and `@types/dompurify` as well as `jsdom` and `@types/jsdom` using npm. Since this is in `backend`, I will use `--prefix backend`. However, the dependencies are already in `backend/package.json` (`dompurify` and `jsdom`), so I don't need to do that unless it's missing `@types/dompurify`.
2. Rewrite `backend/src/common/pipes/sanitise-html.pipe.ts` to use `dompurify` instead of `xss`. The file currently uses `xss`.
3. Fix test for `SanitiseHtmlPipe`. We already modified the tests and code, but earlier attempts failed because of the default export or CJS/ESM interop. In nestjs we can `import * as DOMPurify from 'dompurify'` or `import DOMPurify from 'dompurify'`. The correct way for `dompurify` in node with `jsdom` is:
   ```typescript
   import createDOMPurify from 'dompurify';
   import { JSDOM } from 'jsdom';
   const window = new JSDOM('').window;
   const DOMPurify = createDOMPurify(window as unknown as Window);
   ```
4. Verify tests pass for the pipe.
5. Complete pre-commit instructions.
6. Submit the change.
