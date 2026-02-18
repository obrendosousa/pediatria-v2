# Webhook WhatsApp (Evolution) - Local e VPS

Este guia deixa o projeto pronto para:

1. Testar localmente com URL publica automatica.
2. Trocar para URL final de producao na VPS sem mudar o path.

## 1) Teste local com `npm run dev`

Comando:

```bash
npm run dev
```

Agora o script de desenvolvimento sobe:

- Next.js local (porta `3000`, ou a porta definida em `PORT`).
- Tunel `cloudflared` (quando instalado).

Quando o tunel conectar, o terminal vai mostrar:

- `URL publica do app: https://...trycloudflare.com`
- `Webhook para colar na Evolution: https://...trycloudflare.com/api/whatsapp/webhook`

Use exatamente esse segundo link no campo URL da Evolution.

### Pre-requisito local

Se o `cloudflared` nao estiver instalado:

```bash
brew install cloudflared
```

## 2) Configuracao da Evolution (local e producao)

- `Enabled`: ON
- Evento essencial: `MESSAGES_UPSERT`: ON
- URL: sempre `{BASE_URL}/api/whatsapp/webhook`

**Obrigatório** para confirmação de entrega/leitura (checks na interface):

- `MESSAGES_UPDATE`: ON — Atualiza status (✓ enviado, ✓✓ entregue, ✓✓ lido)
  - Sem este evento, as mensagens ficam sempre com um check só
  - Contatos sem confirmação de leitura ativa: mostram ✓✓ cinza (entregue) como máximo
- `MESSAGES_DELETE`: ON

Sobre `webhook_by_events`:

- `false` (recomendado): usa URL unica (`/api/whatsapp/webhook`)
- `true`: a Evolution adiciona sufixo por evento; este projeto tambem suporta:
  - `/api/whatsapp/webhook/messages-upsert`
  - `/api/whatsapp/webhook/messages-update`
  - etc.

## 3) URL final para VPS (producao)

Quando subir na VPS com dominio e HTTPS, troque apenas a base:

`https://SEU_DOMINIO/api/whatsapp/webhook`

Exemplo:

`https://app.suaclinica.com.br/api/whatsapp/webhook`

## 4) Passo a passo de virada para producao (VPS)

1. Subir app na VPS (`npm ci`, `npm run build`, `npm start` com PM2/systemd).
2. Configurar Nginx/Caddy como reverse proxy.
3. Ativar SSL (Let's Encrypt).
4. Validar rota externamente:

```bash
curl -X POST "https://SEU_DOMINIO/api/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -d '{"data":{"key":{"remoteJid":"5511999999999@s.whatsapp.net","fromMe":false,"id":"teste"},"pushName":"Teste Cliente","messageType":"conversation","message":{"conversation":"oi"},"messageTimestamp":1739190000}}'
```

Resposta esperada:

```json
{"status":"processed"}
```

5. Atualizar a URL na Evolution para a URL da VPS:

`https://SEU_DOMINIO/api/whatsapp/webhook`

## 5) Regra importante

O path do webhook nao muda entre ambientes:

`/api/whatsapp/webhook`

So muda o dominio:

- local: `https://xxxxx.trycloudflare.com`
- producao: `https://SEU_DOMINIO`
