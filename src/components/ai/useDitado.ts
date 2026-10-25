// Ditado por voz para o chat da SPACE TECH IA, com o reconhecimento de fala
// do próprio navegador (Web Speech API): o áudio vira texto no aparelho do
// usuário / serviço do navegador, sem custo nem chave no nosso servidor.
// Chrome, Edge e Safari (inclusive no celular) suportam; Firefox não — aí
// `suportado` fica false e o botão de microfone não aparece.
import { useCallback, useEffect, useRef, useState } from "react";

type ResultadoFala = { isFinal: boolean; 0: { transcript: string } };
type EventoFala = { resultIndex: number; results: ArrayLike<ResultadoFala> };
type EventoErroFala = { error: string };
type Reconhecedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoFala) => void) | null;
  onerror: ((e: EventoErroFala) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type ConstrutorReconhecedor = new () => Reconhecedor;

function construtorReconhecedor(): ConstrutorReconhecedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecedor;
    webkitSpeechRecognition?: ConstrutorReconhecedor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MENSAGENS_ERRO: Record<string, string> = {
  "not-allowed": "Permita o uso do microfone no navegador para falar com a IA.",
  "service-not-allowed": "Permita o uso do microfone no navegador para falar com a IA.",
  "audio-capture": "Nenhum microfone encontrado neste aparelho.",
  network: "Sem conexão para reconhecer a fala. Tente de novo.",
};

/**
 * `iniciar` começa a ouvir; `parcial` traz o texto enquanto a pessoa fala.
 * Ao `parar` (ou quando o navegador encerra sozinho depois de um silêncio),
 * `aoConcluir` recebe o texto final.
 */
export function useDitado(opcoes: {
  aoConcluir: (texto: string) => void;
  aoErro: (mensagem: string) => void;
}) {
  const [suportado, setSuportado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState("");
  const reconhecedorRef = useRef<Reconhecedor | null>(null);
  const finalRef = useRef("");
  const opcoesRef = useRef(opcoes);
  opcoesRef.current = opcoes;

  // Só no cliente: no SSR não existe window e o botão não deve piscar.
  useEffect(() => setSuportado(construtorReconhecedor() !== null), []);

  useEffect(() => () => reconhecedorRef.current?.abort(), []);

  const iniciar = useCallback(() => {
    const Construtor = construtorReconhecedor();
    if (!Construtor || reconhecedorRef.current) return;
    const rec = new Construtor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = "";
    setParcial("");

    rec.onresult = (e) => {
      let provisorio = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalRef.current += `${r[0].transcript} `;
        else provisorio += r[0].transcript;
      }
      setParcial(`${finalRef.current}${provisorio}`.trim());
    };
    rec.onerror = (e) => {
      // "no-speech" e "aborted" não são erro para o usuário: só não falou.
      if (e.error === "no-speech" || e.error === "aborted") return;
      opcoesRef.current.aoErro(
        MENSAGENS_ERRO[e.error] ?? "Não consegui ouvir agora. Tente de novo.",
      );
    };
    rec.onend = () => {
      reconhecedorRef.current = null;
      setOuvindo(false);
      setParcial("");
      const texto = finalRef.current.trim();
      finalRef.current = "";
      if (texto) opcoesRef.current.aoConcluir(texto);
    };

    reconhecedorRef.current = rec;
    try {
      rec.start();
      setOuvindo(true);
    } catch {
      reconhecedorRef.current = null;
      opcoesRef.current.aoErro("Não consegui ligar o microfone. Tente de novo.");
    }
  }, []);

  const parar = useCallback(() => reconhecedorRef.current?.stop(), []);

  return { suportado, ouvindo, parcial, iniciar, parar };
}
