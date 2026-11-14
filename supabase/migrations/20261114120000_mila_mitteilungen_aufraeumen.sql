-- Mila · Mitteilungen zur Wochenwahl, Woche verwerfen, Aufräumen
-- Nur Mila-Mitteilungen; andere Casa- und MWF-Mitteilungen bleiben unverändert.

-- Pro Person ein/aus (Standard: an)
alter table public.settings add column if not exists mila_notify boolean not null default true;

-- Wochen-Plan: Erinnerung nur einmal, Woche lässt sich verwerfen
alter table public.mila_week_plans add column if not exists erinnert_at timestamptz;
alter table public.mila_week_plans drop constraint if exists mila_week_plans_status_check;
alter table public.mila_week_plans add constraint mila_week_plans_status_check check (status in ('wischen', 'kombo', 'aktiv', 'fertig', 'verworfen'));

-- Freitag: neue Wahl angelegt → „Wochenwahl läuft“
create or replace function public.notify_mila_wahl()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select m.id from public.members m
    join public.settings s on s.member_id = m.id and s.mila_notify
    where m.household_id = new.household_id and m.role = 'partner'
      and exists (select 1 from public.push_subscriptions p where p.member_id = m.id)
  loop
    perform public.enqueue_notification(new.household_id, r.id, 'mila', 'Wochenwahl läuft', 'bis Sonntag 20 Uhr wischen', '#/mila/wahl', null, null);
  end loop;
  return new;
end $$;
drop trigger if exists mila_week_plans_notify on public.mila_week_plans;
create trigger mila_week_plans_notify after insert on public.mila_week_plans for each row execute function public.notify_mila_wahl();

-- Sonntag 17 Uhr (3 Stunden vor der Frist): nur an den, der noch nicht fertig gewischt hat
create or replace function public.mila_wahl_erinnern()
returns void language plpgsql security definer set search_path = public as $$
declare p record; r record; deck_n integer;
begin
  for p in
    select * from public.mila_week_plans
    where status = 'wischen' and erinnert_at is null and now() >= deadline - interval '3 hours' and now() < deadline
  loop
    deck_n := jsonb_array_length(p.deck);
    for r in
      select m.id from public.members m
      join public.settings s on s.member_id = m.id and s.mila_notify
      where m.household_id = p.household_id and m.role = 'partner'
        and exists (select 1 from public.push_subscriptions ps where ps.member_id = m.id)
        and (deck_n = 0 or (select count(*) from public.mila_swipes w where w.plan_id = p.id and w.member_id = m.id) < deck_n)
    loop
      perform public.enqueue_notification(p.household_id, r.id, 'mila', 'Noch 3 Stunden für die Wochenwahl', 'Bis 20 Uhr wischen, dann kommt eure Kombo', '#/mila/wahl', null, null);
    end loop;
    update public.mila_week_plans set erinnert_at = now() where id = p.id;
  end loop;
end $$;
revoke all on function public.mila_wahl_erinnern() from public;
select cron.schedule('casa-mila-erinnern', '* * * * *', $$select public.mila_wahl_erinnern()$$);

-- Aufräumen: aus Versehen eingetragene Caponata (Mittag, 9.11.)
delete from public.mila_week_days w
using public.mila_recipes r
where r.id = w.recipe_id and w.date = '2026-11-09' and w.meal = 'mittag' and r.name = 'Caponata';
