import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function App() {
  // 1. STATE: This holds the data that runs the whole app
  const [history, setHistory] = useState([]); // Array of data for the graphs
  const [currentStatus, setCurrentStatus] = useState("NORMAL"); // ML prediction status

  // 2. THE API PLUG: This runs every 1 second
  useEffect(() => {
    const fetchMotorData = async () => {
      try {
        // ==========================================
        // SATURDAY: Uncomment these lines to connect to his Python backend
        // const response = await fetch('http://localhost:8000/api/motor');
        // const newData = await response.json();
        // ==========================================

        // THURSDAY/FRIDAY: Fake data to keep the framework running
        const now = new Date();
        const newData = {
          time: `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`,
          temperature: Math.floor(Math.random() * (90 - 40 + 1)) + 40,
          vibration: (Math.random() * 2).toFixed(2),
          current: (Math.random() * 5).toFixed(1),
          ml_status: Math.random() > 0.8 ? "WARNING" : "NORMAL" // Randomly triggers a warning
        };

        // Update the current status text
        setCurrentStatus(newData.ml_status);

        // Add new data to the graph history (keep only the last 20 points)
        setHistory((prevHistory) => {
          const updated = [...prevHistory, newData];
          return updated.length > 20 ? updated.slice(1) : updated;
        });

      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    // Run the fetch function every 1000ms (1 second)
    const intervalId = setInterval(fetchMotorData, 1000);
    return () => clearInterval(intervalId); // Cleanup when app closes
  }, []);

  // 3. THE SKELETON UI
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* Header Section */}
      <header style={{ marginBottom: '30px' }}>
        <h1>Motor Health Dashboard</h1>
        <h2>System Status: <span style={{ color: currentStatus === "WARNING" ? 'red' : 'green' }}>{currentStatus}</span></h2>
      </header>

      {/* Real-Time Metrics Section */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div style={{ padding: '10px', border: '1px solid black' }}>
          <h3>Current Temp</h3>
          <p>{history.length > 0 ? history[history.length - 1].temperature : 0} °C</p>
        </div>
        <div style={{ padding: '10px', border: '1px solid black' }}>
          <h3>Vibration</h3>
          <p>{history.length > 0 ? history[history.length - 1].vibration : 0} G</p>
        </div>
        <div style={{ padding: '10px', border: '1px solid black' }}>
          <h3>Motor Load (Current)</h3>
          <p>{history.length > 0 ? history[history.length - 1].current : 0} A</p>
        </div>
      </div>

      {/* Graph Section */}
      <div style={{ height: '300px', border: '1px solid black', padding: '10px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="temperature" stroke="red" isAnimationActive={false} />
            <Line type="monotone" dataKey="vibration" stroke="blue" isAnimationActive={false} />
            <Line type="monotone" dataKey="current" stroke="green" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}