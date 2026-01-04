
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import mammoth from 'mammoth';
import { AppView, StudySession, MindMapNode, Flashcard, Question, FileData, GamePair, ChatMessage } from './types';
import { geminiService, encodeAudio, decodeAudio, decodeAudioData } from './geminiService';
import MindMap from './components/MindMap';
import Flashcards from './components/Flashcards';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('dashboard');
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [inputContent, setInputContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Voice Chat States
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Extractor States
  const [extractorContent, setExtractorContent] = useState('');
  const [extractorFile, setExtractorFile] = useState<FileData | null>(null);
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);
  const [extractorStep, setExtractorStep] = useState<'input' | 'results'>('input');

  // Common tool states
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [exam, setExam] = useState<Question[]>([]);
  const [examResults, setExamResults] = useState<{ [key: string]: number }>({});
  const [showExamResults, setShowExamResults] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'main' | 'extractor') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx');
    if (isDocx) {
      setIsLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        if (target === 'main') setInputContent(prev => prev + "\n" + result.value);
        else setExtractorContent(prev => prev + "\n" + result.value);
      } catch (err) { alert("Lỗi đọc file."); }
      finally { setIsLoading(false); }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const data = { data: base64, mimeType: file.type, name: file.name };
        if (target === 'main') setSelectedFile(data);
        else setExtractorFile(data);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartStudy = async () => {
    setIsLoading(true);
    try {
      const [mm, fc, ex] = await Promise.all([
        geminiService.summarizeToMindMap(inputContent, selectedFile || undefined),
        geminiService.generateFlashcards(inputContent, selectedFile || undefined),
        geminiService.extractMassiveExam(inputContent, selectedFile || undefined)
      ]);
      setMindMapData(mm);
      setFlashcards(fc);
      setExam(ex);
      const newSession = { id: Date.now().toString(), title: "Phiên học mới", content: inputContent, mindMapData: mm, flashcards: fc, exam: ex, date: new Date().toLocaleDateString() };
      setSessions([newSession, ...sessions]);
      setActiveSession(newSession);
      setView('mindmap');
    } catch (e) { alert("Lỗi phân tích."); }
    finally { setIsLoading(false); }
  };

  const handleRunExtractor = async () => {
    setIsLoading(true);
    try {
      const qs = await geminiService.extractMassiveExam(extractorContent, extractorFile || undefined);
      setExtractedQuestions(qs);
      setExtractorStep('results');
    } catch (e) { alert("Lỗi nạp đề."); }
    finally { setIsLoading(false); }
  };

  // LIVE VOICE CHAT LOGIC
  const startLiveVoice = async () => {
    try {
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      
      const analyser = inputCtx.createAnalyser();
      source.connect(analyser);
      
      const sessionPromise = geminiService.connectLiveVoice({
        onopen: () => setIsLiveActive(true),
        onmessage: async (msg: any) => {
          const audioBase64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioBase64) {
            const buffer = await decodeAudioData(decodeAudio(audioBase64), outputCtx, 24000, 1);
            const node = outputCtx.createBufferSource();
            node.buffer = buffer;
            node.connect(outputCtx.destination);
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
            node.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(node);
            node.onended = () => sourcesRef.current.delete(node);
          }
          if (msg.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }
        },
        onclose: () => setIsLiveActive(false),
        onerror: () => setIsLiveActive(false),
      }, `Bạn là gia sư AI thân thiện. Hãy vấn đáp kiến thức dựa trên nội dung: ${activeSession?.content || "Học tập chung"}`);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Visualizer simple logic
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        setVoiceVolume(Math.sqrt(sum / inputData.length));

        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
        sessionPromise.then(s => s.sendRealtimeInput({
          media: { data: encodeAudio(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
        }));
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);
      liveSessionRef.current = { inputCtx, processor, stream };
    } catch (e) { alert("Không thể truy cập Microphone."); }
  };

  const stopLiveVoice = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.stream.getTracks().forEach((t: any) => t.stop());
      liveSessionRef.current.inputCtx.close();
      liveSessionRef.current = null;
    }
    setIsLiveActive(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <aside className="w-64 bg-slate-900 text-white flex flex-col p-6">
        <h1 className="text-2xl font-black mb-10 tracking-tighter text-indigo-400">EDUMIND.AI</h1>
        <nav className="flex-1 space-y-2">
          <NavItem icon="🏠" label="Bảng điều khiển" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavItem icon="📑" label="Nạp Đề 200+ Câu" active={view === 'extractor'} onClick={() => setView('extractor')} />
          <NavItem icon="🎙️" label="Vấn đáp Voice" active={view === 'voice-chat'} onClick={() => setView('voice-chat')} />
          <div className="h-px bg-white/10 my-4"></div>
          <NavItem icon="🧠" label="Sơ đồ" active={view === 'mindmap'} onClick={() => setView('mindmap')} />
          <NavItem icon="🃏" label="Thẻ nhớ" active={view === 'flashcards'} onClick={() => setView('flashcards')} />
          <NavItem icon="📝" label="Luyện đề" active={view === 'exam'} onClick={() => setView('exam')} />
          <NavItem icon="💬" label="Chat AI" active={view === 'chat'} onClick={() => setView('chat')} />
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{view}</span>
          {isLoading && <div className="text-indigo-600 font-bold animate-pulse text-xs">GEMINI PRO ĐANG XỬ LÝ...</div>}
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-slate-50">
          {view === 'dashboard' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
                <h2 className="text-3xl font-black mb-4">Học tập thông minh</h2>
                <p className="text-slate-500 mb-8">Dán nội dung bài học hoặc tải file PDF/Word để bắt đầu lộ trình cá nhân hóa.</p>
                <textarea 
                  className="w-full h-40 p-6 bg-slate-50 border rounded-3xl mb-6 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nội dung bài học..."
                  value={inputContent}
                  onChange={e => setInputContent(e.target.value)}
                />
                <div className="flex gap-4">
                  <button onClick={() => document.getElementById('main-file')?.click()} className="flex-1 p-5 border-2 border-dashed rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-all">
                    {selectedFile ? selectedFile.name : "Tải tài liệu (.pdf, .docx)"}
                    <input id="main-file" type="file" className="hidden" onChange={e => handleFileUpload(e, 'main')} />
                  </button>
                  <button onClick={handleStartStudy} className="px-10 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all">BẮT ĐẦU</button>
                </div>
              </div>
            </div>
          )}

          {view === 'voice-chat' && (
            <div className="max-w-2xl mx-auto h-full flex flex-col items-center justify-center space-y-12">
              <div className="relative">
                <div className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300 ${isLiveActive ? 'bg-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.5)]' : 'bg-slate-200'}`}>
                  <span className="text-6xl">{isLiveActive ? '🎙️' : '💤'}</span>
                </div>
                {isLiveActive && (
                  <div className="absolute inset-0 -m-4 flex items-center justify-center">
                    <div className="w-full h-full rounded-full border-4 border-indigo-400 animate-ping opacity-20"></div>
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <h3 className="text-2xl font-black mb-2">{isLiveActive ? "AI ĐANG LẮNG NGHE..." : "VẤN ĐÁP BẰNG GIỌNG NÓI"}</h3>
                <p className="text-slate-400 text-sm">Hỏi AI về kiến thức trong tài liệu bạn vừa nạp bằng cách nói chuyện trực tiếp.</p>
              </div>

              {isLiveActive && (
                <div className="flex gap-1 h-12 items-center">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="w-1 bg-indigo-500 rounded-full transition-all duration-75" style={{ height: `${Math.max(10, voiceVolume * 300 * Math.random())}%` }}></div>
                  ))}
                </div>
              )}

              <button 
                onClick={isLiveActive ? stopLiveVoice : startLiveVoice}
                className={`px-12 py-5 rounded-2xl font-black text-xl shadow-2xl transition-all ${isLiveActive ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white hover:scale-105'}`}
              >
                {isLiveActive ? "DỪNG VẤN ĐÁP" : "BẮT ĐẦU NÓI CHUYỆN"}
              </button>
            </div>
          )}

          {view === 'extractor' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-10 duration-500">
              {extractorStep === 'input' ? (
                <div className="bg-slate-900 text-white p-12 rounded-[3rem] shadow-2xl">
                  <h2 className="text-3xl font-black mb-6 italic">NHẬP NGÂN HÀNG ĐỀ THI (200+)</h2>
                  <textarea 
                    className="w-full h-48 p-6 bg-white/5 border border-white/10 rounded-2xl mb-8 outline-none text-indigo-100"
                    placeholder="Dán toàn bộ 200 câu hỏi vào đây..."
                    value={extractorContent}
                    onChange={e => setExtractorContent(e.target.value)}
                  />
                  <div className="flex gap-4">
                    <button onClick={() => document.getElementById('ext-file')?.click()} className="flex-1 p-5 border-2 border-dashed border-white/20 rounded-2xl text-white/40 font-bold">
                      {extractorFile ? extractorFile.name : "Chọn file đề lớn"}
                      <input id="ext-file" type="file" className="hidden" onChange={e => handleFileUpload(e, 'extractor')} />
                    </button>
                    <button onClick={handleRunExtractor} className="px-10 bg-indigo-600 text-white rounded-2xl font-black">NẠP ĐỀ</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border">
                    <span className="font-black text-indigo-600">ĐÃ TÌM THẤY {extractedQuestions.length} CÂU HỎI</span>
                    <button onClick={() => { setExam(extractedQuestions); setView('exam'); }} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold">LUYỆN TẬP NGAY</button>
                  </div>
                  <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {extractedQuestions.map((q, i) => (
                      <div key={i} className="bg-white p-6 rounded-2xl border flex gap-4">
                        <span className="text-slate-300 font-black">{i+1}</span>
                        <p className="text-sm text-slate-600 truncate">{q.question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'mindmap' && (
            <div className="h-full animate-in zoom-in duration-500">
              {mindMapData ? <MindMap data={mindMapData} /> : <div className="text-center p-20 text-slate-400">Chưa có dữ liệu sơ đồ.</div>}
            </div>
          )}

          {view === 'flashcards' && (
            <div className="h-full animate-in slide-in-from-right-10 duration-500">
              {flashcards.length > 0 ? <Flashcards cards={flashcards} /> : <div className="text-center p-20 text-slate-400">Chưa có thẻ nhớ.</div>}
            </div>
          )}

          {view === 'exam' && (
            <div className="max-w-3xl mx-auto space-y-6 pb-20">
              <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-xl flex justify-between items-center sticky top-0 z-10">
                <div>
                  <h3 className="text-2xl font-black">LUYỆN TẬP ĐỀ THI</h3>
                  <p className="text-sm opacity-80">Tổng cộng {exam.length} câu hỏi</p>
                </div>
                <div className="text-2xl font-black">{Object.keys(examResults).length} / {exam.length}</div>
              </div>
              {exam.map((q, i) => (
                <div key={q.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                  <p className="font-bold text-lg mb-6">{i+1}. {q.question}</p>
                  <div className="grid gap-3">
                    {q.options.map((opt, idx) => (
                      <button 
                        key={idx}
                        onClick={() => !showExamResults && setExamResults({...examResults, [q.id]: idx})}
                        className={`p-4 text-left rounded-xl border-2 transition-all ${
                          examResults[q.id] === idx ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 border-transparent hover:border-indigo-100'
                        } ${showExamResults && q.correctAnswer === idx ? '!bg-emerald-500 !text-white' : ''}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!showExamResults && exam.length > 0 && <button onClick={() => setShowExamResults(true)} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-xl">NỘP BÀI</button>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{icon: string, label: string, active: boolean, onClick: () => void}> = ({icon, label, active, onClick}) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-5 py-3 rounded-2xl transition-all ${active ? 'bg-white text-indigo-950 font-black shadow-xl' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
  >
    <span className="text-xl">{icon}</span>
    <span className="text-xs uppercase font-bold tracking-widest">{label}</span>
  </button>
);

export default App;
