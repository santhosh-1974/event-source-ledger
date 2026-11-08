#!/bin/sh
#
# Backend container entrypoint.
#
# Responsibilities, in order:
#   1. Refuse to run on a Node runtime without TypeScript type stripping
#      (migrations are .ts files loaded by node-pg-migrate).
#   2. Wait until PostgreSQL accepts connections (the compose healthcheck
#      already gates this, but a direct `docker run` should behave too).
#   3. Apply pending migrations exactly once, from this single process, before
#      any application traffic is served.
#   4. Seed the system ledger accounts (idempotent) so banking operations work
#      on a fresh database.
#   5. Hand off to the CMD (`node dist/server.js`) via exec, so Node becomes
#      the process receiving signals.
#
# Migrations are strictly additive: node-pg-migrate only runs migrations that
# are not yet recorded in the `pgmigrations` table. Nothing here ever drops,
# truncates or recreates data.

set -eu

log() {
    printf '[entrypoint] %s\n' "$*"
}

# ---------------------------------------------------------------------------
# 1. Runtime capability check
# ---------------------------------------------------------------------------
# process.features.typescript is "strip" (or "transform") when Node can load
# .ts files natively. It is false on Node < 22.18 and on 22.18+ if disabled.
if ! node -e 'process.exit(process.features.typescript ? 0 : 1)'; then
    log "FATAL: this image needs Node >= 22.18 with built-in TypeScript support"
    log "       (process.features.typescript is off); node $(node -v) is running."
    log "       Migrations are .ts files and cannot be loaded without it."
    exit 1
fi

# ---------------------------------------------------------------------------
# 2. Wait for PostgreSQL
# ---------------------------------------------------------------------------
# Preferred: an explicit DATABASE_URL. Otherwise node-pg-migrate/pg fall back to
# the standard PG* variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
if [ -n "${DATABASE_URL:-}" ]; then
    PG_WAIT_TARGET="url:${DATABASE_URL}"
else
    PG_WAIT_TARGET="host:${PGHOST:-postgres}:${PGPORT:-5432}/${PGDATABASE:-postgres} as ${PGUSER:-postgres}"
fi

# Backoff is capped so a permanently unreachable database fails in ~60s rather
# than hanging the container forever.
attempt=0
max_attempts="${DB_WAIT_MAX_ATTEMPTS:-60}"
until node -e '
const { Client } = require("pg");
const client = new Client(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {});
client.connect()
  .then(() => client.query("SELECT 1"))
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch(async () => { try { await client.end(); } catch {} process.exit(1); });
'; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$max_attempts" ]; then
        log "FATAL: PostgreSQL is not reachable at ${PG_WAIT_TARGET} (${attempt} attempts)"
        exit 1
    fi
    if [ "$attempt" -eq 1 ]; then
        log "waiting for PostgreSQL at ${PG_WAIT_TARGET} ..."
    fi
    sleep 1
done
log "PostgreSQL is reachable (${PG_WAIT_TARGET})"

# ---------------------------------------------------------------------------
# 3. Migrations — single designated executor
# ---------------------------------------------------------------------------
# Only this service runs migrations; identity/gateway containers never do.
# node-pg-migrate also takes a PostgreSQL advisory lock, so even an accidental
# second invocation serialises instead of racing.
# Set RUN_MIGRATIONS=false to skip (e.g. when a release job owns migrations).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    log "applying database migrations ..."
    node ./node_modules/node-pg-migrate/bin/node-pg-migrate.js up
    log "migrations up to date"
else
    log "RUN_MIGRATIONS=false — skipping migrations"
fi

# ---------------------------------------------------------------------------
# 4. Seed system ledger accounts
# ---------------------------------------------------------------------------
# Banking operations (deposit/withdraw/transfer) need the SYSTEM ledger accounts
# ("Cash", "Bank Revenue", ...). They are NOT created by a migration — the
# project ships `npm run seed` for them, guarded by SEED_ON_START.
#
# Two properties of that script shape this block. Both are application code we
# must not rewrite, so the orchestration works around them instead:
#
#   * `ledger_accounts` has no unique constraint, so the seed's
#     `ON CONFLICT DO NOTHING` does not actually prevent duplicates. Seeding on
#     every boot would append another "Cash" row each time.
#     → seed only when the table has no SYSTEM rows.
#
#   * the script never closes its pg pool, so the process lingers ~30s after the
#     INSERT has committed, and exiting on the pool timeout looks like a failure.
#     → run it in the background and verify the ROWS, not the exit code.
#
# Best-effort: a seed failure must not stop the API from serving.
seed_rows() {
    node -e '
const { Client } = require("pg");
const client = new Client(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {});
(async () => {
  await client.connect();
  const { rows } = await client.query(
    "SELECT count(*)::int AS n FROM ledger_accounts WHERE category = \u0027SYSTEM\u0027"
  );
  await client.end();
  process.stdout.write(String(rows[0].n));
})().catch(async () => { try { await client.end(); } catch {} process.exit(1); });
'
}

if [ "${SEED_ON_START:-true}" = "true" ]; then
    system_rows=$(seed_rows) || system_rows=""

    if [ -z "$system_rows" ]; then
        log "WARNING: could not read ledger_accounts — skipping seed"
    elif [ "$system_rows" -gt 0 ]; then
        log "system ledger accounts already present ($system_rows rows) — skipping seed"
    else
        log "seeding system ledger accounts ..."
        node dist/database/seed.js >/dev/null 2>&1 &
        seed_pid=$!
        # Poll for the committed rows (usually well under a second) instead of
        # waiting on a process that idles for its pool timeout. 30 x 500ms = 15s.
        waited=0
        while [ "$waited" -lt 30 ]; do
            if ! kill -0 "$seed_pid" 2>/dev/null; then
                break
            fi
            sleep 0.5
            waited=$((waited + 1))
            system_rows=$(seed_rows) || system_rows=""
            if [ -n "$system_rows" ] && [ "$system_rows" -gt 0 ]; then
                break
            fi
        done

        final_rows=$(seed_rows)
        if [ -n "$final_rows" ] && [ "$final_rows" -gt 0 ]; then
            log "seed complete ($final_rows system ledger accounts)"
        else
            log "WARNING: seed did not create system ledger accounts — banking operations may fail"
        fi

        # The seed's pool never closes; stop the lingering process if it is still
        # around. The INSERT has already committed, so this is safe.
        kill "$seed_pid" 2>/dev/null || true
        wait "$seed_pid" 2>/dev/null || true
    fi
fi

# ---------------------------------------------------------------------------
# 5. Start the application
# ---------------------------------------------------------------------------
log "starting: $*"
exec "$@"
