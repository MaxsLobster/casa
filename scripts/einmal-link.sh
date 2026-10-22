#!/bin/sh
# Erzeugt einen Einmal-Link „Passwort festlegen" für eine der zwei Casa-Adressen – ohne Mail-Versand.
# Nutzt den service_role-Key nur hier, lokal; er wird nirgends gespeichert.
# Aufruf: sh scripts/einmal-link.sh anna.f.erlacher@gmail.com
set -e
EMAIL="$1"
[ -n "$EMAIL" ] || { echo "Aufruf: sh scripts/einmal-link.sh name@beispiel.de"; exit 1; }
REF="qndejfhlemqiobatlgkf"
URL="https://$REF.supabase.co"
SR=$(supabase projects api-keys --project-ref "$REF" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); ks=d if isinstance(d,list) else d.get('api_keys',d.get('keys',d)); print([k['api_key'] for k in ks if k.get('name')=='service_role'][0])")
curl -s -X POST "$URL/auth/v1/admin/generate_link" \
  -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" \
  -d "{\"type\":\"recovery\",\"email\":\"$EMAIL\",\"options\":{\"redirect_to\":\"https://maxslobster.github.io/casa/\"}}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('action_link') or d)"
