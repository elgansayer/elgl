echo "--- Back Navigation using ionic ---"
grep -rn "ion-back-button" frontend/src/app/

echo "--- App Navigation Tabs Component ---"
ls frontend/src/app/components/app-navigation-tabs*

echo "--- Long Press ---"
grep -rn "long-press" frontend/src/app/

echo "--- Modal Stacking ---"
grep -rn -B 1 -A 1 "z-index:" frontend/src/app/
grep -rn "cdk-overlay-container" frontend/src/
