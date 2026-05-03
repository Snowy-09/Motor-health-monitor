import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';

// --- NOTIFICATION SETUP ---
const PUBLIC_KEY = "BIuK1jgnnxunwDzvs7kdIlY5TIn9QX0xahfBj9VrX5ExQC2hnbx-yJ6Ik8GHfWYXdpvZtpvemOoqv46GXHakcaA"; 

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function App() {
  const [demoMode, setDemoMode] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); 
  const [systemOn, setSystemOn] = useState(true); 
  const [isUnstable, setIsUnstable] = useState(false); 
  const [isBackendOffline, setIsBackendOffline] = useState(false);
  
  const [motors, setMotors] = useState(['Unit Alpha', 'Unit Beta', 'Conveyor Drive 1']);
  const [selectedMotor, setSelectedMotor] = useState('Unit Alpha');

  const [motorData, setMotorData] = useState({ temp: 0, vibration: 0, current: 0, state: "WAITING", ml_status: "CONNECTING", future_temp: 0, volatility: 0, time: 0, ai_log: "Initializing..." });
  const [graphHistory, setGraphHistory] = useState([]);
  const [timeRange, setTimeRange] = useState(60); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const demoTimeRef = useRef(0);

  // --- DYNAMIC TTF MATH ---
  const calculateTTF = () => {
    if (isBackendOffline && !demoMode) return "OFFLINE";
    if (motorData.ml_status === 'DISCONNECTED' && !demoMode) return "NO DATA";
    
    if (motorData.ml_status === 'WARNING' || isUnstable) return "CRITICAL";
    if (!systemOn) return "HALTED";

    const heatingRate = motorData.future_temp - motorData.temp;
    if (heatingRate <= 0.05) return "> 24 HRS";

    const degreesLeft = 50.0 - motorData.temp; 
    const secondsTillFailure = (degreesLeft / heatingRate) * 30;

    if (secondsTillFailure < 60) return `${Math.max(0, Math.round(secondsTillFailure))} SEC`;
    if (secondsTillFailure < 3600) return `${Math.max(0, Math.round(secondsTillFailure / 60))} MIN`;
    return `${Math.max(0, (secondsTillFailure / 3600)).toFixed(1)} HRS`;
  };

  async function enableNotifications() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return alert("Notifications denied!");
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
      });

      await fetch('https://motor-health-monitor.onrender.com/api/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: { 'Content-Type': 'application/json' }
      });
      alert("Push Alerts Enabled!");
    } catch (err) {
      alert("Failed to enable alerts. Check Server!");
    }
  }

  useEffect(() => {
    const fetchHardwareData = async () => {
      
      // 1. DEMO MODE ENGINE
      if (demoMode) {
        demoTimeRef.current += 1;
        const cycle = demoTimeRef.current % 120;
        
        let t = 35, v = 1500, c = 2.0, status = "NORMAL", log = "Systems Nominal", vol = 15;
        
        // Simulate graceful motor spin-down
        if (!systemOn) {
          t = 28 + Math.random(); 
          v = 0 + (Math.random() * 50); 
          c = 0.0; 
          status = "NORMAL";
          log = "🛑 Motor Halted (Safe State)";
          vol = 0;
        } else {
          if (cycle < 40) { 
            t = 35 + Math.random(); v = 1500 + Math.random() * 500; c = 2.0 + Math.random() * 0.2;
          } else if (cycle < 50) { 
            t = 36 + Math.random(); v = 25000 + Math.random() * 2000; c = 2.5 + Math.random() * 0.2; 
            status = "WARNING"; log = "⚠️ Erratic Vibration Spikes";
          } else if (cycle < 100) { 
            const p = (cycle - 50) / 50.0;
            t = 36 + (16 * Math.pow(p, 2)) + Math.random(); 
            v = 2000 + Math.random() * 500; c = 3.5 + Math.random() * 0.5;
            if (t > 48) { status = "WARNING"; log = "🔥 Heat Limit Approaching"; }
          } else { 
            const p = (cycle - 100) / 20.0;
            t = 52 - (17 * p) + Math.random(); v = 1500 + Math.random() * 500; c = 1.5 + Math.random() * 0.2;
          }
          vol = status === "WARNING" ? 85 + (Math.random() * 10) : 15 + (Math.random() * 10);
        }

        const fakeData = {
          time: demoTimeRef.current,
          temp: t, vibration: v, current: c,
          state: (!systemOn) ? "HALTED" : (status === "WARNING" ? "STRESSED" : "RUNNING"),
          ml_status: status,
          future_temp: t + ((status === "WARNING" && systemOn) ? (t > 48 ? 4 : 0.5) : 0.2), 
          volatility: vol,
          ai_log: log
        };
        
        setIsBackendOffline(false);
        processDataPoint(fakeData);
        return; 
      }

      // 2. LIVE HARDWARE FETCH
      try {
        // ✅ CORRECT RENDER CLOUD URL
        const response = await fetch('https://motor-health-monitor.onrender.com/api/motor');
        
        // ❌ LOCALHOST URL (Commented out for production)
        // const response = await fetch('http://localhost:8000/api/motor');
        
        const newData = await response.json();
        
        if (newData.volatility === undefined) {
           newData.volatility = newData.ml_status === 'WARNING' ? 85 + (Math.random() * 10) : 15 + (Math.random() * 10);
        }

        setIsBackendOffline(false);
        processDataPoint(newData);
      } catch (e) { 
        setIsBackendOffline(true);
        setMotorData(prev => ({ ...prev, ml_status: "OFFLINE", state: "DISCONNECTED", ai_log: "❌ Connection Lost" }));
      }
    };

    const processDataPoint = (data) => {
        const DANGER_TEMP = 50.0; 
        const DANGER_VIBE = 20000;  
        
        const currentlyUnstable = (data.temp > DANGER_TEMP || data.vibration > DANGER_VIBE || data.ml_status === 'WARNING');
        setIsUnstable(currentlyUnstable);

        if (systemOn && currentlyUnstable) {
            setSystemOn(false); 
            if (Notification.permission === 'granted') {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(`🚨 ${selectedMotor} CRITICAL`, {
                        body: `THRESHOLD BREACHED!\nTemp: ${data.temp.toFixed(2)}°C | Vibe: ${Math.round(data.vibration)}`,
                        vibrate: [500, 200, 500],
                        icon: '/favicon.svg'
                    });
                });
            }
        }
        
        setMotorData(data); 
        setGraphHistory(prev => [...prev, data].slice(-1800)); 
    };
    
    const interval = setInterval(fetchHardwareData, 1000);
    return () => clearInterval(interval); 
  }, [systemOn, selectedMotor, demoMode]); 

  const displayData = graphHistory.slice(-timeRange);
  let projectedData = [...displayData];
  const lastPoint = projectedData[projectedData.length - 1];
  
  if (lastPoint && (!isBackendOffline || demoMode)) {
    projectedData.push({
      time: lastPoint.time + 30, 
      ghost_temp: lastPoint.future_temp,             
      ghost_vibration: lastPoint.vibration,          
      ghost_current: lastPoint.current,              
    });
  }

  const customStyles = `
    @keyframes pulse-glow { 0%, 100% { opacity: 1; text-shadow: 0 0 20px currentColor; } 50% { opacity: 0.5; text-shadow: 0 0 5px currentColor; } }
    .glow-text { animation: pulse-glow 2s infinite; }
    @keyframes grad { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    
    .ani-card { 
      background-size: 200% 200%; 
      animation: grad 3s ease infinite; 
      padding: 3px; 
      border-radius: 12px; 
      display: flex; 
      flex-direction: column; 
    }
    
    .card-inner { 
      background: #111827; 
      padding: 30px; 
      border-radius: 10px; 
      text-align: center; 
      flex: 1; 
      display: flex; 
      flex-direction: column; 
      justify-content: center; 
      white-space: nowrap; 
    }

    .top-cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-top: 30px;
    }
    
    .metric-box {
      background: #111827;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #1F2937;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .mobile-header { display: none; }
    
    /* 💻 TABLET RULES (For iPads & Smaller Laptops) */
    @media (max-width: 1100px) and (min-width: 769px) {
      .card-inner h2 { font-size: 2.5rem !important; }
      .metrics-grid { gap: 10px; }
      .metric-box h3 { font-size: 1.4rem !important; }
    }

    /* 📱 MOBILE RULES */
    @media (max-width: 768px) {
      .sidebar-container { position: fixed; z-index: 100; transform: translateX(-100%); transition: 0.3s; height: 100vh; }
      .sidebar-container.open { transform: translateX(0); }
      
      .mobile-header { display: flex; position: fixed; top: 0; left: 0; right: 0; height: 60px; background: #111827; z-index: 50; align-items: center; padding: 0 20px; justify-content: space-between; border-bottom: 1px solid #1F2937; }
      
      .main-content { padding-top: 80px !important; padding-left: 15px !important; padding-right: 15px !important; }
      
      .top-cards-grid { grid-template-columns: 1fr; gap: 15px; }
      .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      
      .card-inner h2 { font-size: 2.2rem !important; margin: 10px 0; }
      .controls-bar { flex-direction: column; gap: 15px; }
      .controls-bar button { width: 100%; }
    }
  `;

  const ChartBox = ({ title, dKey, color, data, threshold, ghostKey }) => (
    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#111827', padding: '20px', borderRadius: '15px', marginBottom: '25px', height: '320px', border: '1px solid #1F2937' }}>
      <p style={{ margin: '0 0 10px 0', color: '#9CA3AF', fontWeight: 'bold' }}>{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
          <defs>
            <linearGradient id={`fillColor-${dKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
              <stop offset="95%" stopColor={color} stopOpacity={0.0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis dataKey="time" stroke="#4B5563" fontSize={12} tickFormatter={(val) => `${val}s`} />
          <YAxis stroke="#4B5563" fontSize={12} width={45} tickFormatter={(val) => val.toFixed(1)} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} 
            formatter={(value) => [value.toFixed(2), "Value"]} 
          />
          {threshold && <ReferenceLine y={threshold} stroke="#EF4444" strokeDasharray="5 5" />}
          <Area type="monotone" dataKey={dKey} stroke={color} fill={`url(#fillColor-${dKey})`} strokeWidth={3} isAnimationActive={false} />
          {ghostKey && <Area type="monotone" dataKey={ghostKey} stroke={color} fill="none" strokeWidth={2} strokeDasharray="5 5" isAnimationActive={false} opacity={0.6} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0B0F19', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      <style>{customStyles}</style>

      {/* 📱 MOBILE HEADER */}
      <div className="mobile-header">
        <h2 style={{ color: '#3B82F6', fontSize: '1.2rem', margin: 0 }}>⚡ MOTOR HEALTH</h2>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.8rem', cursor: 'pointer' }}>
          {isSidebarOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* SIDEBAR */}
      <div className={`sidebar-container ${isSidebarOpen ? 'open' : ''}`} style={{ width: '260px', backgroundColor: '#111827', padding: '30px 20px', borderRight: '1px solid #1F2937' }}>
        <h2 style={{ color: '#3B82F6', fontSize: '1.2rem', marginTop: '20px' }}>⚡ MOTOR HEALTH</h2>
        <p style={{ color: '#4B5563', fontSize: '0.75rem', marginBottom: '30px' }}>AI PREDICTIVE MONITOR</p>
        
        <select value={selectedMotor} onChange={(e) => setSelectedMotor(e.target.value)} style={{ width: '100%', padding: '10px', background: '#1F2937', color: 'white', borderRadius: '6px', marginBottom: '30px' }}>
          {motors.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <nav>
          <button onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }} style={{ width: '100%', padding: '15px', background: activeTab === 'home' ? '#1F2937' : 'transparent', color: '#3B82F6', border: 'none', textAlign: 'left', cursor: 'pointer' }}>🏠 COMMAND CENTER</button>
          <button onClick={() => { setActiveTab('graphs'); setIsSidebarOpen(false); }} style={{ width: '100%', padding: '15px', background: activeTab === 'graphs' ? '#1F2937' : 'transparent', color: '#9CA3AF', border: 'none', textAlign: 'left', cursor: 'pointer', marginTop: '10px' }}>📈 LIVE TELEMETRY</button>
        </nav>
      </div>

      <div className="main-content" style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button 
            onClick={() => setDemoMode(!demoMode)}
            style={{ 
              padding: '8px 16px', backgroundColor: demoMode ? '#8B5CF6' : '#374151', color: 'white', border: '1px solid',
              borderColor: demoMode ? '#A78BFA' : '#4B5563', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', transition: '0.3s'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{demoMode ? '🧪' : '📡'}</span>
            {demoMode ? 'DEMO MODE' : 'LIVE DATA'}
          </button>
        </div>

        {activeTab === 'home' ? (
          <div style={{ width: '100%', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0 }}>{selectedMotor} Control</h1>
            
            <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#111827', padding: '30px', borderRadius: '15px', marginBottom: '30px', border: '1px solid #1F2937' }}>
               <div style={{ marginBottom: '15px' }}>
                  <h3>Active Data Pipeline</h3>
                  <p style={{ color: (isBackendOffline && !demoMode) ? '#EF4444' : '#10B981', margin: 0 }}>
                    {demoMode ? "🧪 Simulator Running" : (isBackendOffline ? "🔴 DISCONNECTED" : "🟢 Telemetry Connected")}
                  </p>
               </div>
               <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setSystemOn(true)} disabled={(isUnstable || isBackendOffline) && !demoMode} style={{ padding: '15px 20px', background: ((isUnstable || isBackendOffline) && !demoMode) ? '#374151' : '#10B981', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>START</button>
                  <button onClick={() => setSystemOn(false)} style={{ padding: '15px 20px', background: '#EF4444', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>STOP</button>
                  <button onClick={enableNotifications} style={{ padding: '15px 20px', background: '#F59E0B', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>🔔</button>
               </div>
            </div>

            <div className="top-cards-grid">
              <div className="ani-card" style={{ backgroundImage: motorData.ml_status === 'WARNING' ? 'linear-gradient(90deg, #ef4444, #7f1d1d, #ef4444)' : (motorData.ml_status === 'DISCONNECTED' || motorData.ml_status === 'OFFLINE' ? 'none' : 'linear-gradient(90deg, #10b981, #064e3b, #10b981)'), backgroundColor: motorData.ml_status === 'DISCONNECTED' || motorData.ml_status === 'OFFLINE' ? '#374151' : 'transparent' }}>
                <div className="card-inner">
                  <p style={{ color: '#9CA3AF', fontSize: '0.9rem', margin: '0 0 10px 0' }}>HARDWARE HEALTH</p>
                  <h2 className="glow-text" style={{ fontSize: motorData.ml_status.length > 8 ? '2.5rem' : '4rem', margin: '15px 0' }}>
                    {motorData.ml_status}
                  </h2>
                  <p style={{ color: '#6B7280', margin: 0 }}>{motorData.ai_log}</p>
                </div>
              </div>
              
              <div className="ani-card" style={{ backgroundImage: 'linear-gradient(90deg, #3b82f6, #1e3a8a, #3b82f6)' }}>
                <div className="card-inner">
                  <p style={{ color: '#9CA3AF', fontSize: '0.9rem', margin: '0 0 10px 0' }}>TIME TILL FAILURE</p>
                  <h2 style={{ fontSize: '3.2rem', margin: '15px 0' }}>{calculateTTF()}</h2>
                  <p style={{ color: '#6B7280', margin: 0 }}>LIMIT: 50.0°C</p>
                </div>
              </div>
            </div>

            <div className="metrics-grid">
              <div className="metric-box">
                <p style={{ color: '#9CA3AF', fontSize: '0.8rem', margin: '0 0 5px 0', letterSpacing: '1px' }}>VOLATILITY</p>
                <h3 style={{ margin: 0, color: '#F59E0B', fontSize: '1.8rem' }}>{(motorData.volatility || 0).toFixed(1)}%</h3>
              </div>
              <div className="metric-box">
                <p style={{ color: '#9CA3AF', fontSize: '0.8rem', margin: '0 0 5px 0', letterSpacing: '1px' }}>TEMP</p>
                <h3 style={{ margin: 0, color: '#EF4444', fontSize: '1.8rem' }}>{(motorData.temp || 0).toFixed(1)}°C</h3>
              </div>
              <div className="metric-box">
                <p style={{ color: '#9CA3AF', fontSize: '0.8rem', margin: '0 0 5px 0', letterSpacing: '1px' }}>VIBRATION</p>
                <h3 style={{ margin: 0, color: '#10B981', fontSize: '1.8rem' }}>{Math.round(motorData.vibration || 0)}</h3>
              </div>
              <div className="metric-box">
                <p style={{ color: '#9CA3AF', fontSize: '0.8rem', margin: '0 0 5px 0', letterSpacing: '1px' }}>CURRENT</p>
                <h3 style={{ margin: 0, color: '#60A5FA', fontSize: '1.8rem' }}>{(motorData.current || 0).toFixed(2)}A</h3>
              </div>
            </div>

          </div>
        ) : (
          <div style={{ width: '100%', margin: '0 auto' }}>
             <ChartBox title="VOLATILITY INDEX (%)" dKey="volatility" color="#F59E0B" data={projectedData} threshold={80} />
             <ChartBox title="HEAT GENERATION & AI FORECAST (°C)" dKey="temp" color="#EF4444" data={projectedData} threshold={50} ghostKey="ghost_temp" />
             <ChartBox title="CHASSIS VIBRATION (RAW)" dKey="vibration" color="#10B981" data={projectedData} threshold={20000} />
             <ChartBox title="MOTOR LOAD (AMPS)" dKey="current" color="#60A5FA" data={projectedData} />
          </div>
        )}
      </div>
    </div>
  );
}