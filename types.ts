
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

export interface GameState {
  score: number;
  timeLeft: number;
  isActive: boolean;
  currentWord?: string;
  definition?: string;
  options?: string[];
}

export type AppView = 'dashboard' | 'chat' | 'mindmap' | 'flashcards' | 'exam' | 'game';

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
}
