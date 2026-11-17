# Deploy do office-runner (Escritório IA)

Pacote de artefatos para instalar o `services/office-runner` no servidor.
Nenhum segredo fica neste diretório: o `.env` real é criado em `/etc/office-runner.env` (root, 600).

## Arquivos

| Arquivo | Função |
|---|---|
| `install.sh` | Cria usuário `office`, pastas, copia o runner e instala dependências |
| `office-runner.service` | Unit do systemd (roda `node src/index.ts`) |
| `office-runner.env.example` | Modelo do ambiente, sem valores secretos |
| `nginx-office.conf` | Trecho de proxy para `/office-api/` e `/office-ws` |

## Atenção antes de começar: o site pode não usar Nginx

Os arquivos de configuração do servidor indicam que `srmpretech.online` aparece no
OpenLiteSpeed (`/usr/local/lsws/conf/httpd_config.conf`) e não há `/etc/nginx/sites-enabled`.
Antes do passo de Nginx, confirme qual servidor atende o domínio. Se for o OpenLiteSpeed,
o trecho `nginx-office.conf` precisa ser traduzido para regras de proxy/contexto do OpenLiteSpeed
(mesmo destino `127.0.0.1:4317`, com suporte a WebSocket em `/office-ws`).

## Passo a passo

1. Veja o que o script faria, sem alterar nada:

   ```bash
   cd /root/space-tech-os/deploy/office
   ./install.sh --dry-run
   ```

2. Instale (como root):

   ```bash
   sudo ./install.sh
   ```

   O script é idempotente: pode ser rodado de novo para atualizar o código copiado.
   Ele não sobrescreve `/etc/office-runner.env` se o arquivo já existir.

3. Edite o ambiente com os valores reais:

   ```bash
   sudo nano /etc/office-runner.env
   ```

   Preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
   Os demais valores já têm padrão sensato. Confirme a permissão com `ls -l /etc/office-runner.env` (deve ser `-rw------- root root`).

4. Instale a unit e suba o serviço:

   ```bash
   sudo cp /root/space-tech-os/deploy/office/office-runner.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now office-runner
   sudo systemctl status office-runner --no-pager
   ```

5. Verifique o health local (porta 4317, só em 127.0.0.1):

   ```bash
   curl -s http://127.0.0.1:4317/office-api/health
   ```

   Esperado: JSON com `"ok":true`.

6. Inclua o trecho `nginx-office.conf` dentro do bloco `server` do `srmpretech.online`
   (ou a regra equivalente no OpenLiteSpeed; veja o aviso acima).

7. Teste e recarregue o servidor web (apenas no caso de Nginx):

   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

8. Verifique a rota pública de agentes sem token. Deve responder **401**:

   ```bash
   curl -i https://srmpretech.online/office-api/agents
   ```

   Também confira o health pela rota pública:

   ```bash
   curl -s https://srmpretech.online/office-api/health
   ```

## Rollback

1. Pare e desative o serviço:

   ```bash
   sudo systemctl disable --now office-runner
   ```

2. Remova o trecho `nginx-office.conf` do site e recarregue o servidor web (`nginx -t` e `systemctl reload nginx`, ou o equivalente no OpenLiteSpeed).

3. Opcional: remover a unit e os arquivos instalados:

   ```bash
   sudo rm /etc/systemd/system/office-runner.service   # só se foi copiada para lá
   sudo systemctl daemon-reload
   sudo rm -rf /srv/office
   sudo userdel office
   sudo rm /etc/office-runner.env
   ```

   O `/srv/office/projects` contém os projetos dos agentes: confirme antes de apagar.

## Observações

- A unit fica em `deploy/office/office-runner.service`. Para ativá-la, copie para `/etc/systemd/system/`
  e rode `sudo systemctl daemon-reload` antes do `enable --now`.
- Se `node` não estiver em `/usr/bin/node`, ajuste `ExecStart` na unit (`which node`).
  O Node precisa ser 22.18 ou superior, pois executa `.ts` nativamente.
