#!/bin/sh
# Run the given command as the owner of /out (the host's analytics/out), so the
# exported files belong to whoever owns that folder, with no UID configuration.
set -e
uid=$(stat -c %u /out)
gid=$(stat -c %g /out)
if [ "$uid" = "0" ]; then
  exec "$@"
fi
exec setpriv --reuid="$uid" --regid="$gid" --clear-groups "$@"
