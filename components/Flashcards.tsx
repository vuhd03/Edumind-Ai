
import React, { useState, useEffect } from 'react';
import { Flashcard } from '../types';

interface FlashcardsProps {
  cards: Flashcard[];
}

const Flashcards: React.FC<FlashcardsProps> = ({ cards: originalCards }) => {
  const [cards, setCards] = useState<Flashcard[]>(originalCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev' | 'none'>('none');
  const [isAnimating, setIsAnimating] = useState(false);

  // Sync internal cards when prop changes
  useEffect(() => {
    setCards(originalCards);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [originalCards]);

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    triggerTransition(() => {
      setCards(shuffled);
      setCurrentIndex(0);
      setIsFlipped(false);
    }, 'next');
  };

  const handleReset = () => {
    triggerTransition(() => {
      setCards(originalCards);
      setCurrentIndex(0);
      setIsFlipped(false);
    }, 'prev');
  };

  const triggerTransition = (updateFn: () => void, dir: 'next' | 'prev') => {
    if (isAnimating) return;
    setIsAnimating(true);
    setDirection(dir);
    
    // Animation out
    setTimeout(() => {
      updateFn();
      setDirection('none');
      // Animation in
      setTimeout(() => {
        setIsAnimating(false);
      }, 50);
    }, 300);
  };

  const handleNext = () => {
    triggerTransition(() => {
      setIsFlipped(false);
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 'next');
  };

  const handlePrev = () => {
    triggerTransition(() => {
      setIsFlipped(false);
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 'prev');
  };

  if (!cards.length) return <div className="text-center py-10 text-slate-400 font-medium italic">Không có thẻ nào để hiển thị.</div>;

  const currentCard = cards[currentIndex];

  return (
    <div className="flex flex-col items-center justify-center p-4 space-y-10 max-w-2xl mx-auto">
      {/* Top Controls */}
      <div className="w-full flex justify-between items-center px-2">
        <div className="flex gap-2">
          <button 
            onClick={handleShuffle}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Xáo trộn
          </button>
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-all border border-slate-200"
          >
            Bắt đầu lại
          </button>
        </div>
        <div className="text-sm font-bold text-slate-400">
          Tiến độ: <span className="text-indigo-600">{currentIndex + 1}</span> / {cards.length}
        </div>
      </div>

      {/* Card Container */}
      <div className="w-full max-w-lg perspective-1000 relative">
        <div 
          className={`
            relative w-full aspect-[4/3] transition-all duration-300 ease-out
            ${direction === 'next' ? 'opacity-0 -translate-x-12' : ''}
            ${direction === 'prev' ? 'opacity-0 translate-x-12' : ''}
            ${direction === 'none' ? 'opacity-100 translate-x-0' : ''}
          `}
        >
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className={`
              relative w-full h-full transition-all duration-700 cursor-pointer select-none
              ${isFlipped ? '[transform:rotateY(180deg)]' : ''}
            `}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Front Side */}
            <div 
              className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-3xl shadow-2xl flex flex-col items-center justify-center p-10 text-center [backface-visibility:hidden]"
            >
              <div className="absolute top-6 left-6 text-indigo-200/50 font-bold tracking-tighter text-2xl">?</div>
              <h3 className="text-2xl md:text-3xl font-bold leading-tight drop-shadow-md">
                {currentCard.front}
              </h3>
              <div className="absolute bottom-6 text-xs uppercase tracking-[0.2em] font-medium text-indigo-300/60">
                Nhấn để xem đáp án
              </div>
            </div>
            
            {/* Back Side */}
            <div 
              className="absolute inset-0 bg-white text-slate-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-10 text-center border-4 border-indigo-50 [backface-visibility:hidden] [transform:rotateY(180deg)]"
            >
              <div className="absolute top-6 left-6 text-emerald-500/20 font-bold tracking-tighter text-2xl">!</div>
              <p className="text-xl md:text-2xl font-medium leading-relaxed text-slate-700">
                {currentCard.back}
              </p>
              <div className="absolute bottom-6 text-xs uppercase tracking-[0.2em] font-medium text-slate-400">
                Nhấn để quay lại câu hỏi
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background cards */}
        <div className="absolute -inset-2 bg-indigo-100 rounded-3xl -z-10 rotate-1 scale-95 opacity-50"></div>
        <div className="absolute -inset-4 bg-indigo-50 rounded-3xl -z-20 -rotate-2 scale-90 opacity-30"></div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center space-x-8">
        <button 
          onClick={handlePrev}
          className="group flex flex-col items-center gap-1"
        >
          <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-lg active:scale-95">
            <svg className="w-8 h-8 text-slate-600 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/>
            </svg>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trước</span>
        </button>

        <div className="flex flex-col items-center gap-2">
           <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden border border-white shadow-inner">
             <div 
               className="h-full bg-indigo-500 transition-all duration-500 ease-out"
               style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
             ></div>
           </div>
        </div>

        <button 
          onClick={handleNext}
          className="group flex flex-col items-center gap-1"
        >
          <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-lg active:scale-95">
            <svg className="w-8 h-8 text-slate-600 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiếp</span>
        </button>
      </div>
      
      {/* Keyboard hints */}
      <div className="text-slate-400 text-[10px] font-medium tracking-wide">
        MẸO: SỬ DỤNG PHÍM CÁCH ĐỂ LẬT THẺ • PHÍM MŨI TÊN ĐỂ CHUYỂN THẺ
      </div>
    </div>
  );
};

export default Flashcards;
