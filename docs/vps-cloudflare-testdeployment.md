# EqualPay Testdeployment auf VPS mit Cloudflare

Ziel: Die Pay-Transparency-Anwendung fuer Kundentests unter `https://equalpay.ezag.ai` bereitstellen, ohne Zugriff auf die Kundeninfrastruktur und ohne die VPS-Origin-IP oeffentlich fuer HTTP/HTTPS zu exponieren.

## Zielarchitektur

- Cloudflare DNS: `equalpay.ezag.ai`
- Cloudflare Tunnel: oeffentlicher HTTPS-Endpunkt bei Cloudflare, ausgehend verbundener Tunnel vom VPS
- Cloudflare Access: vorgelagerte Identitaets- und E-Mail-Policy vor der Anwendung
- VPS: Docker Compose mit App, PostgreSQL und `cloudflared`
- PostgreSQL: nur im internen Docker-Netz, kein Host-Port
- App: nur im internen Docker-Netz, kein Host-Port
- SSH: nur fuer Administration, per Key, restriktiv erlaubt

## Cloudflare Mindestkonfiguration

1. DNS-Zone `ezag.ai` in Cloudflare verwalten.
2. Zero Trust aktivieren.
3. Tunnel erstellen, z. B. `equalpay-vps-test`.
4. Public Hostname anlegen:
   - Hostname: `equalpay.ezag.ai`
   - Service: `http://paytransparency:3000`
5. Access Application fuer `equalpay.ezag.ai` anlegen.
6. Access Policy:
   - Nur explizit freigegebene E-Mail-Adressen oder Kundendomains.
   - Fuer sensible Tests bevorzugt Einladungsgruppe statt ganze Domain.
   - Session-Dauer kurz halten, z. B. 8 bis 12 Stunden.
7. Cloudflare WAF/Bot/Rate-Limit:
   - Managed WAF Rules aktivieren.
   - Rate Limit fuer `/api/auth/login`.
   - Optional Land-/ASN-Einschraenkung, wenn der Testerkreis bekannt ist.

Wichtig: Der Cloudflare Access Login ersetzt nicht den App-Login. Fuer diese Testphase ist bewusst doppelte Absicherung vorgesehen: Cloudflare Access vor der App und lokale App-Benutzer innerhalb der Anwendung.

## VPS Härtung

Firewall:

- Eingehend erlauben:
  - SSH nur von eigener Admin-IP oder VPN.
- Eingehend nicht oeffnen:
  - 80
  - 443
  - 3000
  - 5432/5438
- Ausgehend erlauben:
  - HTTPS fuer Cloudflare Tunnel, Paketupdates und Container Pulls.

SSH:

- Passwortlogin deaktivieren.
- Root-Login deaktivieren.
- Nur SSH-Key.
- Optional Fail2ban oder Provider-Firewall-Regeln.

System:

- Automatische Security Updates aktivieren.
- Docker nur fuer dedizierten Deployment-User.
- Keine Testdaten, Backups oder `.env.production` im Git ablegen.

## Secrets erzeugen

Auf dem VPS:

```bash
openssl rand -base64 32
openssl rand -base64 32
openssl rand -base64 48
```

Verwendung:

- `SESSION_SECRET`: 32 Byte Zufallswert
- `FIELD_ENCRYPTION_MASTER_KEY_B64`: 32 Byte Base64-Key
- `POSTGRES_PASSWORD`: langer Zufallswert, nicht wiederverwenden

## Deployment

1. Repository auf den VPS kopieren.
2. Produktions-Env anlegen:

```bash
cp deploy/env.production.example .env.production
chmod 600 .env.production
```

3. Werte in `.env.production` setzen.
4. Container bauen und starten:

```bash
docker compose --env-file .env.production -f deploy/docker-compose.vps.yml up -d --build
```

5. Migrationen anwenden:

```bash
docker compose --env-file .env.production -f deploy/docker-compose.vps.yml exec paytransparency npx prisma migrate deploy
```

6. Optional Demo-/Initialdaten einspielen:

```bash
docker compose --env-file .env.production -f deploy/docker-compose.vps.yml exec paytransparency npx prisma db seed
```

7. Status pruefen:

```bash
docker compose --env-file .env.production -f deploy/docker-compose.vps.yml ps
docker compose --env-file .env.production -f deploy/docker-compose.vps.yml logs --tail=100 paytransparency
docker compose --env-file .env.production -f deploy/docker-compose.vps.yml logs --tail=100 cloudflared
```

## App-Benutzer fuer Kundentest

- Cloudflare Access: nur freigegebene Testpersonen.
- App: lokale Benutzer mit minimal benoetigten Rollen.
- Keine produktiven HR- oder Gehaltsdaten verwenden.
- Testdaten pseudonymisieren.
- Nach Testende Benutzer deaktivieren und Access Policy entfernen.

## Go/No-Go vor Kundentest

Go nur, wenn alle Punkte erfuellt sind:

- `https://equalpay.ezag.ai` ist nur nach Cloudflare Access erreichbar.
- VPS hat keine offenen Ports fuer App oder PostgreSQL.
- PostgreSQL ist nicht von extern erreichbar.
- `.env.production` hat echte Zufallswerte, keine Platzhalter.
- `FIELD_ENCRYPTION_MASTER_KEY_B64` ist gesetzt und sicher gesichert.
- App laeuft mit `NODE_ENV=production`.
- `npx prisma migrate deploy` ist erfolgreich gelaufen.
- Testnutzer haben nur notwendige Rollen.
- Audit Trail schreibt Login, Rollen, Exporte, Entschluesselung und Onboarding.
- Backup-/Restore-Verfahren fuer die Testdatenbank ist mindestens einmal geprueft.

## Nach Testende

- Cloudflare Access Application deaktivieren oder Policy leeren.
- Lokale App-Benutzer deaktivieren.
- Testdaten exportieren oder loeschen, je nach Vereinbarung.
- VPS-Snapshots mit personenbezogenen Testdaten loeschen.
- Tunnel Token rotieren oder Tunnel entfernen.
