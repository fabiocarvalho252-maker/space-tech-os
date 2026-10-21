// Preload mínimo. Com contextIsolation + sandbox, NADA do Node é exposto ao
// site remoto. Só publicamos uma pequena identificação de ambiente (somente
// leitura), útil para o site saber que está rodando dentro do app desktop —
// nenhuma API privilegiada é disponibilizada.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("spaceTechDesktop", {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || "1.0.0",
});
