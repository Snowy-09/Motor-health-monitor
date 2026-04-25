import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';

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

  // --- DYNAMIC TTF MATH ---
  const calculateTTF = () => {
    if (isBackendOffline) return "OFFLINE";
    if (motorData.ml_status === 'WARNING' || isUnstable) return "CRITICAL";
    if (!systemOn) return "HALTED";

    const heatingRate = motorData.future_temp - motorData.temp;
    if (heatingRate <= 0.05) return "> 24 HRS";

    const degreesLeft = 50.0 - motorData.temp; // Matched to Hardware 50C limit
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

      await fetch('https://rancidity-reluctant-headpiece.ngrok-free.dev/api/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
      });
      alert("Push Alerts Enabled!");
    } catch (err) {
      alert("Failed to enable alerts. Check Ngrok!");
    }
  }

  // --- CLEAN DATA FETCH (SIMULATION REMOVED) ---
  useEffect(() => {
    const fetchHardwareData = async () => {
      try {
        const response = await fetch('https://rancidity-reluctant-headpiece.ngrok-free.dev/api/motor', {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        const newData = await response.json();
        
        setIsBackendOffline(false);
        processDataPoint(newData);

      } catch (e) { 
        // Backend is unreachable
        setIsBackendOffline(true);
        setMotorData(prev => ({ ...prev, ml_status: "OFFLINE", state: "DISCONNECTED", ai_log: "❌ Connection Lost" }));
      }
    };

    const processDataPoint = (data) => {
        const DANGER_TEMP = 50.0; // Synced with Arduino Relay
        const DANGER_VIBE = 20000;  // Synced with Arduino MPU6050 logic
        
        const currentlyUnstable = (data.temp > DANGER_TEMP || data.vibration > DANGER_VIBE || data.ml_status === 'WARNING');
        setIsUnstable(currentlyUnstable);

        if (systemOn && currentlyUnstable) {
            setSystemOn(false); 
            if (Notification.permission === 'granted') {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(`🚨 ${selectedMotor} CRITICAL`, {
                        body: `THRESHOLD BREACHED!\nTemp: ${data.temp.toFixed(1)}°C | Vibe: ${data.vibration}`,
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
  }, [systemOn, selectedMotor]); 

  // --- CHART INJECTION ---
  const displayData = graphHistory.slice(-timeRange);
  let projectedData = [...displayData];
  const lastPoint = projectedData[projectedData.length - 1];
  
  if (lastPoint && !isBackendOffline) {
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
    .ani-card { background-size: 200% 200%; animation: grad 3s ease infinite; padding: 2px; border-radius: 12px; }
    .card-inner { background: #111827; padding: 30px; border-radius: 10px; text-align: center; }
    @media (max-width: 768px) {
      .sidebar-container { position: fixed; z-index: 100; transform: translateX(-100%); transition: 0.3s; height: 100vh; }
      .sidebar-container.open { transform: translateX(0); }
      .mobile-header { display: flex; position: fixed; top: 0; left: 0; right: 0; height: 60px; background: #111827; z-index: 50; align-items: center; padding: 0 20px; justify-content: space-between; border-bottom: 1px solid #1F2937; }
    }
  `;

  const ChartBox = ({ title, dKey, color, data, threshold, ghostKey, ghostName }) => (
    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#111827', padding: '20px', borderRadius: '15px', marginBottom: '25px', height: '320px', border: '1px solid #1F2937' }}>
      <p style={{ margin: '0 0 10px 0', color: '#9CA3AF', fontWeight: 'bold' }}>{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis dataKey="time" stroke="#4B5563" fontSize={12} tickFormatter={(val) => `${val}s`} />
          <YAxis stroke="#4B5563" fontSize={12} width={45} />
          <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
          {threshold && <ReferenceLine y={threshold} stroke="#EF4444" strokeDasharray="5 5" />}
          <Line type="monotone" dataKey={dKey} stroke={color} strokeWidth={3} dot={false} isAnimationActive={false} />
          {ghostKey && <Line type="monotone" dataKey={ghostKey} stroke={color} strokeWidth={2} strokeDasharray="5 5" dot={false} opacity={0.4} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0B0F19', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      <style>{customStyles}</style>

      {/* SIDEBAR */}
      <div className={`sidebar-container ${isSidebarOpen ? 'open' : ''}`} style={{ width: '260px', backgroundColor: '#111827', padding: '30px 20px', borderRight: '1px solid #1F2937' }}>
        <h2 style={{ color: '#3B82F6', fontSize: '1.2rem' }}>⚡ MOTOR HEALTH</h2>
        <p style={{ color: '#4B5563', fontSize: '0.75rem', marginBottom: '30px' }}>AI PREDICTIVE MONITOR</p>
        
        <select value={selectedMotor} onChange={(e) => setSelectedMotor(e.target.value)} style={{ width: '100%', padding: '10px', background: '#1F2937', color: 'white', borderRadius: '6px', marginBottom: '30px' }}>
          {motors.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <nav>
          <button onClick={() => setActiveTab('home')} style={{ width: '100%', padding: '15px', background: activeTab === 'home' ? '#1F2937' : 'transparent', color: '#3B82F6', border: 'none', textAlign: 'left', cursor: 'pointer' }}>🏠 COMMAND CENTER</button>
          <button onClick={() => setActiveTab('graphs')} style={{ width: '100%', padding: '15px', background: activeTab === 'graphs' ? '#1F2937' : 'transparent', color: '#9CA3AF', border: 'none', textAlign: 'left', cursor: 'pointer', marginTop: '10px' }}>📈 LIVE TELEMETRY</button>
        </nav>
      </div>

      <div className="main-content" style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        {activeTab === 'home' ? (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1>{selectedMotor} Control</h1>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#111827', padding: '30px', borderRadius: '15px', marginBottom: '40px', border: '1px solid #1F2937' }}>
               <div>
                  <h3>Active Data Pipeline</h3>
                  <p style={{ color: isBackendOffline ? '#EF4444' : '#10B981' }}>{isBackendOffline ? "🔴 DISCONNECTED" : "🟢 Telemetry Connected"}</p>
               </div>
               <div style={{ display: 'flex', gap: '15px' }}>
                  <button onClick={() => setSystemOn(true)} disabled={isUnstable || isBackendOffline} style={{ padding: '15px 30px', background: (isUnstable || isBackendOffline) ? '#374151' : '#10B981', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold' }}>START</button>
                  <button onClick={() => setSystemOn(false)} style={{ padding: '15px 30px', background: '#EF4444', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold' }}>STOP</button>
                  <button onClick={enableNotifications} style={{ padding: '15px 30px', background: '#F59E0B', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold' }}>🔔 ALERTS</button>
               </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div className="ani-card" style={{ backgroundImage: motorData.ml_status === 'WARNING' ? 'linear-gradient(90deg, #ef4444, #7f1d1d, #ef4444)' : 'linear-gradient(90deg, #10b981, #064e3b, #10b981)' }}>
                <div className="card-inner">
                  <p style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>HARDWARE HEALTH</p>
                  <h2 className="glow-text" style={{ fontSize: '4rem', margin: '15px 0' }}>{motorData.ml_status}</h2>
                  <p style={{ color: '#6B7280' }}>{motorData.ai_log}</p>
                </div>
              </div>
              
              <div className="ani-card" style={{ backgroundImage: 'linear-gradient(90deg, #3b82f6, #1e3a8a, #3b82f6)' }}>
                <div className="card-inner">
                  <p style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>TIME TILL FAILURE</p>
                  <h2 style={{ fontSize: '3.2rem', margin: '15px 0' }}>{calculateTTF()}</h2>
                  <p style={{ color: '#6B7280' }}>LIMIT: 50.0°C</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
             <ChartBox title="HEAT GENERATION & AI FORECAST (°C)" dKey="temp" color="#EF4444" data={projectedData} threshold={50} ghostKey="ghost_temp" />
             <ChartBox title="CHASSIS VIBRATION (RAW)" dKey="vibration" color="#10B981" data={projectedData} threshold={20000} />
             <ChartBox title="MOTOR LOAD (AMPS)" dKey="current" color="#60A5FA" data={projectedData} />
          </div>
        )}
      </div>
    </div>
  );
}