#!/bin/sh
# usage: run.sh '<json targets>'   (starts vite, takes shots, stops vite)
cd /home/claude/videoguard/frontend
setsid nohup npm run dev -- --host 127.0.0.1 > /tmp/vite.log 2>&1 &
VP=$!
for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null http://127.0.0.1:5173/ && break; sleep 1; done
cd /home/claude/qa && node shots.mjs "$1" 2>&1 | tail -15
pkill -f "vite" 2>/dev/null; true
