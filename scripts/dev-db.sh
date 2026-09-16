#!/usr/bin/env bash
# Local Postgres for development.
#
# Postgres refuses to run as root, and the sandbox runs as root, so the
# cluster is owned by the postgres system user and lives somewhere that user
# can actually traverse. Idempotent: safe to run when already up.
set -euo pipefail

PGBIN=/usr/lib/postgresql/16/bin
PGDATA=${PGDATA:-/var/lib/postgresql/tvwatcher}
PGPORT=${PGPORT:-5433}
PGDB=${PGDB:-tvwatcher}

as_pg() { su postgres -s /bin/bash -c "PATH=$PGBIN:\$PATH $1"; }

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "initialising cluster at $PGDATA"
  mkdir -p "$PGDATA"
  chown postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"
  as_pg "initdb -D $PGDATA -U postgres --auth=trust" >/dev/null
fi

if as_pg "pg_ctl -D $PGDATA status" >/dev/null 2>&1; then
  echo "postgres already running on port $PGPORT"
else
  as_pg "pg_ctl -D $PGDATA -l $PGDATA/server.log -o '-p $PGPORT -k /tmp' -w start" >/dev/null
  echo "postgres started on port $PGPORT"
fi

if ! psql -h /tmp -p "$PGPORT" -U postgres -lqt | cut -d'|' -f1 | grep -qw "$PGDB"; then
  psql -h /tmp -p "$PGPORT" -U postgres -c "CREATE DATABASE $PGDB" >/dev/null
  echo "created database $PGDB"
fi

echo "DATABASE_URL=\"postgresql://postgres@localhost:$PGPORT/$PGDB?host=/tmp\""
