
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MindMapNode, Flashcard, Question, FileData, GamePair } from "./types";

// Helper encoding/decoding for Live API
export const encodeAudio = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const decodeAudio = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

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
  // Trích xuất bộ đề lớn (200+ câu)
  async extractMassiveExam(content: string, file?: FileData): Promise<Question[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: getContents(`
        BẠN LÀ MÁY QUÉT DỮ LIỆU CÔNG SUẤT CAO.
        NHIỆM VỤ: Trích xuất TOÀN BỘ câu hỏi trắc nghiệm từ tài liệu. KHÔNG BỎ SÓT BẤT KỲ CÂU NÀO.
        Nếu tài liệu có 200 câu, trả về đủ 200 câu trong mảng JSON.
        Cấu trúc JSON: {id, question, options, correctAnswer, explanation}.
      `, file),
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["id", "question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  },

  async summarizeToMindMap(content: string, file?: FileData): Promise<MindMapNode> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: getContents(`Tạo sơ đồ tư duy (Mind Map) chi tiết dưới dạng JSON tree.`, file),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            children: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, children: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } } } } } }
          },
          required: ["name"]
        }
      }
    });
    return JSON.parse(response.text || '{"name": "Error"}');
  },

  async generateFlashcards(content: string, file?: FileData): Promise<Flashcard[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: getContents(`Trích xuất các khái niệm chính thành Flashcards (front/back).`, file),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { id: { type: Type.STRING }, front: { type: Type.STRING }, back: { type: Type.STRING } },
            required: ["id", "front", "back"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  },

  async generateImage(prompt: string, size: "1K" | "2K" | "4K" = "1K"): Promise<string | undefined> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1", imageSize: size } }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : undefined;
  },

  async generateSpeech(text: string): Promise<Uint8Array | undefined> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Đọc truyền cảm hứng: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
      },
    });
    const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64 ? decodeAudio(base64) : undefined;
  },

  async connectLiveVoice(callbacks: any, systemInstruction: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: systemInstruction,
      },
    });
  }
};
