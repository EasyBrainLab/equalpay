# GitHub Deployment fuer EqualPay

Repository: `https://github.com/EasyBrainLab/equalpay`

Der Workflow `.github/workflows/deploy-vps.yml` validiert die Anwendung bei jedem Push auf `main` und deployed danach auf den VPS. Die `.env.production` bleibt bewusst auf dem VPS und wird nicht in GitHub gespeichert.

## GitHub Secrets

Im Repository unter `Settings > Secrets and variables > Actions` anlegen:

| Secret | Pflicht | Beispiel |
| --- | --- | --- |
| `VPS_HOST` | ja | `203.0.113.10` |
| `VPS_USER` | ja | `deploy` |
| `VPS_SSH_KEY` | ja | privater SSH-Key fuer den Deploy-User |
| `VPS_PORT` | nein | `22` |
| `VPS_APP_DIR` | nein | `/opt/equalpay` |

Empfehlung: GitHub Environment `vps-test` anlegen und Deployment Approval aktivieren, damit Deploys auf den externen Testserver bewusst freigegeben werden.

## VPS vorbereiten

Einmalig auf dem VPS:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo mkdir -p /opt/equalpay
sudo chown -R deploy:deploy /opt/equalpay
```

SSH-Key des GitHub-Secrets als Public Key bei `deploy` hinterlegen:

```bash
sudo mkdir -p /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Dann die Produktionsumgebung auf dem VPS anlegen:

```bash
sudo -u deploy bash
cd /opt/equalpay
```

Nach dem ersten GitHub-Deploy liegt `deploy/env.production.example` auf dem Server. Dann:

```bash
cp deploy/env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Wichtige Werte:

- `APP_BASE_URL=https://equalpay.ezag.ai`
- `DATABASE_URL=postgresql://paytransparency:<POSTGRES_PASSWORD>@paytransparency-db:5432/paytransparency`
- `POSTGRES_PASSWORD=<starkes Passwort>`
- `SESSION_SECRET=<openssl rand -base64 32>`
- `FIELD_ENCRYPTION_MASTER_KEY_B64=<openssl rand -base64 32>`
- `CLOUDFLARE_TUNNEL_TOKEN=<Token aus Cloudflare Zero Trust>`

## Deployment starten

Push auf `main` oder manuell:

`Actions > Deploy EqualPay VPS > Run workflow`

## Nach dem Deploy pruefen

Auf dem VPS:

```bash
cd /opt/equalpay
docker compose --env-file .env.production -f deploy/docker-compose.vps.yml ps
docker compose --env-file .env.production -f deploy/docker-compose.vps.yml exec paytransparency wget -qO- http://127.0.0.1:3000/api/health
docker compose --env-file .env.production -f deploy/docker-compose.vps.yml logs --tail=100 cloudflared
```

Extern:

```bash
curl -I https://equalpay.ezag.ai/api/health
```

Wenn extern `404 page not found` kommt, ist Cloudflare Tunnel/Public Hostname noch nicht korrekt auf `http://paytransparency:3000` gemappt.
