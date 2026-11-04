#!/usr/bin/env bash
set -Eeuo pipefail
trap 'rc=$?; echo "QA_ERROR line=$LINENO command=$BASH_COMMAND status=$rc" | tee -a /tmp/duanyan-polkit-ci/qa-trace.log' ERR
trap 'echo HUP >> /tmp/duanyan-polkit-ci/qa-trace.log' HUP
trap 'rc=$?; echo "EXIT status=$rc" >> /tmp/duanyan-polkit-ci/qa-trace.log' EXIT
export DISPLAY=:99
export LANG=C.UTF-8
Xvfb :99 -screen 0 1280x900x24 -ac >/tmp/duanyan-polkit-xvfb.log 2>&1 &
for n in $(seq 1 30); do xdpyinfo -display :99 >/dev/null 2>&1 && break; sleep 1; done
/usr/lib/policykit-1-gnome/polkit-gnome-authentication-agent-1 >/tmp/duanyan-polkit-agent.log 2>&1 &
agent=$!
sleep 5
kill -0 "$agent" || { cat /tmp/duanyan-polkit-agent.log; exit 1; }
node /tmp/duanyan-polkit-ci/qa-linux-app-update.cjs >/tmp/duanyan-polkit-ci/app-update.log 2>&1 &
worker=$!
window=''
for n in $(seq 1 240); do
  window=$(xdotool search --onlyvisible --name '[Aa]uthentication|[Aa]uthenticate' 2>/dev/null | tail -1 || true)
  [ -z "$window" ] || break
  kill -0 "$worker" 2>/dev/null || { cat /tmp/duanyan-polkit-ci/app-update.log; cat /tmp/duanyan-polkit-agent.log; exit 1; }
  sleep 1
done
[ -n "$window" ] || { echo 'No Polkit authentication window'; cat /tmp/duanyan-polkit-agent.log; exit 1; }
scrot /tmp/duanyan-polkit-dialog.png || true
printf '%s\n' REAL_POLKIT_GRAPHICAL_PROMPT_SHOWN
echo "AUTH_WINDOW_ID=$window"
xdotool windowfocus "$window" || true
xdotool mousemove --window "$window" 200 185 click 1
echo AUTH_INPUT_FOCUSED
xdotool type --clearmodifiers --delay 1 -- "$(cat /tmp/duanyan-polkit-ci/password)"
xdotool key Return
echo AUTH_SUBMITTED
sleep 3
scrot /tmp/duanyan-polkit-dialog-after.png || true
echo HELPER_AFTER_AUTH
cat /tmp/duanyan-polkit-ci/app-update.log
echo HELPER_PROCESS_STATUS
ps -o pid,ppid,stat,args -p "$worker" || true
wait "$worker" || { cat /tmp/duanyan-polkit-ci/app-update.log; exit 1; }
cat /tmp/duanyan-polkit-ci/app-update.log
[ -f /tmp/duanyan-polkit-ci/app-success ]
touch /tmp/duanyan-polkit-ci/success
printf '%s\n' REAL_LINUX_APP_FULL_GUI_UPDATE_OK
