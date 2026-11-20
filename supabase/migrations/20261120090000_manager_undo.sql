-- Rückgängig für den Casa-Manager (und „heute geht nix“) in EINEM Schritt:
-- Alle Änderungen einer Runde werden in umgekehrter Reihenfolge zurückgenommen – ganz oder gar nicht.
-- Nur eigene Runden der letzten 30 Minuten, nur Zeilen des eigenen Haushalts, nur bekannte Tabellen.
-- Fügt nur eine Funktion hinzu, ändert und löscht keine Tabellen.

create or replace function public.manager_undo(p_batch uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_member_id();
  allowed text[] := array['tasks', 'events', 'week_overrides', 'anchors', 'freizeit_tipps', 'house_entries', 'gift_people', 'gift_ideas',
                          'mila_week_plans', 'mila_plan_items', 'mila_week_days', 'mila_shopping_items'];
  r record;
  img jsonb;
  cols text;
  n integer := 0;
begin
  if me is null then
    raise exception 'Nicht angemeldet';
  end if;

  for r in
    select l.*
    from public.manager_log l
    where l.batch_id = p_batch
      and l.member_id = me
      and l.undone_at is null
      and l.created_at >= now() - interval '30 minutes'
      and l.household_id in (select public.my_household_ids())
    order by l.position desc, l.created_at desc
  loop
    if not (r.table_name = any(allowed)) then
      raise exception 'Rückgängig für % ist nicht vorgesehen', r.table_name;
    end if;
    img := coalesce(r.before, r.after);
    if img is null or (img ->> 'household_id')::uuid is distinct from r.household_id then
      raise exception 'Rückgängig: Zeile gehört nicht zum Haushalt';
    end if;

    if r.op = 'insert' then
      if r.table_name = 'gift_people' then
        -- Personen der Geschenk-Dose werden nie gelöscht, nur aus der Dose genommen
        update public.gift_people set archived_at = now() where id = r.row_id and household_id = r.household_id;
      else
        execute format('delete from public.%I where id = $1 and household_id = $2', r.table_name) using r.row_id, r.household_id;
      end if;

    elsif r.op = 'update' then
      -- Alle Spalten aus dem Vorher-Bild zurückschreiben (außer id und Zeitstempel); Bearbeiter = wer zurücknimmt
      select string_agg(
               case when c.column_name = 'updated_by' then format('%I = %L::uuid', c.column_name, me)
                    else format('%I = r.%I', c.column_name, c.column_name) end, ', ')
        into cols
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = r.table_name
        and c.column_name not in ('id', 'created_at', 'updated_at')
        and (r.before ? c.column_name or c.column_name = 'updated_by');
      if cols is not null then
        execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2 and t.household_id = $3',
                       r.table_name, cols, r.table_name)
          using r.before, r.row_id, r.household_id;
      end if;

    elsif r.op = 'delete' then
      execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict (id) do nothing', r.table_name, r.table_name)
        using r.before;
    end if;
    n := n + 1;
  end loop;

  if n = 0 then
    raise exception 'Diese Änderung lässt sich nicht mehr zurücknehmen.';
  end if;

  update public.manager_log set undone_at = now()
  where batch_id = p_batch and member_id = me and undone_at is null;
  return n;
end $$;

revoke all on function public.manager_undo(uuid) from public, anon;
grant execute on function public.manager_undo(uuid) to authenticated;
