#!/bin/bash
cat frontend/src/app/components/visual-diff/visual-diff.component.ts | sed -e 's/import { ToastService } from '\''..\/..\/services\/toast.service'\'';/import { showToast } from '\''..\/..\/services\/toast.service'\'';/g' > temp.ts
mv temp.ts frontend/src/app/components/visual-diff/visual-diff.component.ts

cat frontend/src/app/components/visual-diff/visual-diff.component.ts | sed -e 's/readonly toast = inject(ToastService);//g' > temp.ts
mv temp.ts frontend/src/app/components/visual-diff/visual-diff.component.ts

cat frontend/src/app/components/visual-diff/visual-diff.component.ts | sed -e 's/this.toast.showToast('\''Failed to translate'\'', '\''error'\'');/showToast('\''Failed to translate'\'', '\''error'\'');/g' > temp.ts
mv temp.ts frontend/src/app/components/visual-diff/visual-diff.component.ts

cat frontend/src/app/components/visual-diff/visual-diff.component.ts | sed -e 's/this.toast.showToast(this.i18n.translate('\''visual_diff.srsSaved'\'' || '\''Saved to SRS'\''), '\''success'\'');/showToast(this.i18n.translate('\''visual_diff.srsSaved'\'') || '\''Saved to SRS'\'', '\''success'\'');/g' > temp.ts
mv temp.ts frontend/src/app/components/visual-diff/visual-diff.component.ts

cat frontend/src/app/components/visual-diff/visual-diff.component.ts | sed -e 's/this.toast.showToast(this.i18n.translate('\''visual_diff.srsError'\'' || '\''Failed to save to SRS'\''), '\''error'\'');/showToast(this.i18n.translate('\''visual_diff.srsError'\'') || '\''Failed to save to SRS'\'', '\''error'\'');/g' > temp.ts
mv temp.ts frontend/src/app/components/visual-diff/visual-diff.component.ts
