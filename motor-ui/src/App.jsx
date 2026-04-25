import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';

export default function App() {
  // --- 1. STATE & NAVIGATION ---
  const [activeTab, setActiveTab] = useState('home'); 
  const [systemOn, setSystemOn] = useState(true); 
  const [motorData, setMotorData] = useState({ temp: 0, vibration: 0, current: 0, state: "IDLE", ml_status: "NORMAL", future_temp: 0, volatility: 0, time: 0 });
  const [graphHistory, setGraphHistory] = useState([]);
  const [timeRange, setTimeRange] = useState(60); 

  // --- 2. DATA BRIDGE (FETCH LOOP) ---
// --- 2. DATA BRIDGE (FETCH LOOP) ---
  useEffect(() => {
    const fetchHardwareData = async () => {
      if (!systemOn) return; 
      try {
        const response = await fetch('https://rancidity-reluctant-headpiece.ngrok-free.dev/api/motor', {
          headers: {
            'ngrok-skip-browser-warning': 'true' 
          }
        });
        const newData = await response.json();
        
        // Calculate UI Volatility based on ML status
        let vol = 5 + Math.random() * 10; 
        if (newData.ml_status === 'WARNING') vol = 75 + Math.random() * 20; 
        newData.volatility = vol;

        setMotorData(newData); 
        setGraphHistory(prev => [...prev, newData].slice(-1800)); // Keep 30 min history
      } catch (e) { 
        console.log("Waiting for Python Backend...", e); // Added 'e' here so you can see the exact error if it fails again
      }
    };
    const interval = setInterval(fetchHardwareData, 1000);
    return () => clearInterval(interval); 
  }, [systemOn]);

  const displayData = graphHistory.slice(-timeRange);

  // --- 3. THE GHOST LINE INJECTION (FOR ALL GRAPHS) ---
  // We create a unified data array that includes the future prediction for everything
  let projectedData = [...displayData];
  const lastPoint = projectedData[projectedData.length - 1];
  
  if (lastPoint) {
    // 1. Tie all ghost lines to the current actuals so they connect seamlessly
    projectedData[projectedData.length - 1] = {
      ...lastPoint,
      ghost_temp: lastPoint.temp,
      ghost_vibration: lastPoint.vibration,
      ghost_current: lastPoint.current,
      ghost_volatility: lastPoint.volatility
    };
    
    // 2. Plot the future predictions 30 seconds ahead for a longer visual runway
    projectedData.push({
      time: lastPoint.time + 30, 
      ghost_temp: lastPoint.future_temp,             // The actual ML prediction
      ghost_vibration: lastPoint.vibration,          // Status quo assumption
      ghost_current: lastPoint.current,              // Status quo assumption
      ghost_volatility: lastPoint.volatility         // Status quo assumption
    });
  }

  // --- 4. UI ANIMATIONS & STYLES ---
  const customStyles = `
    @keyframes pulse-glow { 0%, 100% { opacity: 1; text-shadow: 0 0 20px currentColor; } 50% { opacity: 0.5; text-shadow: 0 0 5px currentColor; } }
    .glow-text { animation: pulse-glow 2s infinite; }
    @keyframes grad { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    .ani-card { background-size: 200% 200%; animation: grad 3s ease infinite; padding: 2px; border-radius: 12px; transition: all 0.5s ease; }
    .card-inner { background: #111827; padding: 30px; border-radius: 10px; text-align: center; }
  `;

  // --- 5. REUSABLE CHART COMPONENT (SYNCED & OVERFLOW-SAFE) ---
  const ChartBox = ({ title, dKey, color, data, threshold, ghostKey, ghostName }) => (
    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#111827', padding: '20px 25px 20px 25px', borderRadius: '15px', marginBottom: '25px', height: '320px', border: '1px solid #1F2937' }}>
      <p style={{ margin: '0 0 10px 0', color: '#9CA3AF', fontWeight: 'bold', letterSpacing: '1px' }}>{title}</p>
      
      <div style={{ flex: 1, minHeight: 0 }}> 
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} syncId="motorSync" margin={{ top: 5, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            
            <XAxis 
              dataKey="time" 
              stroke="#4B5563" 
              fontSize={12}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => `${Math.floor(val)}s`} 
              label={{ value: 'TIME (SECONDS)', position: 'insideBottom', offset: -10, fill: '#9CA3AF', fontSize: 11, letterSpacing: '1px' }}
              padding={{ left: 10, right: 10 }} 
            />
            
            <YAxis 
              stroke="#4B5563" 
              fontSize={12} 
              tickFormatter={(val) => val.toFixed(1)} 
              width={45}
              axisLine={false}
              tickLine={false}
            />
            
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#E5E7EB' }}
              itemStyle={{ color: '#E5E7EB' }}
              labelFormatter={(label) => `Time: ${Number(label).toFixed(1)}s`}
              formatter={(value, name) => [value.toFixed(2), name === ghostKey ? ghostName : "Actual"]}
            />
            
            {threshold && (
              <ReferenceLine 
                y={threshold} 
                stroke="#EF4444" 
                strokeDasharray="5 5" 
                label={{ value: 'DANGER', fill: '#EF4444', fontSize: 10, fontWeight: 'bold', position: 'insideBottomRight' }} 
              />
            )}
            
            {/* The Actual Real-Time Line */}
            <Line type="monotone" dataKey={dKey} stroke={color} strokeWidth={3} dot={false} isAnimationActive={false} />
            
            {/* The Ghost Prediction Line */}
            {ghostKey && (
              <Line type="monotone" dataKey={ghostKey} name={ghostName} stroke={color} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#111827', stroke: color }} isAnimationActive={false} opacity={0.6} />
            )}

          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0B0F19', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{customStyles}</style>
      
      {/* SIDEBAR NAVIGATION */}
      <div style={{ width: '260px', backgroundColor: '#111827', borderRight: '1px solid #1F2937', padding: '30px 20px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ color: '#3B82F6', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>⚡</span> QUANTUM-GEN
        </h2>
        <p style={{ color: '#4B5563', fontSize: '0.8rem', marginBottom: '40px' }}>AI PREDICTIVE MAINTENANCE</p>
        
        <nav style={{ flex: 1 }}>
          <button onClick={() => setActiveTab('home')} style={{ width: '100%', padding: '15px', background: activeTab === 'home' ? '#1F2937' : 'transparent', color: activeTab === 'home' ? '#3B82F6' : '#9CA3AF', border: 'none', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', fontSize: '1rem', transition: '0.3s' }}>🏠 COMMAND CENTER</button>
          <button onClick={() => setActiveTab('graphs')} style={{ width: '100%', padding: '15px', background: activeTab === 'graphs' ? '#1F2937' : 'transparent', color: activeTab === 'graphs' ? '#3B82F6' : '#9CA3AF', border: 'none', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', fontSize: '1rem', marginTop: '10px', transition: '0.3s' }}>📈 LIVE TELEMETRY</button>
        </nav>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        
        {/* VIEW 1: HOME / COMMAND CENTER */}
        {activeTab === 'home' ? (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>System Command</h1>
            <p style={{ color: '#6B7280', marginBottom: '40px' }}>Control center for motor health and pipeline status.</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827', padding: '30px', borderRadius: '15px', marginBottom: '40px', border: '1px solid #1F2937' }}>
               <div>
                  <h3 style={{ margin: 0 }}>Active Data Pipeline</h3>
                  <p style={{ color: '#9CA3AF', margin: '5px 0 0 0' }}>{systemOn ? "🟢 Connected to Virtual Simulator" : "⚪ System Halted"}</p>
               </div>
               <div style={{ display: 'flex', gap: '15px' }}>
                  <button onClick={() => setSystemOn(true)} style={{ padding: '15px 30px', background: systemOn ? '#1F2937' : '#10B981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>START SYSTEM</button>
                  <button onClick={() => setSystemOn(false)} style={{ padding: '15px 30px', background: !systemOn ? '#1F2937' : '#EF4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>EMERGENCY STOP</button>
               </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div className="ani-card" style={{ backgroundImage: motorData.ml_status === 'WARNING' ? 'linear-gradient(90deg, #ef4444, #7f1d1d, #ef4444)' : 'linear-gradient(90deg, #10b981, #064e3b, #10b981)' }}>
                <div className="card-inner">
                  <p style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>MOTOR HEALTH</p>
                  <h2 className="glow-text" style={{ fontSize: '4rem', margin: '15px 0', color: motorData.ml_status === 'WARNING' ? '#EF4444' : '#10B981' }}>{motorData.ml_status}</h2>
                  <p style={{ color: '#6B7280' }}>MODE: {motorData.state}</p>
                </div>
              </div>
              <div className="ani-card" style={{ backgroundImage: 'linear-gradient(90deg, #3b82f6, #1e3a8a, #3b82f6)' }}>
                <div className="card-inner">
                  <p style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>TIME TILL FAILURE</p>
                  <h2 style={{ fontSize: '4rem', margin: '15px 0', color: motorData.ml_status === 'WARNING' ? '#F59E0B' : 'white' }}>{motorData.ml_status === 'WARNING' ? "15 SEC" : "STABLE"}</h2>
                  <p style={{ color: '#6B7280' }}>PREDICTED: {motorData.future_temp.toFixed(1)}°C</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: GRAPHS / TELEMETRY */
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
             {/* FIXED HEADER BLOCK */}
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '300px' }}>
                  <h1 style={{ margin: 0, fontSize: '2.5rem', lineHeight: '1.1' }}>Full Spectrum Telemetry</h1>
                  <p style={{ color: '#6B7280', margin: '10px 0 0 0', fontSize: '1.1rem' }}>Real-time synchronized sensor analysis</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', paddingTop: '10px' }}>
                   {[30, 60, 300].map(t => (
                     <button key={t} onClick={() => setTimeRange(t)} style={{ padding: '10px 20px', background: timeRange === t ? '#3B82F6' : '#1F2937', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                       {t === 300 ? '5m' : t + 's'}
                     </button>
                   ))}
                </div>
             </div>

             {/* ALL GRAPHS NOW RECEIVE THE 'projectedData' WITH GHOST KEYS */}
             <ChartBox 
                title="VOLATILITY INDEX (%)" 
                dKey="volatility" 
                color="#F59E0B" 
                data={projectedData} 
                threshold={65} 
                ghostKey="ghost_volatility" 
                ghostName="Status Quo Forecast" 
             />
             <ChartBox 
                title="HEAT GENERATION & AI FORECAST (°C)" 
                dKey="temp" 
                color="#EF4444" 
                data={projectedData} 
                ghostKey="ghost_temp" 
                ghostName="AI Trend (+30s)" 
             />
             <ChartBox 
                title="CHASSIS VIBRATION (G)" 
                dKey="vibration" 
                color="#10B981" 
                data={projectedData} 
                ghostKey="ghost_vibration" 
                ghostName="Status Quo Forecast" 
             />
             <ChartBox 
                title="MOTOR LOAD (AMPS)" 
                dKey="current" 
                color="#60A5FA" 
                data={projectedData} 
                ghostKey="ghost_current" 
                ghostName="Status Quo Forecast" 
             />
             
             <div style={{ height: '60px' }}></div>
          </div>
        )}
      </div>
    </div>
  );
}