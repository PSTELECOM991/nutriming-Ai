
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Transaction, TransactionType, InventoryStats } from './types.ts';
import Dashboard from './components/Dashboard.tsx';
import InventoryTable from './components/InventoryTable.tsx';
import HistoryLog from './components/HistoryLog.tsx';
import AIAnalysis from './components/AIAnalysis.tsx';
import Welcome from './components/Welcome.tsx';
import { getInventoryInsights, AIAnalysisResult } from './services/geminiService.ts';
import { supabase, fetchProducts, fetchTransactions, upsertProduct, upsertProducts, logTransaction } from './services/supabaseService.ts';
import { translations, Language } from './translations.ts';
import { exportToCSV, parseCSV } from './services/csvService.ts';
import { initDriveClient, authenticateDrive, uploadToDrive, downloadFromDrive, getUserInfo, logoutDrive, isDriveConfigured } from './services/driveService.ts';

type Theme = 'light' | 'dark' | 'system';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved as Language) || 'en';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('app_theme') as Theme) || 'system';
  });

  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    const sessionSeen = sessionStorage.getItem('ps_telecom_welcome_seen');
    return sessionSeen !== 'true';
  });

  const t = translations[lang];

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'history' | 'analysis' | 'settings'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [modalType, setModalType] = useState<'STOCK_ACTION' | 'PRODUCT_FORM' | 'FIND_PRODUCT'>('STOCK_ACTION');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockActionType, setStockActionType] = useState<TransactionType>(TransactionType.IN);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [finderQuery, setFinderQuery] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  
  const [globalShowCost, setGlobalShowCost] = useState(() => {
    return localStorage.getItem('global_show_cost') === 'true';
  });
  const [formShowCost, setFormShowCost] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (t: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(t);
      
      // Update body colors without wiping out other classes
      if (t === 'dark') {
        document.body.classList.add('bg-slate-950', 'text-slate-100');
        document.body.classList.remove('bg-slate-50', 'text-slate-900');
      } else {
        document.body.classList.add('bg-slate-50', 'text-slate-900');
        document.body.classList.remove('bg-slate-950', 'text-slate-100');
      }
    };
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyTheme(systemTheme);
    } else {
      applyTheme(theme);
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  // Click outside profile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('global_show_cost', String(globalShowCost));
  }, [globalShowCost]);

  // Initial Data Load
  useEffect(() => {
    const initData = async () => {
      setIsLoadingDB(true);
      try {
        const [p, tx] = await Promise.all([fetchProducts(), fetchTransactions()]);
        setProducts(p);
        setTransactions(tx);
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsLoadingDB(false);
      }
    };
    initData();

    const productSub = supabase
      .channel('db-changes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'products' }, async () => {
        setProducts(await fetchProducts());
      })
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'transactions' }, async () => {
        setTransactions(await fetchTransactions());
      })
      .subscribe();

    return () => { supabase.removeChannel(productSub); };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const initDrive = async () => {
      try {
        await initDriveClient();
      } catch (e) {
        console.warn("Drive client init failed (likely missing CLIENT_ID):", e);
      }
    };
    initDrive();
  }, []);

  const handleDriveConnect = async () => {
    if (!isDriveConfigured()) {
      alert("Google Client ID is missing. Please set the VITE_GOOGLE_CLIENT_ID environment variable in AI Studio settings.");
      return;
    }
    try {
      setIsDriveLoading(true);
      await authenticateDrive();
      const user = await getUserInfo();
      setGoogleUser(user);
      setIsDriveConnected(true);
    } catch (e: any) {
      console.error("Drive auth failed:", e);
      if (e?.error === 'invalid_client') {
        alert("Invalid Google Client ID. Please check your VITE_GOOGLE_CLIENT_ID environment variable.");
      } else {
        alert("Failed to connect to Google Drive. Please ensure you have set up the Google Cloud Console correctly.");
      }
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleDriveLogout = () => {
    logoutDrive();
    setGoogleUser(null);
    setIsDriveConnected(false);
  };

  const handleDriveBackup = async () => {
    if (!isDriveConnected) return;
    try {
      setIsBackingUp(true);
      const backupData = {
        products,
        transactions,
        timestamp: Date.now(),
        version: '1.0'
      };
      await uploadToDrive(backupData);
      alert("Backup successful!");
    } catch (e) {
      console.error("Backup failed:", e);
      alert("Backup failed.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDriveRestore = async () => {
    if (!isDriveConnected) return;
    if (!confirm("This will overwrite your current inventory. Continue?")) return;
    try {
      setIsRestoring(true);
      const data = await downloadFromDrive();
      if (data && data.products) {
        await handleBulkImport(data.products);
        alert("Restore successful!");
      }
    } catch (e) {
      console.error("Restore failed:", e);
      alert("Restore failed.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleLocalRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const importedProducts = parseCSV(text, products);
        if (importedProducts.length > 0) {
          await handleBulkImport(importedProducts);
          alert(`Successfully imported ${importedProducts.length} products.`);
        }
      } catch (err) {
        console.error("Import error:", err);
        alert("Failed to import CSV.");
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleWelcomeFinish = () => {
    sessionStorage.setItem('ps_telecom_welcome_seen', 'true');
    setShowWelcome(false);
  };

  const playChaChing = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current!;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);
    } catch (e) { console.warn("Audio feedback failed:", e); }
  };

  const stats: InventoryStats = useMemo(() => {
    return {
      totalItems: products.reduce((acc, p) => acc + p.quantity, 0),
      lowStockItems: products.filter(p => p.quantity > 0 && p.quantity <= p.minThreshold).length,
      totalValue: products.reduce((acc, p) => acc + (p.quantity * p.sellingPrice), 0),
      outOfStock: products.filter(p => p.quantity <= 0).length,
    };
  }, [products]);

  const openStockAction = (type: TransactionType, product: Product | null = null) => {
    setStockActionType(type);
    setSelectedProduct(product);
    setModalType('STOCK_ACTION');
    setIsModalOpen(true);
  };

  const openProductForm = (product: Product | null = null) => {
    setSelectedProduct(product);
    setFormShowCost(globalShowCost);
    setModalType('PRODUCT_FORM');
    setIsModalOpen(true);
  };

  const openFinder = () => {
    setFinderQuery('');
    setModalType('FIND_PRODUCT');
    setIsModalOpen(true);
  };

  const processStockTransaction = async (
    productId: string, 
    amount: number, 
    reason: string, 
    newBoxNumber?: string
  ) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const newQty = stockActionType === TransactionType.IN 
      ? product.quantity + amount 
      : Math.max(0, product.quantity - amount);

    if (stockActionType === TransactionType.OUT && amount > 0) playChaChing();
    
    const updatedProduct = { 
      ...product, 
      quantity: newQty, 
      boxNumber: newBoxNumber || product.boxNumber,
      lastUpdated: Date.now() 
    };

    const newTx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      productId, 
      productName: product.name, 
      type: stockActionType, 
      quantity: amount, 
      reason: newBoxNumber && newBoxNumber !== product.boxNumber ? `${reason} (Box: ${newBoxNumber})` : reason,
      timestamp: Date.now(), 
      userId: 'Admin'
    };

    try {
      await upsertProduct(updatedProduct);
      await logTransaction(newTx);
      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
      setTransactions(prev => [newTx, ...prev]);
    } catch (e) {
      console.error("Transaction processing error:", e);
      alert("Cloud Sync Error. Please check connection.");
    }

    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleBulkImport = async (importedProducts: Product[]) => {
    try {
      await upsertProducts(importedProducts);
      // State will be updated by Supabase subscription
    } catch (e) {
      console.error("Bulk import error:", e);
      alert("Failed to import products to cloud.");
    }
  };

  const saveProduct = async (data: Partial<Product>) => {
    let finalProduct: Product;
    if (selectedProduct) {
      finalProduct = { ...selectedProduct, ...data, lastUpdated: Date.now() } as Product;
    } else {
      finalProduct = {
        id: Math.random().toString(36).substr(2, 9),
        sku: data.sku || `SKU-${Math.floor(Math.random() * 1000)}`,
        name: data.name || 'New Product',
        category: data.category || 'Uncategorized',
        quantity: data.quantity || 0,
        minThreshold: data.minThreshold || 5,
        purchasePrice: data.purchasePrice || 0,
        sellingPrice: data.sellingPrice || 0,
        boxNumber: data.boxNumber || 'N/A',
        description: data.description || '',
        lastUpdated: Date.now(),
      };
    }
    try {
      await upsertProduct(finalProduct);
      setProducts(prev => selectedProduct ? prev.map(p => p.id === selectedProduct.id ? finalProduct : p) : [...prev, finalProduct]);
    } catch (e) { 
      console.error("Save error:", e);
      alert("Failed to save to cloud."); 
    }
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const runAnalysis = async () => {
    if (!isOnline) return;
    setIsGeneratingInsights(true);
    try {
      const result = await getInventoryInsights(products, transactions, lang);
      setAiAnalysis(result);
    } finally { setIsGeneratingInsights(false); }
  };

  useEffect(() => { if (isOnline && !showWelcome && products.length > 0) runAnalysis(); }, [products.length, isOnline, lang, showWelcome]);

  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'inventory', label: t.inventory, icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { id: 'history', label: t.history, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'analysis', label: t.analysis, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  ];

  if (showWelcome) return <Welcome lang={lang} onEnter={handleWelcomeFinish} onLanguageChange={setLang} />;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 md:flex-row font-sans overflow-hidden transition-colors duration-300">
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col p-4 shrink-0 shadow-xl">
        <div className="flex items-center gap-3 px-2 mb-10 mt-2">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <span className="text-white font-black text-xl tracking-tight">PS Telecom</span>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} /></svg>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <header className="h-20 md:h-24 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-10 sticky top-0 z-30 shrink-0 transition-colors">
          <div className="flex items-center gap-4">
             <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight hidden sm:block">
                {activeTab === 'analysis' ? t.analysis : (activeTab === 'settings' ? t.settings : navItems.find(n => n.id === activeTab)?.label)}
              </h2>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isLoadingDB ? 'bg-blue-500 animate-bounce' : isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{isLoadingDB ? 'Syncing...' : isOnline ? 'Cloud Active' : 'Offline'}</p>
              </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={openFinder} className="p-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <button onClick={() => openProductForm()} className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all" title={t.addProduct}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>
            <div className="relative" ref={profileMenuRef}>
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all shadow-sm ${isProfileOpen ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-white dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>PS</button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-700 mb-1">
                    <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{googleUser ? 'Google User' : 'Admin User'}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{googleUser ? googleUser.name : 'PS Telecom'}</p>
                    {googleUser && <p className="text-[10px] text-slate-400 truncate">{googleUser.email}</p>}
                  </div>
                  <button onClick={() => { setActiveTab('settings'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {t.settings}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-40 md:pb-24 p-4 md:p-10 max-w-7xl mx-auto w-full">
          {isLoadingDB ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="font-bold text-sm uppercase tracking-widest">Waking up PS Telecom Cloud...</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard products={products} stats={stats} lang={lang} theme={theme} />}
              {activeTab === 'inventory' && <InventoryTable products={products} onStockAction={(id, type) => openStockAction(type as TransactionType, products.find(p => p.id === id))} onEdit={(p) => openProductForm(p)} onImport={handleBulkImport} lang={lang} />}
              {activeTab === 'history' && <HistoryLog transactions={transactions} lang={lang} />}
              {activeTab === 'analysis' && <AIAnalysis data={aiAnalysis} isLoading={isGeneratingInsights} onRefresh={runAnalysis} isOnline={isOnline} lang={lang} />}
              {activeTab === 'settings' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-colors">
                     <div className="flex items-center gap-4 mb-8">
                       <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.198 15.53 3 18.054" /></svg>
                       </div>
                       <div>
                         <h3 className="text-xl font-black text-slate-900 dark:text-white">{t.language}</h3>
                         <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Choose your preferred system language</p>
                       </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {['en', 'bn', 'hi'].map((lId) => (
                          <button 
                            key={lId}
                            onClick={() => setLang(lId as any)}
                            className={`p-6 rounded-3xl border-2 transition-all text-left flex flex-col gap-1 ${lang === lId ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}
                          >
                            <span className="text-lg font-black text-slate-800 dark:text-slate-100">{lId === 'en' ? 'English' : lId === 'bn' ? 'বাংলা' : 'हिन्दी'}</span>
                          </button>
                        ))}
                     </div>
                   </div>
                   <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-colors">
                     <div className="flex items-center gap-4 mb-8">
                       <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                       </div>
                       <div>
                         <h3 className="text-xl font-black text-slate-900 dark:text-white">{t.theme}</h3>
                         <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Select your visual mood preference</p>
                       </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { id: 'light', label: t.themeLight, icon: 'M12 3v1' },
                          { id: 'dark', label: t.themeDark, icon: 'M20.354 15.354' },
                          { id: 'system', label: t.themeSystem, icon: 'M9.75 17' }
                        ].map((item) => (
                          <button key={item.id} onClick={() => setTheme(item.id as Theme)} className={`p-6 rounded-3xl border-2 transition-all text-left flex items-center gap-4 ${theme === item.id ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">{item.label}</span>
                          </button>
                        ))}
                     </div>
                   </div>

                   <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-colors">
                     <div className="flex items-center gap-4 mb-8">
                       <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10l8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                       </div>
                       <div>
                         <h3 className="text-xl font-black text-slate-900 dark:text-white">Data Management</h3>
                         <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Import, Export and Cloud Backups</p>
                       </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                       <div className="space-y-4">
                         <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Local Storage</p>
                         <div className="flex flex-col gap-3">
                           <button 
                             onClick={() => exportToCSV(products)}
                             className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-blue-500/30 transition-all group"
                           >
                             <div className="flex items-center gap-3">
                               <div className="p-2 bg-white dark:bg-slate-700 rounded-lg text-slate-400 group-hover:text-blue-600 transition-colors">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                               </div>
                               <span className="font-bold text-slate-700 dark:text-slate-200">{t.localExport}</span>
                             </div>
                             <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                           </button>
                           
                           <label className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-blue-500/30 transition-all group cursor-pointer">
                             <input type="file" accept=".csv" className="hidden" onChange={handleLocalRestore} />
                             <div className="flex items-center gap-3">
                               <div className="p-2 bg-white dark:bg-slate-700 rounded-lg text-slate-400 group-hover:text-emerald-600 transition-colors">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                               </div>
                               <span className="font-bold text-slate-700 dark:text-slate-200">{t.localRestore}</span>
                             </div>
                             <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                           </label>
                         </div>
                       </div>

                       <div className="space-y-4">
                         <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cloud Backup</p>
                         <div className="flex flex-col gap-3">
                           {isDriveConnected ? (
                             <div className="space-y-3">
                               <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                 {googleUser?.picture ? (
                                   <img src={googleUser.picture} alt="Profile" className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-700" referrerPolicy="no-referrer" />
                                 ) : (
                                   <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center font-bold">G</div>
                                 )}
                                 <div className="flex-1 min-w-0">
                                   <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{googleUser?.name || 'Connected'}</p>
                                   <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{googleUser?.email}</p>
                                 </div>
                                 <button onClick={handleDriveLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                 </button>
                               </div>
                               <div className="grid grid-cols-2 gap-3">
                                 <button 
                                   onClick={handleDriveBackup}
                                   disabled={isBackingUp}
                                   className="flex items-center justify-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-2xl hover:bg-blue-600 hover:text-white transition-all font-bold"
                                 >
                                   {isBackingUp ? '...' : t.push}
                                 </button>
                                 <button 
                                   onClick={handleDriveRestore}
                                   disabled={isRestoring}
                                   className="flex items-center justify-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all font-bold"
                                 >
                                   {isRestoring ? '...' : t.pull}
                                 </button>
                               </div>
                             </div>
                           ) : (
                             <button 
                               onClick={handleDriveConnect}
                               disabled={isDriveLoading}
                               className="w-full flex items-center justify-center gap-3 p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                             >
                               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.532 2.47a1.18 1.18 0 0 0-1.064 0L2.342 7.58a1.18 1.18 0 0 0 0 2.04l9.126 5.11a1.18 1.18 0 0 0 1.064 0l9.126-5.11a1.18 1.18 0 0 0 0-2.04l-9.126-5.11zM11.468 15.47a1.18 1.18 0 0 1 1.064 0l9.126 5.11a1.18 1.18 0 0 1 0 2.04l-9.126-5.11a1.18 1.18 0 0 1-1.064 0l-9.126-5.11a1.18 1.18 0 0 1 0-2.04l9.126-5.11z"/></svg>
                               <span className="font-bold">{isDriveLoading ? 'Connecting...' : t.connectDrive}</span>
                             </button>
                           )}
                           <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-medium">
                             {isDriveConnected ? "✓ Google Account Authorized" : "Authorize your Google account to enable cloud sync."}
                           </p>
                         </div>
                       </div>
                     </div>
                   </div>
                </div>
              )}
            </>
          )}
        </div>

        {activeTab !== 'settings' && (
          <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-blue-500/15 animate-in slide-in-from-bottom-8 duration-500">
            <button onClick={() => openStockAction(TransactionType.IN)} className="flex items-center gap-2 px-5 py-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all group">
              <span className="text-xs font-black uppercase tracking-widest">{t.stockIn}</span>
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
            <button onClick={() => openStockAction(TransactionType.OUT)} className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white rounded-full hover:bg-amber-600 shadow-lg shadow-amber-500/25 active:scale-95 transition-all group">
              <span className="text-xs font-black uppercase tracking-widest">{t.stockOut}</span>
            </button>
          </div>
        )}

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 h-20 flex items-center justify-around px-4 z-40 transition-colors">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === item.id ? 'text-blue-600 dark:text-blue-400 scale-110' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} /></svg>
              <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-t-[40px] md:rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 md:animate-in md:fade-in md:zoom-in md:duration-200 max-h-[92vh] flex flex-col border border-white/20 dark:border-slate-800 transition-colors">
            <div className={`h-2.5 shrink-0 ${modalType === 'STOCK_ACTION' ? (stockActionType === TransactionType.IN ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-blue-500'}`} />
            <div className="p-8 md:p-10 overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {modalType === 'STOCK_ACTION' ? `${stockActionType === TransactionType.IN ? t.stockIn : t.stockOut}` : (modalType === 'FIND_PRODUCT' ? t.quickFind : (selectedProduct ? t.editProduct : t.addProduct))}
                  </h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-2xl transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              
              {modalType === 'STOCK_ACTION' ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  processStockTransaction(
                    formData.get('productId') as string, 
                    Number(formData.get('amount')), 
                    formData.get('reason') as string,
                    formData.get('newBoxNumber') as string
                  );
                }}>
                  <div className="space-y-6">
                    {!selectedProduct ? (
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.tableHeaderProduct}</label>
                        <select name="productId" required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl appearance-none font-bold text-slate-800 dark:text-white focus:border-blue-500/30 outline-none transition-all" onChange={(e) => setSelectedProduct(products.find(prod => prod.id === e.target.value) || null)}>
                          <option value="">Select Product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} • {p.sku}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <p className="font-bold text-slate-800 dark:text-white">{selectedProduct.name}</p>
                        <input type="hidden" name="productId" value={selectedProduct.id} />
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                          <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.tableHeaderStock}</label>
                          <input name="amount" type="number" required min="1" className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-2xl font-black focus:outline-none transition-all ${stockActionType === TransactionType.IN ? 'focus:border-emerald-500/30 text-emerald-600' : 'focus:border-amber-500/30 text-amber-600'}`} placeholder="0" autoFocus />
                       </div>
                       <div>
                          <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.boxNumber}</label>
                          <input name="newBoxNumber" type="text" defaultValue={selectedProduct?.boxNumber} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold dark:text-white focus:border-blue-500/30 outline-none transition-all" />
                       </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.reason}</label>
                        <input name="reason" type="text" required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold dark:text-white focus:border-blue-500/30 outline-none transition-all" placeholder="Context (e.g. Sale, Return)" />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-12">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-5 text-slate-400 dark:text-slate-500 font-black uppercase text-xs">{t.dismiss}</button>
                    <button type="submit" className={`flex-1 px-6 py-5 text-white font-black uppercase text-xs rounded-2xl shadow-xl transition-all active:scale-95 ${stockActionType === TransactionType.IN ? 'bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600' : 'bg-amber-500 shadow-amber-500/30 hover:bg-amber-600'}`}>{t.commit}</button>
                  </div>
                </form>
              ) : modalType === 'FIND_PRODUCT' ? (
                <div className="space-y-6">
                  <input autoFocus type="text" className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[30px] text-xl font-bold outline-none dark:text-white focus:border-blue-500/30 transition-all" placeholder={t.searchPlaceholder} value={finderQuery} onChange={(e) => setFinderQuery(e.target.value)} />
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {products.filter(p => p.name.toLowerCase().includes(finderQuery.toLowerCase()) || p.sku.toLowerCase().includes(finderQuery.toLowerCase())).slice(0, 5).map(p => (
                      <div key={p.id} className="py-5 flex items-center justify-between">
                        <div>
                          <p className="font-black text-slate-900 dark:text-white">{p.name}</p>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded uppercase">{p.sku}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openStockAction(TransactionType.IN, p)} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xl hover:bg-emerald-500 hover:text-white transition-all">+</button>
                          <button onClick={() => openStockAction(TransactionType.OUT, p)} className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl font-black text-xl hover:bg-amber-500 hover:text-white transition-all">-</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  saveProduct({
                    name: formData.get('name') as string,
                    sku: formData.get('sku') as string,
                    category: formData.get('category') as string,
                    boxNumber: formData.get('boxNumber') as string,
                    purchasePrice: Number(formData.get('purchasePrice')),
                    sellingPrice: Number(formData.get('sellingPrice')),
                    minThreshold: Number(formData.get('threshold')),
                    description: formData.get('description') as string,
                    quantity: selectedProduct ? selectedProduct.quantity : Number(formData.get('initialStock') || 0)
                  });
                }}>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.productName}</label>
                        <input name="name" defaultValue={selectedProduct?.name} required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold dark:text-white focus:border-blue-500/30 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.sku}</label>
                        <input name="sku" defaultValue={selectedProduct?.sku} required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-mono dark:text-white focus:border-blue-500/30 outline-none transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.category}</label>
                        <input name="category" defaultValue={selectedProduct?.category} required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold dark:text-white focus:border-blue-500/30 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.boxNumber}</label>
                        <input name="boxNumber" defaultValue={selectedProduct?.boxNumber} required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold dark:text-white focus:border-blue-500/30 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.minAlert}</label>
                        <input name="threshold" type="number" defaultValue={selectedProduct?.minThreshold} required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold dark:text-white focus:border-blue-500/30 outline-none transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.costPrice}</label>
                        <input name="purchasePrice" type={formShowCost ? "number" : "password"} step="0.01" defaultValue={selectedProduct?.purchasePrice} required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold dark:text-white focus:border-blue-500/30 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t.sellPrice}</label>
                        <input name="sellingPrice" type="number" step="0.01" defaultValue={selectedProduct?.sellingPrice} required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold dark:text-white focus:border-blue-500/30 outline-none transition-all" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-12">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-5 text-slate-400 dark:text-slate-500 font-black uppercase text-xs hover:text-slate-900 dark:hover:text-white transition-colors">{t.cancel}</button>
                    <button type="submit" className="flex-1 px-6 py-5 bg-blue-600 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-95">{t.save}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
