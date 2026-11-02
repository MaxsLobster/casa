-- Casa v9.1 · Altlast: Aufgaben, die bei der Ersteinrichtung übersprungen wurden.
-- Status bleibt „erledigt", aber sie zählen weder als erledigt noch als offen (Geschafft, Archiv, Hub-Zähler).
alter table public.tasks add column if not exists is_skipped boolean not null default false;
comment on column public.tasks.is_skipped is 'Altlast: bei der Ersteinrichtung übersprungen, zählt weder als erledigt noch als offen';
