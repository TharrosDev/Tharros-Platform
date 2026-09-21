-- Assistant UI — per-turn presentation data (tool step trail, result cards,
-- follow-up suggestions) so a reload shows the same turn. Written by the
-- service-role assistant seam only; authenticated inserts stay limited to the
-- column grant (conversation_id, org_id, role, content).
--
-- Apply to BOTH prod (inxhrijqyxvwoeqczbrl) and test (psunqcyzjcmfgcrnowdl).

alter table public.messages add column if not exists meta jsonb;
