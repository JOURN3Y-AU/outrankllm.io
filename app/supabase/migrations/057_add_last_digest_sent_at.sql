-- Records the weekly digest send, so a retry cannot email a client twice.
--
-- weekly-digest-dispatcher runs hourly and fires each subscription in its own
-- timezone. It has retries: 2, and its send step is not idempotent on its own,
-- so it checks this column against a 72-hour cooldown before sending.
--
-- Applied directly to production on 2026-09-30 alongside the slot spread and
-- recorded here after the fact, so the repo describes its own schema.
alter table domain_subscriptions
  add column if not exists last_digest_sent_at timestamptz;

comment on column domain_subscriptions.last_digest_sent_at is
  'When the weekly digest last went out. Guards against a retry re-sending.';
