# Backup no Google Drive

Código em `src/lib/backup/`. Duas formas de uso, com o mesmo app do Google:

- **Empresas**: Configurações → Backup → "Conectar Google Drive". Cada empresa
  recebe um ZIP (planilhas CSV + JSON + fotos) na pasta `SPACE TECH - Backup`
  do próprio Drive, todo dia de madrugada ou pelo botão "Fazer backup agora".
  Ficam os 14 mais novos. Só o dono da conta configura.
- **Servidor (operador)**: /admin → "Backup do servidor no Google Drive". O
  dump completo de `scripts/backup-banco.sh` (banco + Storage) vai para a pasta
  `SPACE TECH - Backup do servidor`. Ficam os 7 mais novos de cada arquivo.

A rotina diária roda no fim de `scripts/backup-banco.sh` (cron às 3h de
Brasília), via `POST /api/backup-drive/cron`.

## Configurar o app no Google Cloud (uma vez)

1. Acesse https://console.cloud.google.com/ e crie um projeto (ex.: `SPACE TECH OS`).
2. **APIs e serviços → Biblioteca**: ative a **Google Drive API**.
3. **APIs e serviços → Tela de consentimento OAuth** (Google Auth Platform):
   - Tipo de usuário: **Externo**.
   - Nome do app: `SPACE TECH OS`; e-mail de suporte; domínio autorizado:
     `srmpretech.online`.
   - **Acesso a dados**: adicione os escopos `.../auth/drive.file`, `openid` e
     `.../auth/userinfo.email` e salve (não são sensíveis, não exigem
     verificação). Sem registrar, o Google corta o drive.file em silêncio e a
     conexão falha com "É preciso marcar a permissão de acesso ao Google Drive".
   - **Branding**: links de `https://srmpretech.online/privacidade` e
     `https://srmpretech.online/termos` (obrigatórios para publicar).
   - **Público → Publicar app** ("Em produção"). Em modo "Teste" o Google
     derruba a conexão a cada 7 dias e só deixa entrar e-mails cadastrados.
4. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**.
   - URI de redirecionamento autorizado:
     `https://srmpretech.online/api/google-drive/callback`
5. Copie o **ID do cliente** e a **chave secreta** para o `.env` do servidor:

   ```
   GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=...
   ```

6. `systemctl restart space-tech-os` e conecte o Drive no /admin.

## O que entra no backup da empresa

Todas as tabelas com `user_id` da empresa (função `backup_tabelas_empresa`),
mais o perfil da empresa e as permissões dos papéis. Ficam de fora as tabelas
com credenciais: `pagamento_config`, `smtp_config`, `whatsapp_connections`,
`whatsapp_otps`. Fotos: arquivos do Storage em `<empresa>/...` e o logo
(função `backup_arquivos_empresa`); acima de 1 GB as fotos ficam de fora.

## Testar a rotina na mão

```
scripts/backup-banco.sh
```

Faz o backup local e, se o Google estiver configurado, envia para o Drive.
Log do cron: `/var/log/space-tech-backup-banco.log`.
