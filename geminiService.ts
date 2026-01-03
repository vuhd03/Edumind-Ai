
import { GoogleGenAI, Type } from "@google/genai";
import { MindMapNode, Flashcard, Question, FileData } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const getContents = (text: string, file?: FileData) => {
  const parts: any[] = [{ text: text || "Phân tích tài liệu này." }];
  if (file) {
    parts.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType
      }
    });
  }
  return { parts };
};

export const geminiService = {
  async summarizeToMindMap(content: string, file?: FileData): Promise<MindMapNode> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: getContents(`Tóm tắt nội dung sau thành một cấu trúc cây phân cấp (JSON). Nội dung văn bản: ${content}`, file),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            children: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  children: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } } }
                }
              }
            }
          },
          required: ["name"]
        }
      }
    });
    return JSON.parse(response.text || '{}');
  },

  async generateFlashcards(content: string, file?: FileData): Promise<Flashcard[]> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: getContents(`Tạo 5-10 thẻ nhớ (flashcards) từ nội dung sau. JSON format. Nội dung văn bản: ${content}`, file),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              front: { type: Type.STRING },
              back: { type: Type.STRING }
            },
            required: ["id", "front", "back"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  },

  async generateExam(content: string, file?: FileData): Promise<Question[]> {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: getContents(`Tạo một đề thi trắc nghiệm gồm 10 câu hỏi từ nội dung sau. JSON format. Nội dung văn bản: ${content}`, file),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.INTEGER, description: "Index of correct option (0-3)" },
              explanation: { type: Type.STRING }
            },
            required: ["id", "question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  }
};
