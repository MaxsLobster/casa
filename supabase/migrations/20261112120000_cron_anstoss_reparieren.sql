-- Reparatur: Der minütliche Anstoß für den Versand (und für mila-tick) brach ab, sobald etwas zu tun war.
-- Ursache: Die Variable „key“ hieß wie die Spalte app_config.key („column reference "key" is ambiguous“).
-- Seit dem 30.10.2026 kamen Mitteilungen deshalb nur an, wenn jemand gerade die App benutzt hat.

create or replace function public.trigger_send_push()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text;
  v_key text;
begin
  if not exists (select 1 from public.notifications where sent_at is null and scheduled_for <= now()) then return; end if;
  select c.value into v_url from public.app_config c where c.key = 'send_push_url';
  select c.value into v_key from public.app_config c where c.key = 'cron_secret';
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
end $$;

create or replace function public.mila_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  local_now timestamp := now() at time zone 'Europe/Berlin';
  next_monday date := (date_trunc('week', local_now)::date + 7);
  need boolean;
  v_url text;
  v_key text;
begin
  select exists (
    select 1 from public.mila_settings s
    where local_now >= (next_monday - 7 + (s.card_weekday - 1)) + s.card_time
      and not exists (select 1 from public.mila_menus m where m.household_id = s.household_id and m.week = next_monday)
  ) or exists (
    select 1 from public.mila_menus m where m.closes_at <= now() and (m.revealed_at is null or m.plan is null) and m.week > local_now::date - 7
  ) into need;
  if not need then return; end if;
  select replace(c.value, 'send-push', 'mila-tick') into v_url from public.app_config c where c.key = 'send_push_url';
  select c.value into v_key from public.app_config c where c.key = 'cron_secret';
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;
