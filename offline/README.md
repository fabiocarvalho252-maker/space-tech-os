SPACE TECH OS - PACOTE OFFLINE PARA WINDOWS
===========================================

Roda o sistema completo (app + Supabase + banco + arquivos) num Windows
sem internet, acessado pelos outros computadores da rede local.

GERAR O PACOTE (no servidor Linux, com internet)
  bash offline/gerar-pacote.sh /root/space-tech-os-offline
  - Para o Supabase por 1-2 minutos para copiar o banco com segurança.
  - Resultado: ~6-8 GB. Copie para um HD/pendrive em NTFS ou exFAT
    (FAT32 não aceita arquivos maiores que 4 GB).
  - Os dados são uma FOTO do momento em que o pacote foi gerado.

INSTALAR NO WINDOWS (10/11, 64 bits, 8 GB de RAM ou mais)
  1. Copie a pasta para um lugar fixo, ex.: C:\SpaceTech
  2. PRE-REQUISITOS.bat  (instala WSL e Docker Desktop) e REINICIE
  3. Abra o Docker Desktop, pule o login, espere "Engine running"
     (Settings > General: marque "Start Docker Desktop when you sign in")
  4. INSTALAR.bat  -> escolha o IP da rede -> aguarde
  5. Nos outros computadores: http://IP-DA-MAQUINA:8080

DEPOIS
  INICIAR.bat / PARAR.bat  - liga/desliga (nenhum dado é apagado)
  INSTALAR.bat de novo      - se o IP da máquina mudar
  Dica: fixe o IP da máquina no roteador para não precisar refazer.

NÃO FUNCIONA OFFLINE (o resto funciona normal)
  E-mail, IA SPACE TECH, WhatsApp e Mercado Pago - aparecem como
  "não configurado". A fonte do Google não carrega (usa a fonte do sistema).

NUNCA rode "docker compose down -v" nem apague volumes "supabase_*":
é onde ficam o banco e os arquivos.
