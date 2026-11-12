-- Mila · keine Automatik mehr: Mila schlägt nur vor (Karte + Trefferliste), die Woche füllen Max und Anna selbst.
-- Die Karte für die nächste Woche ist immer offen: ab Montag 0 Uhr bis Sonntag 20 Uhr.

alter table public.mila_settings
  alter column card_weekday set default 1,
  alter column card_time set default '00:00',
  alter column close_weekday set default 7,
  alter column close_time set default '20:00';
update public.mila_settings set card_weekday = 1, card_time = '00:00', close_weekday = 7, close_time = '20:00';

-- Von Mila automatisch eingetragene Gerichte der Woche 9.–13.11.2026 entfernen (Max, 12.11.2026)
delete from public.mila_week_days where date between '2026-11-09' and '2026-11-13' and created_by is null;

-- Takt: nur noch Karte anlegen und nach der Frist aufdecken, nichts mehr automatisch übernehmen
create or replace function public.mila_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  local_now timestamp := now() at time zone 'Europe/Berlin';
  next_monday date := (date_trunc('week', local_now)::date + 7);
  need boolean;
  url text;
  key text;
begin
  select exists (
    select 1 from public.mila_settings s
    where local_now >= (next_monday - 7 + (s.card_weekday - 1)) + s.card_time
      and not exists (select 1 from public.mila_menus m where m.household_id = s.household_id and m.week = next_monday)
  ) or exists (
    select 1 from public.mila_menus m where m.closes_at <= now() and (m.revealed_at is null or m.plan is null) and m.week > local_now::date - 7
  ) into need;
  if not need then return; end if;
  select replace(value, 'send-push', 'mila-tick') into url from public.app_config where key = 'send_push_url';
  select value into key from public.app_config where key = 'cron_secret';
  if url is null or key is null then return; end if;
  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;
