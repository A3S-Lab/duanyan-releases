#!/usr/bin/env bash
set -Eeuo pipefail
trap 'rc=$?; echo "QA_ERROR line=$LINENO command=$BASH_COMMAND status=$rc"' ERR
export DISPLAY=:99
export LANG=C.UTF-8
Xvfb :99 -screen 0 1280x900x24 -ac >/tmp/duanyan-polkit-xvfb.log 2>&1 &
for n in $(seq 1 30); do xdpyinfo -display :99 >/dev/null 2>&1 && break; sleep 1; done
/usr/lib/policykit-1-gnome/polkit-gnome-authentication-agent-1 >/tmp/duanyan-polkit-agent.log 2>&1 &
agent=$!
sleep 5
kill -0 "$agent" || { cat /tmp/duanyan-polkit-agent.log; exit 1; }
helper='/opt/端砚· Science Discovery/resources/app-resources/update-deb-helper.sh'
sha=$(sha512sum /tmp/duanyan-polkit-ci/update.deb); sha=${sha%% *}
pkexec --disable-internal-agent "$helper" /tmp/duanyan-polkit-ci/update.deb "$sha" 1.1.21 999999 /tmp/duanyan-polkit-ci/control >/tmp/duanyan-polkit-ci/helper.log 2>&1 &
worker=$!
window=''
for n in $(seq 1 60); do
  window=$(xdotool search --onlyvisible --name '[Aa]uthentication|[Aa]uthenticate' 2>/dev/null | tail -1 || true)
  [ -z "$window" ] || break
  kill -0 "$worker" 2>/dev/null || { cat /tmp/duanyan-polkit-ci/helper.log; cat /tmp/duanyan-polkit-agent.log; exit 1; }
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
ready=0
for n in $(seq 1 120); do
  if grep -q '^A3S_DEB_READY$' /tmp/duanyan-polkit-ci/helper.log; then ready=1; break; fi
  kill -0 "$worker" 2>/dev/null || { cat /tmp/duanyan-polkit-ci/helper.log; exit 1; }
  sleep 1
done
[ "$ready" -eq 1 ] || { cat /tmp/duanyan-polkit-ci/helper.log; exit 1; }
printf '%s\n' REAL_POLKIT_AUTHORIZATION_AND_HELPER_READY
printf 'GO\n' >/tmp/duanyan-polkit-ci/control
wait "$worker"
[ "$(dpkg-query -W -f='${Version} ${db:Status-Status}' duanyan-science-discovery-desktop)" = '1.1.21 installed' ]
touch /tmp/duanyan-polkit-ci/success
printf '%s\n' REAL_POLKIT_GUI_AND_DEB_UPDATE_OK
