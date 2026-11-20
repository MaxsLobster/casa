-- Nachzug „Wer hat Valerie?“: ein Merker an Terminen und Aufgaben.
-- Fügt hinzu: Spalte valerie_cleared (ja/nein, Standard nein) bei events und tasks.
-- Bedeutung: „geklärt – dieser Eintrag ersetzt nicht das Bringen/Holen“ (Nachfrage beim Eintragen mit Nein
-- beantwortet oder im Hinweis „Wer holt?“ die eingetragene Person gewählt). Dann fragt Casa nicht noch einmal.
-- Bestehende Einträge bleiben unverändert (Standard nein). Nichts wird gelöscht. Keine Mitteilungen dadurch.

alter table public.events add column if not exists valerie_cleared boolean not null default false;
alter table public.tasks add column if not exists valerie_cleared boolean not null default false;
