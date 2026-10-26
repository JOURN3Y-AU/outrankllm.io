-- Stop refreshing a subscription without touching what it can see.
--
-- Internal and demo domains were scanning weekly alongside paying customers.
-- Setting status to something other than 'active' would have stopped the scans,
-- but domain_subscriptions.status also drives tier and report access, so it
-- would have revoked the reports too. HiringBrand already separates the two
-- with monitored_domains.schedule_paused; this is the same idea for outrankllm.
--
-- Paused means: the hourly dispatcher skips it and the Monday digest skips it.
-- The subscription stays active, the existing reports stay readable, and
-- clearing the flag resumes the next weekly slot.
alter table domain_subscriptions
  add column if not exists scan_paused boolean not null default false;

comment on column domain_subscriptions.scan_paused is
  'True stops weekly scans and the digest for this domain. Entitlements unaffected.';
