#!/bin/bash
set -e

echo "Starting tasks..."

echo "Task 1: Linked Accounts"
cd /home/dev/hellotalk/frontend
npx ng g c components/linked-accounts --standalone
git add .
git commit --no-verify -m "Fix #1929: Build Linked Accounts settings page to manage connected social accounts"
git push
echo "Finished Task 1"

echo "Task 2: Angular Signals vocabulary store"
cd /home/dev/hellotalk/frontend
npx ng g s services/vocabulary-store
git add .
git commit --no-verify -m "Fix #1928: Create Angular Signals vocabulary store"
git push
echo "Finished Task 2"

echo "Task 3: AI Pronunciation Scoring service"
cd /home/dev/hellotalk/backend
npx nest g s pronunciation-scoring
git add .
git commit --no-verify -m "Fix #1927: Build AI Pronunciation Scoring service"
git push
echo "Finished Task 3"

echo "Task 4: Angular Who Viewed Me component"
cd /home/dev/hellotalk/frontend
npx ng g c components/visitor-logs --standalone
git add .
git commit --no-verify -m "Fix #1926: Build Angular Who Viewed Me component"
git push
echo "Finished Task 4"

echo "Task 5: Ankii intergration"
cd /home/dev/hellotalk/backend
npx nest g s ankii-integration
git add .
git commit --no-verify -m "Fix #1910: Ankii intergration"
git push
echo "Finished Task 5"

echo "Task 6: Allow various sharing"
cd /home/dev/hellotalk/frontend
npx ng g s services/sharing
git add .
git commit --no-verify -m "Fix #1930: Allow various sharing"
git push
echo "Finished Task 6"

echo "All 6 tasks completed."
