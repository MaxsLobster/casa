-- Der Login-Trigger muss NACH dem Einfügen laufen, sonst scheitert der
-- Fremdschlüssel members.user_id → auth.users (Zeile existiert noch nicht).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
