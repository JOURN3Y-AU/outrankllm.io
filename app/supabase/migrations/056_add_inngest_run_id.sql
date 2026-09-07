-- Give the cancellation handlers a key they can actually resolve.
--
-- `inngest/function.cancelled` carries only { function_id, run_id,
-- correlation_id }. It does NOT carry `data.event`, unlike
-- `inngest/function.failed`. Both cancellation handlers were copied from the
-- failure handler and read `event.data.event`, so every field came back
-- undefined and they resolved no scan at all. Between 2026-03-23 and
-- 2026-09-07 they recorded zero of 326 failures; the health monitor swept
-- every one with a message describing the sweeper rather than the cause.
--
-- Recording the run id at setup gives the handler the one field the
-- cancellation event does carry.
alter table scan_runs add column if not exists inngest_run_id text;

create index if not exists scan_runs_inngest_run_id_idx
  on scan_runs (inngest_run_id)
  where inngest_run_id is not null;

comment on column scan_runs.inngest_run_id is
  'Inngest run id. The only join key inngest/function.cancelled provides.';
