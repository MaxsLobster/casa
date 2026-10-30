-- v4: Legende in der Woche pro Person ausblendbar
alter table public.settings add column if not exists show_legend boolean not null default true;
