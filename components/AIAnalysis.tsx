
import React from 'react';
import { AIAnalysisResult } from '../services/geminiService.ts';
import { Language, translations } from '../translations.ts';

interface AIAnalysisProps {
  data: AIAnalysisResult | null;
  isLoading: boolean;
  onRefresh: () => void;
  isOnline: boolean;
  lang: Language;
}

const AIAnalysis: React.FC<AIAnalysisProps> = ({ data, isLoading, onRefresh, isOnline, lang }) => {
  const t = translations[lang];
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <p className="text-slate-500 font-medium animate-pulse text-center max-w-sm">
          {lang === 'en' ? 'Gemini is processing your data...' : lang === 'bn' ? 'জেমিনি আপনার তথ্য প্রসেস করছে...' : 'जेमिनी आपके डेटा को प्रोसेस कर रहा है...'}
        </p>
      </div>
    );
  }

  if (!data || data.insights.length === 0) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
        <div className="bg-slate-50 dark:bg-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">No Analysis Available</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-2 mb-6">
          {isOnline 
            ? "Connect to the Gemini API to get intelligent insights about your stock." 
            : "Connect to the internet to enable Gemini AI insights."}
        </p>
        <button 
          onClick={onRefresh} 
          disabled={!isOnline}
          className={`px-6 py-2 rounded-xl font-bold transition-all shadow-lg ${
            isOnline 
            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
          }`}
        >
          {isOnline ? t.reRunAnalysis : 'Internet Required'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold tracking-wider uppercase text-xs opacity-80">{t.aiSummary}</span>
          </div>
          <p className="text-xl md:text-2xl font-medium leading-relaxed">
            {data.summary}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {t.keyFindings}
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {data.insights.map((insight, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  insight.priority === 'high' ? 'bg-red-500' : 
                  insight.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                    insight.category === 'risk' ? 'bg-red-50 dark:bg-red-900/20 text-red-600' :
                    insight.category === 'opportunity' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  }`}>
                    {insight.category}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{insight.title}</h4>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 leading-relaxed">{insight.description}</p>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                  <div className="w-8 h-8 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{insight.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t.forecasting}
          </h3>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            {data.forecast?.map((f, idx) => (
              <div key={idx} className="p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-bold text-slate-800 dark:text-white text-sm">{f.productName}</p>
                  <span className={`text-[10px] font-bold uppercase ${
                    f.trend === 'increasing' ? 'text-emerald-600' :
                    f.trend === 'decreasing' ? 'text-red-600' : 'text-slate-500'
                  }`}>
                    {f.trend}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{f.reasoning}</p>
              </div>
            ))}
          </div>
          
          <button 
            onClick={onRefresh}
            disabled={!isOnline}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all border ${
              isOnline 
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700' 
              : 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-700 border-slate-100 dark:border-slate-800 cursor-not-allowed opacity-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t.reRunAnalysis}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysis;
