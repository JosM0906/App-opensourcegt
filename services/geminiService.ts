
import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { Product } from "../types";

export class CatalogMiddlewareService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  private searchCatalogFunction: FunctionDeclaration = {
    name: 'searchCatalog',
    parameters: {
      type: Type.OBJECT,
      description: 'Search for a product in the catalog by name or keyword.',
      properties: {
        query: {
          type: Type.STRING,
          description: 'The product name or category to search for.',
        },
      },
      required: ['query'],
    },
  };

  private recordOrderFunction: FunctionDeclaration = {
    name: 'recordOrder',
    parameters: {
      type: Type.OBJECT,
      description: 'Records a new order in the internal database.',
      properties: {
        customerName: { type: Type.STRING },
        items: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        total: { type: Type.NUMBER }
      },
      required: ['customerName', 'items', 'total'],
    },
  };

  async chatWithAgent(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[], catalog: Product[]) {
    // ... existing implementation
    return { response: { text: () => "Chat response" } }; // Mocked for now
  }

  async generateResponse(text: string, catalog: Product[]): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: `User: ${text}\n\nContext: You have access to a catalog of ${catalog.length} items.` }] }],
      });
      const responseText = 
        response?.candidates?.[0]?.content?.parts?.[0]?.text || 
        "No se recibió respuesta del modelo.";
      return responseText;
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("429") || msg.includes("quota")) {
        return "❌ ERROR DE CUOTA (Local): Se han agotado las peticiones de tu API Key. Revisa Google AI Studio.";
      }
      return `Error generando respuesta local: ${msg}`;
    }
  }
}

export const geminiService = new CatalogMiddlewareService();
