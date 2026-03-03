# Deploy Ubuntu VPS (PM2 + Nginx + Certbot)

## 1. Pacotes base

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mysql-server certbot python3-certbot-nginx ufw curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 2. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## 3. MySQL local

```bash
sudo mysql -e "CREATE DATABASE cronograma_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'cronograma_user'@'127.0.0.1' IDENTIFIED BY 'TROCAR_SENHA_FORTE';"
sudo mysql -e "GRANT ALL PRIVILEGES ON cronograma_db.* TO 'cronograma_user'@'127.0.0.1'; FLUSH PRIVILEGES;"
```

## 4. App na VPS

```bash
sudo mkdir -p /var/www/cronograma-saas
sudo chown -R $USER:$USER /var/www/cronograma-saas
git clone <SEU_REPOSITORIO> /var/www/cronograma-saas
cd /var/www/cronograma-saas
cp .env.example .env
```

Preencha o `.env` com foco em:
- `DATABASE_URL`
- `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `HEROSPARK_WEBHOOK_SECRET`

## 5. Build + Prisma

```bash
cd /var/www/cronograma-saas
npm ci
npm run db:generate
npm run db:migrate
npm run content:import
npm run build
mkdir -p logs
```

## 6. PM2

```bash
cd /var/www/cronograma-saas
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u $USER --hp /home/$USER
```

Comandos uteis:

```bash
pm2 status
pm2 logs cronograma-saas
pm2 restart cronograma-saas
```

## 7. Nginx reverse proxy

Copie `ops/nginx/cronograma-saas.conf` para `/etc/nginx/sites-available/cronograma-saas` e ajuste `server_name`.

```bash
sudo ln -s /etc/nginx/sites-available/cronograma-saas /etc/nginx/sites-enabled/cronograma-saas
sudo nginx -t
sudo systemctl reload nginx
```

## 8. SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d cronograma.enfermeiroaprovado.com.br
sudo certbot renew --dry-run
```

## 9. Rotina de deploy

```bash
cd /var/www/cronograma-saas
git pull origin main
npm ci
npm run db:migrate
npm run content:import
npm run build
pm2 reload cronograma-saas --update-env
```

## 10. Rollback rapido

```bash
cd /var/www/cronograma-saas
git log --oneline -n 5
git checkout <COMMIT_ANTERIOR>
npm ci
npm run db:migrate
npm run build
pm2 reload cronograma-saas --update-env
```
