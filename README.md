# BigBlackTea (BBT) – VALORANT Premier Team Manager (Website & Android-APK)

Moderne Web-App und installierbare Android-App (via Capacitor) für das VALORANT-Premier-Team **BigBlackTea (`BBT`)**.

> **100 % Manuelle Verwaltung – Keine Riot-API – Keine erfundenen Daten:**
> Alle Daten (Spieler, Gegner, Agents, Premier-Matches und Ergebnisse) werden ausschließlich manuell durch das Team gepflegt. Beim ersten Start sind alle sechs BBT-Spieler angelegt und es werden **keine** erfundenen Matches oder Ranglisten angezeigt.

---

## 1. Teambranding & Design

- **Teamname:** `BigBlackTea`
- **Teamkürzel:** `BBT`
- **Original-Teamlogo:** Unverzerrte Darstellung von `public/bbt-original.png`, `public/bbt-logo.png` und `public/bbt-banner.png`.
- **E-Sports-Farbschema:**
  - **Hintergrund:** Schwarz (`#0B0C0E`) & dunkles Anthrazit (`#14171A`)
  - **Primärer Akzent:** Dunkelrot (`#8B0E12` / `#B31921`)
  - **Überschriften & Statistiken:** Beige (`#C8A273`) & Grau (`#878C8F`)
  - **Zusätzlicher Akzent:** Türkis (`#73FBD3`)

---

## 2. Vorab angelegter BBT-Teamkader (Jederzeit bearbeitbar & erweiterbar)

1. **Lunar** — Riot-Tag: `#7822`
2. **Kuronami 雨雲** — Riot-Tag: `#RED`
3. **fydi** — Riot-Tag: `#9522`
4. **XJoshHD** — Riot-Tag: `#9317`
5. **XxSensenmanX** — Riot-Tag: `#7267`
6. **ShadowLina** — Riot-Tag: `#6700`

---

## 3. Funktionsumfang & Navigation

1. **Dashboard:**
   - Unverzerrtes Original-Logo und `BigBlackTea (BBT)`
   - Live berechnete Team-Kennzahlen: Matches, Siege/Niederlagen, Winrate, Gesamt-Kills/-Deaths/-Assists, Team-K/D
   - Letztes Match, letzte fünf Matches, Top-Fragger, Spieler mit der höchsten K/D, meistgespielte Agents
   - Leerer Zustand („Noch keine Premier-Matches eingetragen“) mit Schaltfläche **„Erstes Match eintragen“**, solange noch keine Matches erfasst wurden
2. **Team & Spieler (+ Gegnerverwaltung):**
   - Spieler hinzufügen, bearbeiten (Name, Riot-Tag, Rolle, Lieblingsagenten, Profilbild) und entfernen
   - Eigene Profilseite für jeden Spieler inkl. Gesamt- und Durchschnittswerten (`Ø Kills`, `Ø Deaths`, `Ø Assists`), K/D, KDA, Winrate, Agenten-Statistiken (meistgespielter Agent, Spiele/Siege/Winrate/K/D pro Agent) und persönlicher Matchhistorie
   - Integrierte **Gegnerverwaltung** mit Teamname, Logo, Bilanz, historischen Ergebnissen und eigenen Taktik-Notizen
3. **Matchverlauf & Manuelle Matcheingabe:**
   - Schaltfläche **„Neues Match eintragen“**
   - Erfassung von Datum/Uhrzeit, Saison/Episode, Gegner (aus Liste oder neu), Map, Rundenergebnis, Sieg/Niederlage, Notizen sowie individuellen Spielerstatistiken (mind. 5 Spieler, Agenten-Auswahl aus allen VALORANT-Agents, Kills, Deaths, Assists, optional ACS, HS% & Notiz)
   - Filter nach Saison, Gegner, Map, Spieler, Agent und Sieg/Niederlage
   - Detailansicht, Bearbeiten und Löschen von Matches
4. **Statistiken:**
   - Ausführliche Teamstatistiken inkl. durchschnittlicher Rundendifferenz, Statistiken pro Map, Statistiken pro Agent und Entwicklung der letzten Matches
   - **Spielervergleich-Tabelle** (`Spieler | Matches | Kills | Deaths | Assists | K/D | Winrate`), sortierbar nach K/D, Kills, Winrate oder Matches
   - Sichere Sonderbehandlung bei `0 Deaths` (keine Division durch 0) und `0 Matches` (keine Prozentzahl bei Winrate)
5. **Admin / Datenverwaltung:**
   - Geschützter Admin-Bereich (Standard-Login: `admin` / `BBT2026!`)
   - CSV-Export für Matches und Spielerstatistiken
   - JSON-Komplettsicherung (Backup) & Wiederherstellung (Import)
   - Synchronisation zwischen Website und Android-APK (inkl. Offline-Warteschlange ohne Duplikate)

---

## 4. Datenbankkonfiguration (Supabase / PostgreSQL & Lokale Persistenz)

- **PostgreSQL / Supabase SQL-Schema:** [`supabase/schema.sql`](./supabase/schema.sql) (Tabellen: `teams`, `seasons`, `agents`, `players`, `opponents`, `matches`, `match_lineups`, `match_player_stats`, `users`, `custom_standings`)
- **Prisma ORM Schema:** [`prisma/schema.prisma`](./prisma/schema.prisma)
- **Lokale Server-Persistenz & Automatische Backups:** `data/premier-db.json` sowie tägliche Snapshots in `data/backups/`

---

## 5. Anleitung: Starten & Android-APK erstellen

### Website lokal starten
```powershell
npm.cmd install
npm.cmd test
npm.cmd run dev
```
Die Web-App läuft anschließend unter `http://localhost:3000`.

### Installierbare Android-APK kompilieren
```powershell
npm.cmd run apk:build
```
Das Skript `scripts/build-apk.ps1` baut das statische Frontend-Bundle, synchronisiert Capacitor (`npx cap sync android`), kompiliert die APK über Gradle (`gradlew assembleDebug`) und legt die fertige APK ab unter:
- `release/BigBlackTea-BBT-premier-tracker.apk`
- `release/valorant-premier-tracker.apk`
