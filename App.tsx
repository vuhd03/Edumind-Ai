
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AppView, StudySession, MindMapNode, Flashcard, Question, FileData } from './types';
import { geminiService } from './geminiService';
import MindMap from './components/MindMap';
import Flashcards from './components/Flashcards';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('dashboard');
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [inputContent, setInputContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Study Data
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [exam, setExam] = useState<Question[]>([]);
  const [examResults, setExamResults] = useState<{ [key: string]: number }>({});
  const [showExamResults, setShowExamResults] = useState(false);

  // Chatbot state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      setSelectedFile({
        data: base64,
        mimeType: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const handleStartStudy = async () => {
    if (!inputContent.trim() && !selectedFile) return;
    
    setIsLoading(true);
    try {
      const sessionTitle = selectedFile ? `Tài liệu: ${selectedFile.name}` : (inputContent.slice(0, 30) + '...');
      const newSession: StudySession = {
        id: Date.now().toString(),
        title: sessionTitle,
        content: inputContent,
        file: selectedFile || undefined,
        date: new Date().toLocaleDateString()
      };
      
      const mm = await geminiService.summarizeToMindMap(inputContent, selectedFile || undefined);
      const fc = await geminiService.generateFlashcards(inputContent, selectedFile || undefined);
      const ex = await geminiService.generateExam(inputContent, selectedFile || undefined);

      setMindMapData(mm);
      setFlashcards(fc);
      setExam(ex);
      setSessions([newSession, ...sessions]);
      setActiveSession(newSession);
      setView('mindmap');
    } catch (error) {
      console.error(error);
      alert("Đã xảy ra lỗi khi phân tích nội dung.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const parts: any[] = [
      { text: `Sử dụng nội dung bài học này: "${activeSession?.content || inputContent}". Trả lời câu hỏi của người dùng: ${userMsg}` }
    ];
    
    if (activeSession?.file) {
      parts.push({
        inlineData: {
          data: activeSession.file.data,
          mimeType: activeSession.file.mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
    });
    
    setChatMessages(prev => [...prev, { role: 'bot', text: response.text || "Xin lỗi, tôi không thể trả lời lúc này." }]);
  };

  const calculateScore = () => {
    let score = 0;
    exam.forEach((q) => {
      if (examResults[q.id] === q.correctAnswer) score++;
    });
    return score;
  };

  return (
    <div className="flex h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col shadow-2xl z-20">
        <div className="p-8">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="bg-white text-indigo-900 rounded-xl w-10 h-10 flex items-center justify-center shadow-lg transform -rotate-3">E</span>
            EduMind AI
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 py-4">
          <NavItem icon="🏠" label="Bảng điều khiển" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavItem icon="🧠" label="Sơ đồ tư duy" active={view === 'mindmap'} onClick={() => setView('mindmap')} />
          <NavItem icon="🃏" label="Thẻ nhớ" active={view === 'flashcards'} onClick={() => setView('flashcards')} />
          <NavItem icon="📝" label="Luyện đề" active={view === 'exam'} onClick={() => setView('exam')} />
          <NavItem icon="💬" label="Hỏi đáp AI" active={view === 'chat'} onClick={() => setView('chat')} />
          <NavItem icon="🎮" label="Trò chơi" active={view === 'game'} onClick={() => setView('game')} />
        </nav>

        <div className="p-6 bg-indigo-950/50 mt-auto border-t border-indigo-800">
          <div className="text-[10px] uppercase text-indigo-400 font-bold mb-4 tracking-[0.2em]">Phiên học gần đây</div>
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {sessions.map(s => (
              <button 
                key={s.id} 
                onClick={() => {
                  setActiveSession(s);
                  setInputContent(s.content);
                  setSelectedFile(s.file || null);
                  setIsLoading(true);
                  Promise.all([
                    geminiService.summarizeToMindMap(s.content, s.file),
                    geminiService.generateFlashcards(s.content, s.file),
                    geminiService.generateExam(s.content, s.file)
                  ]).then(([mm, fc, ex]) => {
                    setMindMapData(mm);
                    setFlashcards(fc);
                    setExam(ex);
                    setView('mindmap');
                    setIsLoading(false);
                  });
                }}
                className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-indigo-800 transition-all truncate border border-transparent hover:border-indigo-700 group"
              >
                <span className="text-indigo-400 mr-2">#</span>
                <span className="group-hover:text-white transition-colors">{s.title}</span>
              </button>
            ))}
            {sessions.length === 0 && <div className="text-[10px] text-indigo-500 italic">Chưa có phiên học nào</div>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-10 flex items-center justify-between shadow-sm z-10">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {view === 'dashboard' ? 'Trung tâm học tập' : activeSession?.title || 'Đang chuẩn bị...'}
            </h2>
            {activeSession && <span className="text-xs font-medium text-slate-400">{activeSession.date}</span>}
          </div>
          <div className="flex items-center gap-6">
            <button className="text-sm font-semibold text-slate-400 hover:text-indigo-600 transition-colors">Trợ giúp</button>
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
               <div className="text-right hidden sm:block">
                 <div className="text-xs font-bold text-slate-900">Người học</div>
                 <div className="text-[10px] text-emerald-500 font-bold uppercase">Pro Plan</div>
               </div>
               <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-200 transform rotate-3">U</div>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-10 bg-[#fbfcfe]">
          {view === 'dashboard' && (
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-20 -mt-20 blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                
                <h3 className="text-3xl font-black mb-6 text-slate-800">Tải lên tài liệu của bạn</h3>
                <p className="text-slate-500 mb-8 text-lg leading-relaxed">Dán văn bản hoặc tải lên tệp (PDF, Hình ảnh, Văn bản) để EduMind AI bắt đầu xây dựng nội dung ôn luyện.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="relative">
                    <textarea 
                      className="w-full h-56 p-6 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-indigo-100 focus:bg-white focus:border-indigo-400 outline-none transition-all text-slate-700 text-lg leading-relaxed shadow-inner"
                      placeholder="Dán nội dung văn bản tại đây..."
                      value={inputContent}
                      onChange={(e) => setInputContent(e.target.value)}
                    />
                  </div>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="h-56 border-4 border-dashed border-indigo-100 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all group/upload"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileUpload}
                      accept="image/*,application/pdf,text/*"
                    />
                    <div className="text-6xl mb-4 group-hover/upload:scale-110 transition-transform">📁</div>
                    {selectedFile ? (
                      <div className="text-center px-4">
                        <div className="font-bold text-indigo-600 truncate max-w-xs">{selectedFile.name}</div>
                        <div className="text-xs text-slate-400 mt-1 uppercase">Đã chọn tệp</div>
                      </div>
                    ) : (
                      <>
                        <div className="font-bold text-slate-700">Tải lên tệp tài liệu</div>
                        <div className="text-xs text-slate-400 mt-1 uppercase">PDF, JPG, PNG, TXT</div>
                      </>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={handleStartStudy}
                  disabled={isLoading || (!inputContent.trim() && !selectedFile)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 text-xl active:scale-[0.98]"
                >
                  {isLoading ? (
                    <><span className="animate-spin inline-block">⏳</span> Đang xử lý đa phương thức...</>
                  ) : (
                    <>🔥 BẮT ĐẦU ÔN LUYỆN</>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <StatCard title="Bài học đã xong" value="12" icon="🎯" color="bg-emerald-50 text-emerald-600 border-emerald-100" />
                <StatCard title="Thời gian tập trung" value="5.2h" icon="⚡" color="bg-orange-50 text-orange-600 border-orange-100" />
                <StatCard title="Thẻ nhớ đã thuộc" value="45" icon="💎" color="bg-indigo-50 text-indigo-600 border-indigo-100" />
              </div>
            </div>
          )}

          {view === 'mindmap' && (
            <div className="h-full flex flex-col max-w-5xl mx-auto animate-in zoom-in-95 duration-500">
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h3 className="text-2xl font-black text-slate-800">Cấu trúc kiến thức</h3>
                  <p className="text-slate-400 text-sm font-medium">Cái nhìn tổng quan về toàn bộ bài học của bạn</p>
                </div>
                <button className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Xuất sơ đồ (PDF)</button>
              </div>
              <div className="flex-1 min-h-[550px]">
                {mindMapData ? <MindMap data={mindMapData} /> : <div className="flex items-center justify-center h-full text-slate-400">Chưa có dữ liệu sơ đồ.</div>}
              </div>
            </div>
          )}

          {view === 'flashcards' && (
            <div className="h-full animate-in slide-in-from-bottom-8 duration-500">
              <div className="text-center mb-10">
                <h3 className="text-3xl font-black text-slate-800 mb-2">Thẻ nhớ thông minh</h3>
                <p className="text-slate-500 font-medium">Luyện tập lặp lại ngắt quãng để ghi nhớ lâu hơn</p>
              </div>
              {flashcards.length > 0 ? <Flashcards cards={flashcards} /> : <div className="text-center p-20 text-slate-400 font-bold italic">Hãy nhập bài học ở Bảng điều khiển để tạo thẻ nhớ.</div>}
            </div>
          )}

          {view === 'exam' && (
            <div className="max-w-3xl mx-auto animate-in slide-in-from-right-8 duration-500 pb-20">
              <div className="mb-10 text-center">
                <h3 className="text-3xl font-black text-slate-800 mb-2">Đề thi mô phỏng</h3>
                <p className="text-slate-500 font-medium italic">Các câu hỏi được thiết kế dựa trên nội dung tài liệu của bạn</p>
              </div>
              
              {exam.length > 0 ? (
                <div className="space-y-8">
                  {exam.map((q, idx) => (
                    <div key={q.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative group overflow-hidden">
                      <div className="absolute top-0 left-0 w-2 h-full bg-indigo-100 group-hover:bg-indigo-500 transition-colors"></div>
                      <div className="flex items-start gap-4">
                        <span className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-black flex-shrink-0">{idx + 1}</span>
                        <div className="flex-1">
                          <p className="font-bold text-xl mb-6 text-slate-800 leading-snug">{q.question}</p>
                          <div className="grid grid-cols-1 gap-4">
                            {q.options.map((opt, oIdx) => (
                              <button 
                                key={oIdx}
                                onClick={() => !showExamResults && setExamResults({ ...examResults, [q.id]: oIdx })}
                                className={`p-5 text-left rounded-2xl border-2 transition-all flex justify-between items-center group/btn ${
                                  examResults[q.id] === oIdx 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' 
                                    : 'border-slate-50 bg-slate-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-md'
                                } ${showExamResults && q.correctAnswer === oIdx ? '!bg-emerald-500 !border-emerald-500 !text-white' : ''} ${showExamResults && examResults[q.id] === oIdx && q.correctAnswer !== oIdx ? '!bg-red-500 !border-red-500 !text-white' : ''}`}
                              >
                                <span className="font-semibold">{opt}</span>
                              </button>
                            ))}
                          </div>
                          {showExamResults && (
                            <div className="mt-8 p-6 bg-indigo-50/50 rounded-2xl text-slate-700 border-l-4 border-indigo-500 relative overflow-hidden">
                              <span className="font-black text-indigo-600 uppercase text-xs tracking-widest block mb-2">Giải thích:</span>
                              <p className="text-lg leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {!showExamResults ? (
                    <button 
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setShowExamResults(true);
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-6 rounded-3xl font-black shadow-2xl transition-all transform hover:-translate-y-1 active:scale-95 text-xl mt-12"
                    >
                      Nộp bài & Chấm điểm
                    </button>
                  ) : (
                    <div className="bg-white p-12 rounded-[3rem] border-4 border-indigo-500 text-center shadow-2xl shadow-indigo-200 animate-in zoom-in duration-500">
                      <div className="text-8xl font-black text-slate-900 mb-4">{calculateScore()} <span className="text-indigo-300 text-4xl">/ {exam.length}</span></div>
                      <button 
                        onClick={() => { setShowExamResults(false); setExamResults({}); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                      >
                        Luyện tập lại ngay
                      </button>
                    </div>
                  )}
                </div>
              ) : <div className="text-center p-20 text-slate-400 font-bold italic">Chưa có đề thi. Hãy nhập nội dung bài học trước!</div>}
            </div>
          )}

          {view === 'chat' && (
            <div className="h-full flex flex-col max-w-4xl mx-auto border border-slate-200 rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white font-black flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">🤖</div>
                  <div>
                    <div className="text-lg leading-none">Gia sư ảo EduMind</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="text-[10px] uppercase font-bold text-indigo-200">Đang trực tuyến</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] custom-scrollbar">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[85%] p-5 rounded-3xl shadow-sm text-lg leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex gap-4">
                <input 
                  type="text" 
                  className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:bg-white focus:border-indigo-400 outline-none transition-all text-lg shadow-inner"
                  placeholder="Bạn chưa hiểu phần nào của bài học?"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button 
                  onClick={handleSendMessage}
                  className="bg-indigo-600 text-white w-16 h-16 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center active:scale-90"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7-7 7M5 12h16"/></svg>
                </button>
              </div>
            </div>
          )}

          {view === 'game' && (
            <div className="max-w-4xl mx-auto h-full flex flex-col items-center justify-center space-y-12 animate-in zoom-in-95 duration-700">
              <div className="text-center">
                <h3 className="text-5xl font-black text-slate-900 mb-4">Khu vực Mini Game</h3>
                <p className="text-slate-500 text-xl font-medium">Sử dụng chính tài liệu bạn đã tải lên để tạo thử thách!</p>
              </div>
              
              <div className="bg-white p-16 rounded-[4rem] shadow-2xl shadow-indigo-100/50 border border-slate-100 w-full text-center relative overflow-hidden group">
                <div className="text-8xl mb-10 transform group-hover:scale-110 transition-transform duration-500">🎮</div>
                <h4 className="text-3xl font-black mb-6 text-slate-800 tracking-tight">Thử thách Truy tìm khái niệm</h4>
                <button 
                   onClick={() => alert("Tính năng Mini Game đang phân tích tài liệu của bạn...")}
                   className="px-16 py-6 bg-slate-900 text-white rounded-3xl font-black text-2xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 active:scale-95"
                >
                  SẴN SÀNG CHƠI
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

interface NavItemProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group ${
      active 
        ? 'bg-white text-indigo-900 shadow-xl shadow-indigo-950/20 transform -translate-y-0.5' 
        : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
    }`}
  >
    <span className={`text-2xl transition-transform ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
    <span className="font-bold tracking-tight">{label}</span>
    {active && <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400"></span>}
  </button>
);

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <div className={`bg-white p-8 rounded-[2rem] border-2 shadow-sm flex items-center gap-6 transition-all hover:shadow-lg hover:-translate-y-1 ${color}`}>
    <div className="text-4xl">
      {icon}
    </div>
    <div>
      <div className="opacity-70 text-xs font-black uppercase tracking-widest mb-1">{title}</div>
      <div className="text-3xl font-black tracking-tighter">{value}</div>
    </div>
  </div>
);

export default App;
