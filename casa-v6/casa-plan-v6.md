# Casa – Plan zu Auftrag v6 (Ereignisse mit Wirkung auf die Normalwoche)

Stand 1.11.2026. Bitte lesen und freigeben, dann baue ich.

## Kurz gesagt

Ein Ereignis bekommt ein neues Feld **„Was bedeutet das?“**. Standard ist „Nur Termin“ (alles wie bisher).
Die anderen vier Werte verändern nur die **Anzeige** der Normalwoche an den Tagen des Ereignisses.
Die Normalwoche selbst wird nicht angefasst, nichts wird kopiert oder gelöscht. Löscht man das Ereignis, ist alles wieder wie vorher.

## Datenmodell (eine Migration, nur neue Spalten)

Tabelle `events` bekommt:

| Spalte | Typ | Bedeutung |
|---|---|---|
| `effect` | text, Standard `'termin'` | `termin` · `valerie_weg` · `kita_zu` · `eltern_weg` |
| `dropoff_by` | text | Valerie ist weg: wer bringt sie hin (Name wie in der Woche: „Max“, „Anna“, „Oma“ …) |
| `dropoff_at` | time | … und wann |
| `pickup_by` | text | wer holt sie ab |
| `pickup_at` | time | … und wann (danach endet Gold, abends gilt wieder die Normalwoche) |

Wer weg ist, steckt in den vorhandenen Spalten:
- `valerie_weg`: `person_id` = Oma oder Theresa (bei wem). Ohne Person steht einfach der Titel (z. B. „bei Freunden“).
- `eltern_weg`: `member_id` = Max oder Anna. So gibt es „Max ist weg“ und „Anna ist weg“ ohne zwei Typen.
- `kita_zu`: keine Person.

**Keine neue Tabelle.** Die Antworten auf die offenen Chips landen dort, wo Übernehmen heute schon landet:
- „Valerie tagsüber · wer?“ (Kita zu) → `week_overrides` mit neuem Slot `valerie_tag` (Wert Max / Anna / beide / Oma / Theresa). Die Spalte `slot` ist frei wählbarer Text, dafür braucht es keine Schemaänderung.
- Offene Slots durch „Max/Anna ist weg“ (Bringen, Holen, Essen, Bett) → `week_overrides` wie bisher.
- Übergabe bei „Valerie ist weg“ → direkt im Ereignis (`dropoff_*`, `pickup_*`).

Die Migration passt außerdem zwei vorhandene Datenbank-Funktionen an (kein neues Schema):
- Push bei neuem Ereignis: bei `eltern_weg` genau **eine** Mitteilung an den anderen, z. B. „Max ist Fr–So weg. Offen: 3 Dinge“. Die Zahl zählt die Normalwoche-Einträge an diesen Tagen, die bei Max liegen und noch niemand übernommen hat. Bei `valerie_weg`/`kita_zu` heißt die Mitteilung „Anna hat eingetragen: Valerie bei Oma So–Di“ statt „einen Termin“.
- Push bei Abweichung: der neue Slot `valerie_tag` heißt in der Mitteilung „Valerie tagsüber“.

## Regeln pro Typ (so wie im Auftrag, mit meinen Festlegungen)

**Valerie ist weg**
- Alle Tage: Bringen, Holen, Bettgehen weg. Zeile „Valerie bei Oma (So–Di)“ statt der Valerie-Zeile. Gold den ganzen Tag.
- Erster Tag: Chip „Wer bringt sie hin? · übernehmen“ (mit Uhrzeit), wenn beim Eintragen nichts festgelegt wurde. Ist eine Hinbring-Zeit gesetzt, beginnt Gold erst dann.
- Letzter Tag: Chip „Wer holt sie ab? · übernehmen“ (mit Uhrzeit). Gold endet zur Abholzeit. Abends gilt wieder die Normalwoche, also bleibt am letzten Tag das Bettgehen stehen.
- Kochen bleibt an allen Tagen stehen (ist kein Valerie-Eintrag).
- Festlegung: Wochenend-Slot („Familientag“) lasse ich stehen, der Auftrag nennt nur Bringen, Holen, Bettgehen.

**Kita zu**
- Bringen und Holen weg. Kein Gold.
- Pro Tag Chip „Valerie tagsüber · wer?“ (Max / Anna / beide / Oma / Theresa). Gewählt → Zeile „Valerie: tagsüber bei Max“. Festlegung: wählt man Oma oder Theresa, wird 8–18 Uhr gold (versorgt), bei Max/Anna/beide bleibt es ohne Gold.
- Überschneidung mit „Valerie ist weg“: Valerie ist weg gewinnt (kein Chip, gold).

**Max ist weg / Anna ist weg**
- Jeder Normalwoche-Eintrag an diesen Tagen mit dieser Person (Bringen, Holen, Kochen, Bett) wird ein offener Slot mit gestricheltem Kreis und Chip „… offen · übernehmen“. Bereits eingetragene Abweichungen bleiben.
- Festlegung: die Zeile „Anna: Arbeit 8 Std.“ wird an Annas Weg-Tagen ausgeblendet.
- Aufgaben, die an diesen Tagen bei der Person fällig sind, bekommen in To-Dos und in der Woche einen kleinen Hinweis „Max ist weg – trotzdem bei ihm lassen?“ (antippen öffnet die Aufgabe, dort kann man sie dem anderen geben).
- Eine gesammelte Push-Mitteilung beim Eintragen (siehe oben).

## Anzeige

- Woche zugeklappt: Streifen rechts bleibt (gold bei Valerie, navy sonst). Gestrichelter Kreis, sobald an dem Tag etwas offen ist (auch Bringen/Holen, Valerie tagsüber, Übergabe).
- Woche aufgeklappt: entfallene Einträge fehlen, stattdessen eine Zeile mit dem Ereignis (antippen = Ereignis bearbeiten). Unter „Termine“ taucht das Ereignis nicht noch einmal auf.
- Heute: dieselbe Rechnung, nur für heute. Offene Chips erscheinen auf Heute wie bisher nicht. Laufende Wirkungs-Ereignisse stehen als Zeile unter „Heute noch“ und nicht zusätzlich unter „Demnächst“.
- Mini-Band und Zeitstrahl rechnen über dieselbe Funktion, also immer gleich.

## Eintragen

- In „Neu → Termin“ und im Bearbeiten-Fenster: Chips „Was bedeutet das?“: Nur Termin · Valerie ist weg · Kita zu · Max ist weg · Anna ist weg.
- Bei „Valerie ist weg“: „Bei wem?“ (Oma / Theresa), dann „Wer bringt sie hin? Wann?“ und „Wer holt sie ab? Wann?“ – beides optional, sonst offener Chip.
- Bei „Kita zu“ und „Max/Anna ist weg“ entfällt die Frage „Wer?“.
- Lässt man den Titel leer, trage ich ihn automatisch ein („Valerie bei Oma“, „Kita zu“, „Max weg“).

## Was ich außerhalb des Codes tun werde (jeweils erst nach deinem Ja)

1. `supabase db push` mit der einen Migration (neue Spalten, zwei Funktionen angepasst).
2. Das vorhandene Ereignis „Aufenthalt“ (So 1.11. – Di 3.11., Person Oma) auf `valerie_weg` setzen. Titel würde ich auf „Valerie bei Oma“ ändern. Dazu deine Antwort: **gibt es am Dienstag eine Abholzeit, und wer holt?**
3. „Kita zu“ eintragen. Dazu deine Antwort: **von wann bis wann?** (Vermutlich Mo 2.11. – Fr 6.11.?)

## Nicht Teil davon

- Mila bleibt unberührt.
- Das Morgenbriefing zählt weiterhin die Ereignisse des Tages auf (dort steht dann „Valerie bei Oma“), die Normalwoche-Logik im Briefing ändere ich nicht.
