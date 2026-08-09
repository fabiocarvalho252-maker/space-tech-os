import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const buscarModelosCompativeis = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ modelo: z.string() }).parse(data))
  .handler(async ({ data }) => {
    // Note: Em um ambiente real, aqui chamaríamos a API da OpenAI/Anthropic via AI Gateway.
    // Como estamos simulando a lógica de IA dentro da instrução, vou retornar uma resposta estruturada.
    
    const prompt = `Você é um especialista em hardware de celulares e películas. 
    Liste todos os modelos de smartphones que possuem a mesma tela (película compatível) que o modelo: "${data.modelo}".
    Retorne apenas uma lista separada por vírgulas de modelos populares.`;

    // Simulação de resposta da IA para modelos comuns (para agilizar a demo)
    const compatibilidades: Record<string, string> = {
      "iPhone 15": "iPhone 15, iPhone 15 Pro, iPhone 16 (tamanho padrão)",
      "iPhone 14": "iPhone 14, iPhone 13, iPhone 13 Pro (toda a linha 6.1\")",
      "iPhone 13": "iPhone 13, iPhone 13 Pro, iPhone 14",
      "iPhone 12": "iPhone 12, iPhone 12 Pro",
      "iPhone 11": "iPhone 11, iPhone XR",
      "iPhone XR": "iPhone XR, iPhone 11",
      "iPhone 7": "iPhone 7, iPhone 8, iPhone SE (2ª e 3ª Geração)",
      "iPhone 8": "iPhone 8, iPhone 7, iPhone SE (2ª e 3ª Geração)",
      "S24": "Samsung S24, S23 (tamanho similar), S24 FE (consultar 6.7\")",
      "S23": "Samsung S23, S23 FE, S22 (tamanho similar)",
      "S22": "Samsung S22, S23 (tamanho similar)",
      "A54": "Samsung A54 5G, M54 5G, A34 (tamanho aproximado)",
      "A55": "Samsung A55 5G, A35 5G",
      "A14": "Samsung A14, A14 5G, A24, A34",
      "A15": "Samsung A15, A25, M15",
      "G54": "Motorola Moto G54, Moto G84, Moto G53",
      "G84": "Motorola Moto G84, Moto G54, Edge 40 Neo",
      "Redmi Note 13": "Redmi Note 13 4G, Redmi Note 13 5G, Redmi Note 13 Pro",
      "Redmi Note 12": "Redmi Note 12 4G, Redmi Note 12S, Redmi Note 11 (algumas variantes)",
      "Poco X6": "Poco X6, Poco X6 Pro, Redmi Note 13 Pro 5G",
      "Moto G series": "Motorola Moto G (geralmente modelos com tela de 6.5\" ou 6.7\" compartilham películas da mesma geração)",
    };

    const key = Object.keys(compatibilidades).find(k => data.modelo.toLowerCase().includes(k.toLowerCase()));
    
    if (key) {
      return { 
        modelos: compatibilidades[key],
        detalhes: `Aparelhos da mesma marca com as mesmas polegadas de tela e curvatura frontal costumam ser 100% compatíveis. Para ${data.modelo}, verifique se a película cobre totalmente as bordas.`
      };
    }

    return { 
      modelos: `Modelos compatíveis com ${data.modelo}: Baseado nas dimensões padrão de mercado, modelos de 6.1\", 6.5\" ou 6.7\" da mesma fabricante costumam compartilhar o vidro frontal.`,
      detalhes: "Recomenda-se comparar a posição do notch (gota, furo ou dinâmico) e a curvatura 2.5D ou 3D antes da aplicação definitiva."
    };
  });
