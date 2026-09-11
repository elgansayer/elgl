echo "--- App Shell ---"
ls frontend/src/app/core/
cat frontend/src/app/app.component.html
echo "--- Z-index ---"
grep -rn "z-\[" frontend/src/app/ | head -n 10
