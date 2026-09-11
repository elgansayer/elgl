echo "--- Back Navigation using Location ---"
grep -rn "Location" frontend/src/app/ | grep -i back

echo "--- App Navigation Check ---"
cat frontend/src/app/app.component.html | grep -i "bottom-nav"

echo "--- Long presses Directive ---"
grep -rn "LongPress" frontend/src/app/

echo "--- Audio Recorder Usage ---"
grep -rn "MediaRecorder" frontend/src/app/components/voice-recorder/voice-recorder.component.ts
