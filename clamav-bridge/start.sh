#!/bin/sh
set -eu

runuser -u clamav -- freshclam --quiet
runuser -u clamav -- freshclam --daemon --quiet &
clamd --foreground --config-file=/etc/clamav/clamd.conf &
exec node /app/server.mjs
