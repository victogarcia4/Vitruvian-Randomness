/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, RotateCcw, Play, Trash2, Plus, Users, Hash, List, Trophy, Image as ImageIcon, History, Download, X, Volume2, VolumeX, Shuffle, FileSpreadsheet } from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';

// --- Types ---

interface Item {
  id: string;
  text: string;
  color: string;
}

interface WinnerEntry {
  id: string;
  items: Item[];
  timestamp: number;
}

const CLASSICAL_COLORS = [
  '#5A5A40', // Olive
  '#8B4513', // Saddle Brown
  '#A0522D', // Sienna
  '#BC8F8F', // Rosy Brown
  '#CD853F', // Peru
  '#D2B48C', // Tan
  '#BDB76B', // Dark Khaki
  '#6B8E23', // Olive Drab
  '#556B2F', // Dark Olive Green
  '#808000', // Olive
];

// --- Components ---

export default function App() {
  const [items, setItems] = useState<Item[]>([
    { id: '1', text: 'Da Vinci', color: CLASSICAL_COLORS[0] },
    { id: '2', text: 'Michelangelo', color: CLASSICAL_COLORS[1] },
    { id: '3', text: 'Raphael', color: CLASSICAL_COLORS[2] },
    { id: '4', text: 'Donatello', color: CLASSICAL_COLORS[3] },
    { id: '5', text: 'Botticelli', color: CLASSICAL_COLORS[4] },
    { id: '6', text: 'Caravaggio', color: CLASSICAL_COLORS[5] },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [winners, setWinners] = useState<Item[]>([]);
  const [winnerHistory, setWinnerHistory] = useState<WinnerEntry[]>([]);
  const [numWinners, setNumWinners] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [centerImage, setCenterImage] = useState<string | null>(null);
  const [centerImageElement, setCenterImageElement] = useState<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState<'entries' | 'history'>('entries');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('vitruvian_sound');
    return saved === null ? true : saved === 'true';
  });
  
  // Stats
  const [spinCount, setSpinCount] = useState(() => {
    const saved = localStorage.getItem('vitruvian_spins');
    return saved ? parseInt(saved) : 0;
  });
  const [totalTimeMs, setTotalTimeMs] = useState(() => {
    const saved = localStorage.getItem('vitruvian_time');
    return saved ? parseInt(saved) : 0;
  });
  const sessionStartRef = useRef(Date.now());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spreadsheetInputRef = useRef<HTMLInputElement>(null);
  const wheelRadius = 250;

  // Track usage time
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const sessionElapsed = now - sessionStartRef.current;
      sessionStartRef.current = now;
      setTotalTimeMs(prev => {
        const next = prev + sessionElapsed;
        localStorage.setItem('vitruvian_time', next.toString());
        return next;
      });
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Persist spin count
  useEffect(() => {
    localStorage.setItem('vitruvian_spins', spinCount.toString());
  }, [spinCount]);

  // Persist sound setting
  useEffect(() => {
    localStorage.setItem('vitruvian_sound', soundEnabled.toString());
  }, [soundEnabled]);

  // Audio Synthesis
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playTick = () => {
    if (!soundEnabled) return;
    initAudio();
    const ctx = audioCtxRef.current!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  };

  const playWin = () => {
    if (!soundEnabled) return;
    initAudio();
    const ctx = audioCtxRef.current!;
    const now = ctx.currentTime;
    
    const playNote = (freq: number, delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.2, now + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.5);
    };

    playNote(523.25, 0); // C5
    playNote(659.25, 0.1); // E5
    playNote(783.99, 0.2); // G5
    playNote(1046.50, 0.3); // C6
  };

  // Pre-load center image
  useEffect(() => {
    if (centerImage) {
      const img = new Image();
      img.src = centerImage;
      img.onload = () => setCenterImageElement(img);
    } else {
      setCenterImageElement(null);
    }
  }, [centerImage]);

  // Draw the wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawWheel = () => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const totalItems = items.length;
      const arcSize = (2 * Math.PI) / totalItems;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      items.forEach((item, i) => {
        const angle = i * arcSize + rotation;
        
        // Draw slice
        ctx.beginPath();
        ctx.fillStyle = item.color;
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, wheelRadius, angle, angle + arcSize);
        ctx.lineTo(centerX, centerY);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle + arcSize / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Montserrat';
        ctx.fillText(item.text, wheelRadius - 20, 5);
        ctx.restore();
      });

      // Draw center hub
      if (centerImageElement) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(centerImageElement, centerX - 40, centerY - 40, 80, 80);
        ctx.restore();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
        ctx.strokeStyle = '#c5a059';
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#c5a059'; // Gold
        ctx.fill();
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    };

    drawWheel();
  }, [items, rotation, centerImageElement]);

  const spin = () => {
    if (isSpinning || items.length < 2) return;

    setIsSpinning(true);
    setWinners([]);

    const spinDuration = 4000; // 4 seconds
    const startRotation = rotation;
    const extraSpins = 5 + Math.random() * 5;
    const targetRotation = startRotation + extraSpins * 2 * Math.PI;
    const startTime = performance.now();
    
    const totalItems = items.length;
    const arcSize = (2 * Math.PI) / totalItems;
    let lastTickIndex = Math.floor(startRotation / arcSize);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      
      // Easing function: cubic-bezier(0.15, 0, 0.15, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentRotation = startRotation + (targetRotation - startRotation) * easeOut;
      setRotation(currentRotation);

      // Tick sound logic
      const currentTickIndex = Math.floor(currentRotation / arcSize);
      if (currentTickIndex !== lastTickIndex) {
        playTick();
        lastTickIndex = currentTickIndex;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        calculateWinners(currentRotation);
      }
    };

    requestAnimationFrame(animate);
  };

  const calculateWinners = (finalRotation: number) => {
    const totalItems = items.length;
    const arcSize = (2 * Math.PI) / totalItems;
    const selectedWinners: Item[] = [];
    const usedIndices = new Set<number>();

    // Calculate winner for each pointer
    for (let i = 0; i < numWinners; i++) {
      // Pointers are evenly distributed around the wheel starting from 0 (3 o'clock)
      const pointerAngle = (i * 2 * Math.PI) / numWinners;
      
      // The segment angle at the pointer is (pointerAngle - finalRotation)
      let targetAngle = (pointerAngle - finalRotation) % (2 * Math.PI);
      if (targetAngle < 0) targetAngle += 2 * Math.PI;
      
      const winningIndex = Math.floor(targetAngle / arcSize);
      
      // Avoid duplicate winners if pointers land on same segment (unlikely with many items)
      if (!usedIndices.has(winningIndex)) {
        selectedWinners.push(items[winningIndex]);
        usedIndices.add(winningIndex);
      } else {
        // Find next available
        let next = (winningIndex + 1) % totalItems;
        while (usedIndices.has(next)) {
          next = (next + 1) % totalItems;
        }
        selectedWinners.push(items[next]);
        usedIndices.add(next);
      }
    }

    setWinners(selectedWinners);
    setSpinCount(prev => prev + 1);
    setWinnerHistory(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      items: selectedWinners,
      timestamp: Date.now()
    }, ...prev]);

    playWin();
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: CLASSICAL_COLORS,
    });
  };

  const addItem = () => {
    if (!inputText.trim()) return;
    const newItems = inputText.split('\n').filter(t => t.trim()).map(t => ({
      id: Math.random().toString(36).substr(2, 9),
      text: t.trim(),
      color: CLASSICAL_COLORS[Math.floor(Math.random() * CLASSICAL_COLORS.length)],
    }));
    setItems([...items, ...newItems]);
    setInputText('');
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const clearAll = () => {
    setItems([]);
    setWinners([]);
  };

  const shuffleItems = () => {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    setItems(shuffled);
  };

  const generateNumbers = (count: number) => {
    const newItems = Array.from({ length: count }, (_, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      text: (i + 1).toString(),
      color: CLASSICAL_COLORS[i % CLASSICAL_COLORS.length],
    }));
    setItems(newItems);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCenterImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSpreadsheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          const newItems: Item[] = jsonData
            .flat()
            .filter(val => val !== null && val !== undefined && val.toString().trim() !== '')
            .map(val => ({
              id: Math.random().toString(36).substr(2, 9),
              text: val.toString().trim(),
              color: CLASSICAL_COLORS[Math.floor(Math.random() * CLASSICAL_COLORS.length)],
            }));
          
          if (newItems.length > 0) {
            setItems([...items, ...newItems]);
          }
        } catch (error) {
          console.error("Error parsing spreadsheet:", error);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const removeWinnersFromWheel = () => {
    const winnerIds = new Set(winners.map(w => w.id));
    setItems(items.filter(item => !winnerIds.has(item.id)));
    setWinners([]);
  };

  const downloadHistory = () => {
    const content = winnerHistory.map(entry => 
      `${new Date(entry.timestamp).toLocaleString()}: ${entry.items.map(i => i.text).join(', ')}`
    ).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'winner-history.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-parchment text-ink flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar: Controls & List */}
      <div className="w-full md:w-96 border-r border-ink/10 p-6 flex flex-col gap-6 bg-white/30 backdrop-blur-sm z-10 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold rounded-full flex items-center justify-center shadow-lg">
              <RotateCcw className="text-white w-6 h-6" />
            </div>
            <h1 className="serif text-3xl font-bold tracking-tight">Vitruvian Randomness</h1>
          </div>
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-full transition-all ${soundEnabled ? 'bg-gold text-white' : 'bg-ink/10 text-ink/40'}`}
            title={soundEnabled ? 'Disable Sound' : 'Enable Sound'}
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>

        {/* Stats Display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/50 p-3 rounded-xl border border-ink/5">
            <div className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Total Spins</div>
            <div className="text-xl font-bold serif">{spinCount}</div>
          </div>
          <div className="bg-white/50 p-3 rounded-xl border border-ink/5">
            <div className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Usage Time</div>
            <div className="text-xl font-bold serif">{(totalTimeMs / 3600000).toFixed(1)}h</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <button 
              onClick={() => generateNumbers(10)}
              className="flex-1 py-2 px-3 bg-white border border-ink/10 rounded-lg flex items-center justify-center gap-2 hover:bg-gold hover:text-white transition-all text-sm font-medium"
            >
              <Hash size={16} /> Numbers
            </button>
            <button 
              onClick={() => setItems([{ id: '1', text: 'Yes', color: CLASSICAL_COLORS[0] }, { id: '2', text: 'No', color: CLASSICAL_COLORS[1] }])}
              className="flex-1 py-2 px-3 bg-white border border-ink/10 rounded-lg flex items-center justify-center gap-2 hover:bg-gold hover:text-white transition-all text-sm font-medium"
            >
              <List size={16} /> Yes/No
            </button>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 px-3 bg-white border border-ink/10 rounded-lg flex items-center justify-center gap-2 hover:bg-gold hover:text-white transition-all text-sm font-medium"
            >
              <ImageIcon size={16} /> Hub
            </button>
            <button 
              onClick={() => spreadsheetInputRef.current?.click()}
              className="flex-1 py-2 px-3 bg-white border border-ink/10 rounded-lg flex items-center justify-center gap-2 hover:bg-gold hover:text-white transition-all text-sm font-medium"
            >
              <FileSpreadsheet size={16} /> Import
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              className="hidden" 
              accept="image/*"
            />
            <input 
              type="file" 
              ref={spreadsheetInputRef} 
              onChange={handleSpreadsheetUpload} 
              className="hidden" 
              accept=".csv, .xlsx, .xls"
            />
          </div>

          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter names or items (one per line)..."
              className="w-full h-32 p-4 bg-white/50 border border-ink/10 rounded-xl focus:ring-2 focus:ring-gold outline-none resize-none transition-all placeholder:italic"
            />
            <button 
              onClick={addItem}
              className="absolute bottom-3 right-3 p-2 bg-gold text-white rounded-lg shadow-md hover:scale-110 transition-transform"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider opacity-60">Number of Pointers</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setNumWinners(n)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${numWinners === n ? 'bg-gold text-white shadow-md' : 'bg-white border border-ink/10 hover:border-gold'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ink/10">
          <button 
            onClick={() => setActiveTab('entries')}
            className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'entries' ? 'border-b-2 border-gold text-gold' : 'opacity-40'}`}
          >
            Entries
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'history' ? 'border-b-2 border-gold text-gold' : 'opacity-40'}`}
          >
            History
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {activeTab === 'entries' ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="serif text-xl font-semibold">Entries ({items.length})</h2>
                <div className="flex gap-3">
                  <button onClick={shuffleItems} className="text-xs text-gold hover:underline flex items-center gap-1">
                    <Shuffle size={12} /> Shuffle
                  </button>
                  <button onClick={clearAll} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                    <Trash2 size={12} /> Clear All
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="group flex items-center justify-between p-3 bg-white rounded-xl border border-ink/5 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium">{item.text}</span>
                      </div>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="serif text-xl font-semibold">History ({winnerHistory.length})</h2>
                <button onClick={downloadHistory} className="text-xs text-gold hover:underline flex items-center gap-1">
                  <Download size={12} /> Save
                </button>
              </div>
              <div className="space-y-3">
                {winnerHistory.map((entry) => (
                  <div key={entry.id} className="p-3 bg-white rounded-xl border border-ink/5 shadow-sm">
                    <div className="text-[10px] uppercase tracking-widest opacity-40 mb-1">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {entry.items.map(winner => (
                        <span key={winner.id} className="px-2 py-1 bg-parchment rounded-md text-xs font-bold">
                          {winner.text}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {winnerHistory.length === 0 && (
                  <div className="text-center py-8 opacity-40 italic text-sm">
                    No winners yet...
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content: Wheel */}
      <div className="flex-1 relative flex items-center justify-center p-8 bg-[radial-gradient(circle_at_center,rgba(197,160,89,0.1)_0%,transparent_70%)]">
        {/* Pointers */}
        {Array.from({ length: numWinners }).map((_, i) => {
          const angle = (i * 360) / numWinners;
          // Calculate position on a circle slightly larger than the wheel
          const radius = 320; 
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;

          return (
            <motion.div
              key={i}
              initial={false}
              animate={{ x, y, rotate: angle + 45 }}
              className="absolute z-20 w-10 h-10 bg-gold shadow-2xl border-4 border-white flex items-center justify-center"
            >
              <div className="w-3 h-3 bg-ink rounded-full" />
            </motion.div>
          );
        })}

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className="max-w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
          />
          
          <button
            onClick={spin}
            disabled={isSpinning || items.length < 2}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-gold text-white font-bold text-xl shadow-[0_0_30px_rgba(197,160,89,0.5)] hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed z-30 border-4 border-white`}
          >
            <Play fill="white" size={24} />
            SPIN
          </button>
        </div>

        {/* Winners Modal */}
        <AnimatePresence>
          {winners.length > 0 && !isSpinning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
            >
              <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-4 border-gold text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gold" />
                
                <div className="mb-6 flex justify-center">
                  <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center">
                    <Trophy className="text-gold w-10 h-10" />
                  </div>
                </div>

                <h2 className="serif text-4xl font-bold mb-2">We have a winner!</h2>
                <p className="text-ink/60 mb-8 font-medium uppercase tracking-widest text-sm">
                  {winners.length === 1 ? 'Random selection complete' : `${winners.length} items selected`}
                </p>

                <div className="space-y-4 mb-8">
                  {winners.map((winner, idx) => (
                    <motion.div
                      key={winner.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-4 rounded-2xl text-2xl font-bold text-white shadow-lg relative group"
                      style={{ backgroundColor: winner.color }}
                    >
                      {winner.text}
                    </motion.div>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={removeWinnersFromWheel}
                    className="w-full py-4 bg-gold text-white rounded-2xl font-bold text-lg hover:bg-gold/90 transition-all shadow-xl flex items-center justify-center gap-2"
                  >
                    <Trash2 size={20} /> Remove from Wheel
                  </button>
                  <button
                    onClick={() => setWinners([])}
                    className="w-full py-4 bg-ink text-white rounded-2xl font-bold text-lg hover:bg-ink/90 transition-all shadow-xl"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(26, 26, 26, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(26, 26, 26, 0.2);
        }
      `}</style>
    </div>
  );
}
