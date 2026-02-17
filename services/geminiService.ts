import { GoogleGenAI, Type } from "@google/genai";
import { Product, Transaction } from "../types";
import { Language } from "../translations";

// Fix: Strictly follow @google/genai guidelines for client initialization using process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AIAnalysisResult {
  summary: string;
  insights: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: 'risk' | 'opportunity' | 'efficiency';
    action: string;
  }[];
  forecast?: {
    productName: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    reasoning: string;
  }[];
}

export const getInventoryInsights = async (products: Product[], transactions: Transaction[], lang: Language): Promise<AIAnalysisResult> => {
  const languageName = lang === 'bn' ? 'Bengali' : lang === 'hi' ? 'Hindi' : 'English';
  
  const context = `
    Current Inventory Data: ${JSON.stringify(products.map(p => ({ 
      name: p.name, 
      box: p.boxNumber,
      qty: p.quantity, 
      min: p.minThreshold,
      cost: p.purchasePrice,
      msrp: p.sellingPrice,
      margin: p.sellingPrice - p.purchasePrice,
      cat: p.category
    })))}
    Recent Transactions (last 20): ${JSON.stringify(transactions.slice(-20).map(t => ({
      name: t.productName,
      type: t.type,
      qty: t.quantity,
      date: new Date(t.timestamp).toISOString()
    })))}
  `;

  try {
    // Fix: Use ai.models.generateContent with both model name and prompt as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert supply chain and financial analyst. Analyze the following inventory and transaction data. 
      Identify critical stock risks, sales trends, and profit efficiency opportunities based on margins.
      
      IMPORTANT: You MUST provide all text descriptions, titles, and summaries in ${languageName}.
      
      Context: ${context}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: `A high-level summary of the current stock and financial health in ${languageName}.` },
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: `In ${languageName}.` },
                  description: { type: Type.STRING, description: `In ${languageName}.` },
                  priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                  category: { type: Type.STRING, enum: ['risk', 'opportunity', 'efficiency'] },
                  action: { type: Type.STRING, description: `Specific recommended action in ${languageName}.` }
                },
                required: ['title', 'description', 'priority', 'category', 'action']
              }
            },
            forecast: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  trend: { type: Type.STRING, enum: ['increasing', 'decreasing', 'stable'] },
                  reasoning: { type: Type.STRING, description: `In ${languageName}.` }
                },
                required: ['productName', 'trend', 'reasoning']
              }
            }
          },
          required: ['summary', 'insights']
        }
      }
    });

    // Fix: Access response.text as a property (not a method) as per @google/genai guidelines
    const result = JSON.parse(response.text || '{}');
    return {
      summary: result.summary || "Analysis complete.",
      insights: result.insights || [],
      forecast: result.forecast || []
    };
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return {
      summary: lang === 'en' ? "Could not generate analysis." : lang === 'bn' ? "বিশ্লেষণ তৈরি করা যায়নি।" : "विश्लेषण उत्पन्न नहीं किया जा सका।",
      insights: []
    };
  }
};