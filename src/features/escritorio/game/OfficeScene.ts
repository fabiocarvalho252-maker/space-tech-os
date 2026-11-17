// Cena Phaser do escritório: desenha a planta e posiciona os personagens a
// partir do estado. Não guarda regra de negócio: recebe o estado pronto.

import * as Phaser from "phaser";
import type { EstadoMissao } from "../estado.ts";
import { AgentSprite } from "./AgentSprite.ts";
import {
  ALTURA,
  ESPERA,
  LARGURA,
  SETORES,
  mesaDoSetor,
  posicaoEspera,
  setorPorId,
} from "./layout.ts";
import { SETOR_GERAL } from "../setores.ts";

const DURACAO_ANDAR_MS = 700;
const DURACAO_LINHA_MS = 2500;
const COR_FUNDO = 0x09090b;
const COR_SETOR = 0x18181b;
const COR_BORDA = 0x3f3f46;
const COR_MESA = 0x3f3f46;
const COR_TELA = 0x8b5cf6;

export class OfficeScene extends Phaser.Scene {
  private sprites = new Map<string, AgentSprite>();
  private destinos = new Map<string, { x: number; y: number }>();
  private pendente: EstadoMissao | null = null;
  private pronta = false;
  private delegacoesDesenhadas = new Set<string>();
  private aoSelecionar: ((agenteId: string) => void) | null = null;

  constructor() {
    super({ key: "OfficeScene" });
  }

  // Registra quem recebe o clique num personagem. Passe null para remover.
  setOnSelecionar(fn: ((agenteId: string) => void) | null): void {
    this.aoSelecionar = fn;
  }

  create(): void {
    this.desenharPlanta();
    this.pronta = true;
    if (this.pendente) this.aplicar(this.pendente);
  }

  // Chamado pelo React a cada mudança de estado. Antes do create(), guarda.
  aplicar(estado: EstadoMissao): void {
    if (!this.pronta) {
      this.pendente = estado;
      return;
    }
    this.pendente = null;
    this.posicionarAgentes(estado);
  }

  private selecionar(agenteId: string): void {
    this.aoSelecionar?.(agenteId);
  }

  private desenharPlanta(): void {
    this.cameras.main.setBackgroundColor(COR_FUNDO);
    const grade = this.add.graphics().setAlpha(0.06);
    grade.lineStyle(1, 0xffffff, 1);
    for (let x = 0; x <= LARGURA; x += 48) grade.lineBetween(x, 0, x, ALTURA);
    for (let y = 0; y <= ALTURA; y += 48) grade.lineBetween(0, y, LARGURA, y);

    for (const setor of SETORES) {
      this.add
        .rectangle(setor.x, setor.y, setor.largura, setor.altura, COR_SETOR)
        .setOrigin(0)
        .setStrokeStyle(2, COR_BORDA);
      this.add.text(setor.x + 12, setor.y + 10, setor.nome.toUpperCase(), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#a1a1aa",
      });
      for (const mesa of setor.mesas) this.desenharMesa(mesa.x, mesa.y);
    }

    this.add
      .rectangle(ESPERA.x, ESPERA.y, ESPERA.largura, ESPERA.altura, 0x111118)
      .setOrigin(0)
      .setStrokeStyle(1, COR_BORDA);
    this.add.text(ESPERA.x + 12, ESPERA.y + 10, "SALA DE ESPERA", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#71717a",
    });
  }

  private desenharMesa(x: number, y: number): void {
    this.add.rectangle(x, y + 12, 70, 22, COR_MESA).setStrokeStyle(1, 0x52525b);
    this.add.rectangle(x, y - 6, 24, 16, COR_TELA).setAlpha(0.7);
  }

  private posicionarAgentes(estado: EstadoMissao): void {
    this.removerForasteiros(estado);
    const ocupacaoPorSetor = new Map<string, number>();
    estado.ordem.forEach((id, indiceGlobal) => {
      const agente = estado.agentes[id];
      if (!agente) return;

      const destino = this.destinoDe(agente.setor, agente.estado, indiceGlobal, ocupacaoPorSetor);
      let sprite = this.sprites.get(id);
      if (!sprite) {
        const espera = posicaoEspera(indiceGlobal);
        sprite = new AgentSprite(this, agente.nome);
        sprite.contorno.setPosition(espera.x, espera.y);
        sprite.aoClicar(() => this.selecionar(id));
        this.sprites.set(id, sprite);
        this.destinos.set(id, espera);
      }

      const anterior = this.destinos.get(id);
      if (!anterior || anterior.x !== destino.x || anterior.y !== destino.y) {
        this.destinos.set(id, destino);
        sprite.irPara(destino.x, destino.y, DURACAO_ANDAR_MS);
      }
      sprite.aplicarEstado(agente.estado, agente.texto, agente.ferramenta);
    });
    this.desenharDelegacoes(estado);
  }

  // Missão nova: quem não está mais no estado sai do escritório.
  private removerForasteiros(estado: EstadoMissao): void {
    for (const [id, sprite] of this.sprites) {
      if (estado.agentes[id]) continue;
      sprite.destruir();
      this.sprites.delete(id);
      this.destinos.delete(id);
    }
    if (estado.ordem.length === 0) this.delegacoesDesenhadas.clear();
  }

  // Ocupação conta só agentes ativos no setor, para dividir mesas corretamente.
  private destinoDe(
    setorId: string,
    estado: EstadoMissao["agentes"][string]["estado"],
    indiceGlobal: number,
    ocupacaoPorSetor: Map<string, number>,
  ): { x: number; y: number } {
    if (estado === "ocioso" || setorId === SETOR_GERAL || !setorPorId(setorId)) {
      return posicaoEspera(indiceGlobal);
    }
    const ocupados = ocupacaoPorSetor.get(setorId) ?? 0;
    ocupacaoPorSetor.set(setorId, ocupados + 1);
    return mesaDoSetor(setorId, ocupados) ?? posicaoEspera(indiceGlobal);
  }

  // Linha pontilhada do pai até o filho quando um agente é delegado.
  private desenharDelegacoes(estado: EstadoMissao): void {
    for (const id of estado.ordem) {
      const agente = estado.agentes[id];
      if (!agente?.paiId || this.delegacoesDesenhadas.has(id)) continue;
      this.delegacoesDesenhadas.add(id);
      const origem = this.destinos.get(agente.paiId);
      const destino = this.destinos.get(id);
      if (!origem || !destino) continue;
      const linha = this.add.graphics();
      linha.lineStyle(2, COR_TELA, 0.8);
      const passos = 12;
      for (let i = 0; i < passos; i += 2) {
        const t0 = i / passos;
        const t1 = (i + 1) / passos;
        linha.lineBetween(
          origem.x + (destino.x - origem.x) * t0,
          origem.y + (destino.y - origem.y) * t0,
          origem.x + (destino.x - origem.x) * t1,
          origem.y + (destino.y - origem.y) * t1,
        );
      }
      this.tweens.add({
        targets: linha,
        alpha: 0,
        delay: 400,
        duration: DURACAO_LINHA_MS,
        onComplete: () => linha.destroy(),
      });
    }
  }
}
