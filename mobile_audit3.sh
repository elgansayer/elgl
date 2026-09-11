echo "--- Touch Targets - min-h-[44px] ---"
grep -rn "min-h-\[44px\]" frontend/src/app/

echo "--- Keyboard behaviour ---"
grep -ri "resize" frontend/src/index.html

echo "--- App Navigation ---"
cat frontend/src/app/app.component.ts | grep -i "bottomNav"

echo "--- Overlays/Modals (Z-index cont.) ---"
grep -rn "z-\[" frontend/src/app/ | tail -n 10
