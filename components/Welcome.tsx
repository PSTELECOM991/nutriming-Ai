
import React from 'react';
import { Language, translations } from '../translations';

interface WelcomeProps {
  onEnter: () => void;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onEnter, lang, onLanguageChange }) => {
  const t = translations[lang];

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 z-[200] overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse delay-700" />
      
      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
        
        {/* LOGO SECTION */}
        <div className="relative group">
          <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full animate-pulse" />
          <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl relative border border-white/10">
            <svg className="w-12 h-12 md:w-16 md:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <div className="absolute -bottom-2 -right-2 bg-white text-blue-600 w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-lg transform rotate-12">
              PS
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">
            {t.welcomeTitle}
          </h1>
          <p className="text-slate-400 text-lg md:text-xl font-medium max-w-md mx-auto leading-relaxed">
            {t.welcomeSubtitle}
          </p>
        </div>

        {/* Language Selection on Welcome Screen */}
        <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl backdrop-blur-md border border-white/10">
          <button 
            onClick={() => onLanguageChange('en')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${lang === 'en' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            ENGLISH
          </button>
          <button 
            onClick={() => onLanguageChange('bn')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${lang === 'bn' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            বাংলা
          </button>
          <button 
            onClick={() => onLanguageChange('hi')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${lang === 'hi' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            हिन्दी
          </button>
        </div>

        <button 
          onClick={onEnter}
          className="group relative inline-flex items-center justify-center px-10 py-5 font-black text-white transition-all bg-blue-600 rounded-[20px] hover:bg-blue-700 active:scale-95 shadow-xl shadow-blue-500/25 overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-3 uppercase tracking-widest text-sm">
            {t.enterApp}
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5-5 5M6 7l5 5-5 5" />
            </svg>
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </button>

        <div className="pt-12 flex flex-col items-center gap-2">
           <div className="h-px w-12 bg-slate-800" />
           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em]">PS Telecom © 2025</p>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
