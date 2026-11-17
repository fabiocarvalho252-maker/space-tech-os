// Personagem pixel de um agente: corpo, cabeça, crachá, balão de texto e ícone
// de estado. Desenhado com retângulos (sem assets). A aparência vem do nome,
// então cada agente tem sempre a mesma cor.

import * as Phaser from "phaser";
import type { EstadoAgente } from "../tipos.ts";

const PALETA = ["#a78bfa", "#8b5cf6", "#c4b5fd", "#e879f9", "#38bdf8", "#f0abfc", "#818cf8"];
const LARGURA_BALAO = 190;
const ESCALA_PIXEL = 3;
const PULO_CONCLUSAO_PX = 14;

export function corDoNome(nome: string): number {
  let hash = 0;
  for (const ch of nome) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hex = PALETA[hash % PALETA.length] ?? PALETA[0] ?? "#a78bfa";
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

function rotuloCurto(nome: string): string {
  return nome.length > 14 ? `${nome.slice(0, 13)}…` : nome;
}

const ICONE_POR_ESTADO: Partial<Record<EstadoAgente, { texto: string; cor: string }>> = {
  pensando: { texto: "…", cor: "#e4e4e7" },
  usando_ferramenta: { texto: "⚙", cor: "#38bdf8" },
  aguardando_aprovacao: { texto: "!", cor: "#facc15" },
  concluido: { texto: "✓", cor: "#4ade80" },
  erro: { texto: "✗", cor: "#f87171" },
};

export class AgentSprite {
  readonly contorno: Phaser.GameObjects.Container;
  private readonly corpo: Phaser.GameObjects.Rectangle;
  private readonly cabeca: Phaser.GameObjects.Rectangle;
  private readonly crachá: Phaser.GameObjects.Text;
  private readonly balao: Phaser.GameObjects.Container;
  private readonly balaoFundo: Phaser.GameObjects.Rectangle;
  private readonly balaoTexto: Phaser.GameObjects.Text;
  private readonly icone: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;
  private estadoAtual: EstadoAgente | null = null;

  constructor(
    private readonly cena: Phaser.Scene,
    nome: string,
  ) {
    const cor = corDoNome(nome);
    this.corpo = cena.add.rectangle(0, 8, 8 * ESCALA_PIXEL, 9 * ESCALA_PIXEL, cor);
    this.cabeca = cena.add.rectangle(0, -10, 6 * ESCALA_PIXEL, 6 * ESCALA_PIXEL, 0xfde68a);
    this.crachá = cena.add
      .text(0, -40, rotuloCurto(nome), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f4f4f5",
        backgroundColor: "#18181b",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);
    this.balaoFundo = cena.add
      .rectangle(0, 0, LARGURA_BALAO, 40, 0x1e1b4b, 0.95)
      .setStrokeStyle(1, 0x8b5cf6);
    this.balaoTexto = cena.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#ede9fe",
        wordWrap: { width: LARGURA_BALAO - 16 },
      })
      .setOrigin(0.5);
    this.balao = cena.add.container(0, -78, [this.balaoFundo, this.balaoTexto]).setVisible(false);
    this.icone = cena.add
      .text(18, -18, "", { fontFamily: "monospace", fontSize: "16px", color: "#ffffff" })
      .setOrigin(0.5);
    this.contorno = cena.add.container(0, 0, [
      this.corpo,
      this.cabeca,
      this.crachá,
      this.icone,
      this.balao,
    ]);
  }

  irPara(x: number, y: number, duracaoMs: number, aoChegar?: () => void): void {
    this.parar();
    this.tween = this.cena.tweens.add({
      targets: this.contorno,
      x,
      y,
      duration: duracaoMs,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.tween = null;
        aoChegar?.();
      },
    });
  }

  // Atualiza a aparência para o estado. Só troca o que mudou, para não
  // reiniciar animações a cada evento.
  aplicarEstado(estado: EstadoAgente, texto: string | null, ferramenta: string | null): void {
    const mudou = estado !== this.estadoAtual;
    this.estadoAtual = estado;

    const textoBalao = texto ?? (ferramenta ? `Usando: ${ferramenta}` : "");
    this.balaoTexto.setText(textoBalao);
    const alturaBalao = Math.max(36, this.balaoTexto.height + 16);
    this.balaoFundo.setSize(LARGURA_BALAO, alturaBalao);
    this.balao.setVisible(textoBalao.length > 0);
    this.balao.y = -40 - alturaBalao / 2 - 6;

    const icone = ICONE_POR_ESTADO[estado];
    this.icone.setText(icone?.texto ?? "").setColor(icone?.cor ?? "#ffffff");
    this.contorno.setAlpha(estado === "ocioso" ? 0.6 : 1);

    if (!mudou) return;
    this.animarPara(estado);
  }

  private animarPara(estado: EstadoAgente): void {
    this.pararAnimacaoDeEstado();
    if (estado === "trabalhando" || estado === "usando_ferramenta") {
      this.animacaoEstado = this.cena.tweens.add({
        targets: this.corpo,
        scaleY: 0.92,
        duration: 260,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else if (estado === "aguardando_aprovacao") {
      this.animacaoEstado = this.cena.tweens.add({
        targets: this.icone,
        alpha: 0.2,
        duration: 350,
        yoyo: true,
        repeat: -1,
      });
    } else if (estado === "concluido") {
      this.animacaoEstado = this.cena.tweens.add({
        targets: [this.corpo, this.cabeca],
        y: `-=${PULO_CONCLUSAO_PX}`,
        duration: 180,
        yoyo: true,
        repeat: 1,
        ease: "Quad.easeOut",
      });
    } else if (estado === "ocioso") {
      this.animacaoEstado = this.cena.tweens.add({
        targets: this.corpo,
        scaleY: 0.96,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private animacaoEstado: Phaser.Tweens.Tween | null = null;

  private pararAnimacaoDeEstado(): void {
    this.animacaoEstado?.stop();
    this.animacaoEstado = null;
    this.icone.setAlpha(1);
    this.corpo.setScale(1);
  }

  private parar(): void {
    this.tween?.stop();
    this.tween = null;
  }

  destruir(): void {
    this.parar();
    this.pararAnimacaoDeEstado();
    this.contorno.destroy(true);
  }
}
