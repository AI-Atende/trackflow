import { GoogleGenAI } from "@google/genai";
import { AdCampaign } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing. AI features will be disabled.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeCampaignData = async (campaigns: any[]): Promise<string> => {
  const client = getClient();
  if (!client) return "API_KEY não configurada. Adicione sua chave para insights de IA.";

  const prompt = `
    Atue como um especialista sênior em Marketing Digital e Análise de Dados.
    Analise os seguintes dados de campanha de rastreamento (Funil de Vendas):
    
    Os estágios são:
    I: Impressões
    II: Cliques
    III: Leads
    IV: Checkout
    V: Compra (Quantidade ou Receita)

    Dados: ${JSON.stringify(campaigns)}

    1. Identifique qual anúncio tem a melhor performance global (conversão I -> V).
    2. Identifique onde está o maior gargalo (drop-off) geral.
    3. Dê 3 sugestões táticas curtas para melhorar os resultados.
    
    Mantenha a resposta concisa, direta e formatada em Markdown simples. Use um tom profissional e motivador.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Não foi possível gerar insights no momento.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Erro ao conectar com a inteligência artificial. Tente novamente mais tarde.";
  }
};
