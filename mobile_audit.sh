echo "--- Touch Targets ---"
grep -rnE "(min-w-\[44px\]|w-11|h-11|min-h-\[44px\]|w-12|h-12|min-w-\[48px\]|min-h-\[48px\])" frontend/src/app/ | wc -l

echo "--- Safe Areas ---"
grep -rn "env(safe-area" frontend/src/

echo "--- Media Capture ---"
grep -rn -i "capture" frontend/src/app/

echo "--- Voice Recording ---"
grep -rn -i "MediaRecorder" frontend/src/app/

echo "--- Scrolling ---"
grep -rn "overscroll" frontend/src/

echo "--- Transitions ---"
grep -rn "startViewTransition" frontend/src/

echo "--- Overlays/Modals ---"
grep -rn "z-index" frontend/src/ | wc -l
grep -rn "cdk-overlay" frontend/src/ | wc -l

echo "--- Back Navigation ---"
grep -rn "Location" frontend/src/app/ | grep -i back
