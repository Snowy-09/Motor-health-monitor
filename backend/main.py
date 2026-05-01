from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sklearn.ensemble import RandomForestClassifier
import serial
import json
import threading
import time
import random
import serial.tools.list_ports

app = FastAPI()

# --- 1. ENABLE CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

latest_hardware_data = {
    "temp": 0.0,
    "vibration": 0,
    "current": 0.0,
    "state": "INITIALIZING",
    "ml_status": "NORMAL",
    "future_temp": 0.0,
    "ai_log": "⏳ Connecting to Hardware...",
    "volatility": 0.0,
    "time": 0
}

# ==========================================
# 🧠 MACHINE LEARNING PIPELINE (TRAINING)
# ==========================================
print("🧠 Booting AI Engine...")

X_train = []
y_train = []

# Generate "Normal" examples
for _ in range(500):
    temp = random.uniform(30.0, 45.0)
    vibe = random.uniform(1000, 5000)
    pitch = random.uniform(100, 300) 
    X_train.append([temp, vibe, pitch])
    y_train.append(0)

# Generate "Broken" examples
for _ in range(500):
    temp = random.uniform(48.0, 65.0)
    vibe = random.uniform(15000, 25000)
    pitch = random.uniform(3000, 5000) 
    X_train.append([temp, vibe, pitch])
    y_train.append(1)

# Train the Random Forest
ai_model = RandomForestClassifier(n_estimators=50, random_state=42)
ai_model.fit(X_train, y_train)
print("✅ Random Forest Trained & Ready!")

# ==========================================
# 🔌 ARDUINO HARDWARE BRIDGE
# ==========================================
BAUD_RATE = 9600

def find_arduino_port():
    print("🔍 Scanning USB ports for motor hardware...")
    ports = serial.tools.list_ports.comports()
    for port in ports:
        if "Arduino" in port.description or "CH340" in port.description or "USB Serial" in port.description:
            print(f"🎯 Found Hardware on {port.device}!")
            return port.device
    print("⚠️ No hardware found. Defaulting to Simulator/Offline Mode.")
    return None

SERIAL_PORT = find_arduino_port()

def read_serial_data():
    global latest_hardware_data
    
    if SERIAL_PORT is None:
        print("🔌 No Arduino found. Booting Virtual Motor Simulator...")
        # --- VIRTUAL MOTOR SIMULATOR ---
        while True:
            # 1. Simulate hardware data (10% chance to simulate a breakdown)
            is_breaking_down = random.random() > 0.9
            
            if is_breaking_down:
                temp = random.uniform(49.0, 52.0)
                vibe = random.uniform(18000, 22000)
            else:
                temp = random.uniform(35.0, 42.0)
                vibe = random.uniform(1500, 4000)
                
            latest_hardware_data["temp"] = temp
            latest_hardware_data["vibration"] = vibe
            latest_hardware_data["current"] = random.uniform(1.5, 3.0)
            latest_hardware_data["time"] += 1
            
            # 2. Simulate DSP Pitch
            simulated_pitch = vibe * 0.15 + random.uniform(0, 50)
            
            # 3. ASK THE AI!
            live_array = [[temp, vibe, simulated_pitch]]
            prediction = ai_model.predict(live_array)[0]
            
            # 4. React to the AI's decision
            if prediction == 1:
                latest_hardware_data["ml_status"] = "WARNING"
                latest_hardware_data["state"] = "CRITICAL"
                latest_hardware_data["ai_log"] = "🚨 AI: Acoustic/Vibration Anomaly Detected!"
                latest_hardware_data["volatility"] = random.uniform(75, 95)
                latest_hardware_data["future_temp"] = temp + 3.0
            else:
                latest_hardware_data["ml_status"] = "NORMAL"
                latest_hardware_data["state"] = "RUNNING"
                latest_hardware_data["ai_log"] = "✅ AI: System Nominal (Virtual)"
                latest_hardware_data["volatility"] = random.uniform(10, 25)
                latest_hardware_data["future_temp"] = temp + 0.2
                
            time.sleep(1) # Wait 1 second before sending the next virtual data point
            
        return # End of Virtual Simulator loop

    # --- REAL HARDWARE LOOP ---
    print(f"📡 Attempting to connect to Arduino on {SERIAL_PORT}...")
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2) 
        print(f"✅ CONNECTION ESTABLISHED on {SERIAL_PORT}")
        
        while True:
            if ser.in_waiting > 0:
                try:
                    raw_line = ser.readline().decode('utf-8').strip()
                    
                    if raw_line.startswith('{'):
                        data = json.loads(raw_line)
                        
                        latest_hardware_data["temp"] = data.get("temp", 0)
                        latest_hardware_data["vibration"] = data.get("vibration", 0)
                        latest_hardware_data["current"] = data.get("current", 0)
                        latest_hardware_data["time"] += 1
                        
                        simulated_pitch = latest_hardware_data["vibration"] * 0.15 + random.uniform(0, 50)
                        
                        # AI PREDICTION FOR REAL HARDWARE
                        live_array = [[latest_hardware_data["temp"], latest_hardware_data["vibration"], simulated_pitch]]
                        prediction = ai_model.predict(live_array)[0]
                        
                        if prediction == 1:
                            latest_hardware_data["ml_status"] = "WARNING"
                            latest_hardware_data["state"] = "CRITICAL"
                            latest_hardware_data["ai_log"] = "🚨 AI: Acoustic/Vibration Anomaly Detected!"
                            latest_hardware_data["volatility"] = random.uniform(75, 95)
                            latest_hardware_data["future_temp"] = latest_hardware_data["temp"] + 3.0
                        else:
                            latest_hardware_data["ml_status"] = "NORMAL"
                            latest_hardware_data["state"] = "RUNNING"
                            latest_hardware_data["ai_log"] = "✅ AI: System Nominal"
                            latest_hardware_data["volatility"] = random.uniform(10, 25)
                            latest_hardware_data["future_temp"] = latest_hardware_data["temp"] + 0.2

                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    print(f"⚠️ Data Parsing/AI Error: {e}")
                    
    except Exception as e:
        print(f"❌ SERIAL ERROR: {e}")
        latest_hardware_data["ai_log"] = "❌ HARDWARE DISCONNECTED"
        latest_hardware_data["state"] = "OFFLINE"
        latest_hardware_data["ml_status"] = "DISCONNECTED"

threading.Thread(target=read_serial_data, daemon=True).start()

# ==========================================
# 🌐 API ENDPOINTS
# ==========================================
@app.get("/api/motor")
async def get_motor_data():
    return latest_hardware_data

@app.post("/api/subscribe")
async def subscribe_notifications(request: Request):
    data = await request.json()
    print("🔔 New Notification Subscription Received")
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)