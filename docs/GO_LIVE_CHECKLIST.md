# Go-Live Checklist (VPS Ubuntu)

Use este checklist no dia da virada para producao.

## 1) Pre-Flight (T-24h ate T-1h)

- [ ] DNS apontando para a VPS
  - Verificar:
  ```bash
  dig +short cronograma.enfermeiroaprovado.com.br
  ```
- [ ] Arquivo `.env` preenchido em producao (`/var/www/cronograma-saas/.env`)
  - Campos obrigatorios:
    - `NEXT_PUBLIC_APP_URL`
    - `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`
    - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
    - `DATABASE_URL`
    - `HEROSPARK_WEBHOOK_SECRET`
- [ ] Banco criado e usuario com permissao no `cronograma_db`
- [ ] SSL emitido e renovacao validada
  - Verificar:
  ```bash
  sudo certbot renew --dry-run
  ```
- [ ] Nginx ativo e configuracao valida
  - Verificar:
  ```bash
  sudo nginx -t && sudo systemctl status nginx --no-pager
  ```
- [ ] PM2 preparado para boot automatico
  - Verificar:
  ```bash
  pm2 status
  pm2 save
  pm2 startup
  ```

## 2) Build de Producao (T-30min)

No servidor:

```bash
cd /var/www/cronograma-saas
git pull origin main
npm ci
npm run db:generate
npm run db:migrate
npm run lint
npm run build
mkdir -p logs
```

Critero para avancar:
- [ ] `db:migrate` sem erro
- [ ] `build` sem erro

## 3) Start e Switch (T-10min)

```bash
cd /var/www/cronograma-saas
pm2 start ecosystem.config.cjs || pm2 restart cronograma-saas
pm2 save
sudo systemctl reload nginx
```

Verificacao rapida:

```bash
pm2 status
pm2 logs cronograma-saas --lines 80
curl -I https://cronograma.enfermeiroaprovado.com.br
```

Critero para avancar:
- [ ] App respondendo HTTP 200/302
- [ ] Sem erro fatal nos logs do PM2

## 4) Smoke Tests Funcionais (T0)

- [ ] Home redireciona para login
  - `https://cronograma.enfermeiroaprovado.com.br/`
- [ ] Login com Google funciona
- [ ] Login com email/senha funciona (usuario com hash cadastrado)
- [ ] Dashboard carrega e lista semanas
- [ ] Logout encerra sessao e volta ao login
- [ ] Webhook HeroSpark responde (200 para payload valido)
  - Teste rapido:
  ```bash
  curl -X POST "https://cronograma.enfermeiroaprovado.com.br/api/webhook/herospark" \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: SEU_SEGREDO" \
    -d '{"event":"payment_approved","buyer":{"email":"teste@exemplo.com","name":"Teste"}}'
  ```
- [ ] Registro criado/atualizado em `authorized_access` para email de teste

## 5) Monitoramento Pos-Go-Live (T+1h)

- [ ] Monitorar logs por 30-60 min
  ```bash
  pm2 logs cronograma-saas --lines 200
  sudo tail -n 200 /var/log/nginx/error.log
  ```
- [ ] Conferir uso de recursos
  ```bash
  free -h
  df -h
  pm2 monit
  ```
- [ ] Confirmar webhook real chegando em producao (HeroSpark)
- [ ] Confirmar que usuarios conseguem entrar sem erro

## 6) Plano de Rollback (se necessario)

```bash
cd /var/www/cronograma-saas
git log --oneline -n 5
git checkout <COMMIT_ESTAVEL>
npm ci
npm run db:migrate
npm run build
pm2 reload cronograma-saas --update-env
```

## 7) Criterio de Go-Live Concluido

- [ ] Build e migracoes OK
- [ ] SSL, Nginx e PM2 OK
- [ ] Login, dashboard, logout e webhook OK
- [ ] Sem erro critico nos logs apos 1h
