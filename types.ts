
export interface MindMapNode {
  name: string;
  children?: MindMapNode[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface GamePair {
  term: string;
  definition: string;
}

export type AppView = 'dashboard' | 'chat' | 'mindmap' | 'flashcards' | 'exam' | 'game' | 'tools' | 'video' | 'images' | 'extractor' | 'voice-chat';

export interface FileData {
  data: string; // base64
  mimeType: string;
  name: string;
}

export interface StudySession {
  id: string;
  title: string;
  content: string;
  file?: FileData;
  date: string;
  mindMapData?: MindMapNode;
  flashcards?: Flashcard[];
  exam?: Question[];
  extractedExam?: Question[];
}

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  isThinking?: boolean;
}
