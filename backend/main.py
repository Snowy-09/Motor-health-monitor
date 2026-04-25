from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import serial
import json
import threading
import time

app = FastAPI()

# --- 1. ENABLE CORS (Required for Vercel to talk to your laptop) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. ARDUINO CONFIGURATION ---
# IMPORTANT: Change 'COM3' to the port shown in your Arduino IDE!
SERIAL_PORT = 'COM3' 
BAUD_RATE = 9600

# This dictionary holds the current "Live" state of your motor
latest_hardware_data = {
    "temp": 0.0,
    "vibration": 0,
    "current": 0.0,
    "state": "INITIALIZING",
    "ml_status": "NORMAL",
    "future_temp": 0.0,
    "ai_log": "⏳ Connecting to Hardware...",
    "time": 0
}

# --- 3. THE SERIAL BRIDGE THREAD ---
def read_serial_data():
    global latest_hardware_data
    print(f"📡 Attempting to connect to Arduino on {SERIAL_PORT}...")
    
    try:
        # Open the USB connection
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2) # Wait for Arduino to reboot
        print(f"✅ CONNECTION ESTABLISHED on {SERIAL_PORT}")
        
        while True:
            if ser.in_waiting > 0:
                try:
                    # Read the JSON line from Arduino
                    raw_line = ser.readline().decode('utf-8').strip()
                    
                    # Only process if it looks like JSON
                    if raw_line.startswith('{'):
                        data = json.loads(raw_line)
                        
                        # Update our global state with the real data
                        latest_hardware_data["temp"] = data.get("temp", 0)
                        latest_hardware_data["vibration"] = data.get("vibration", 0)
                        latest_hardware_data["current"] = data.get("current", 0)
                        latest_hardware_data["time"] += 1
                        
                        # --- AI / PREDICTIVE LOGIC ---
                        # We calculate the "Future" temp based on current heating
                        latest_hardware_data["future_temp"] = data.get("temp", 0) + 1.2
                        
                        # Set thresholds to match your teammate's Arduino logic (50°C)
                        if latest_hardware_data["temp"] > 50.0:
                            latest_hardware_data["ml_status"] = "WARNING"
                            latest_hardware_data["state"] = "CRITICAL"
                            latest_hardware_data["ai_log"] = "🚨 HEAT THRESHOLD BREACHED!"
                        elif latest_hardware_data["current"] > 1.5:
                            latest_hardware_data["state"] = "HEAVY"
                            latest_hardware_data["ai_log"] = "⚡ High Torque Detected"
                        else:
                            latest_hardware_data["ml_status"] = "NORMAL"
                            latest_hardware_data["state"] = "RUNNING"
                            latest_hardware_data["ai_log"] = "✅ System Nominal"

                except json.JSONDecodeError:
                    # Skip partial/garbage lines
                    continue
                except Exception as e:
                    print(f"⚠️ Data Parsing Error: {e}")
                    
    except Exception as e:
        print(f"❌ SERIAL ERROR: {e}")
        latest_hardware_data["ai_log"] = "❌ DISCONNECTED"

# Start the Arduino reader in a background thread so it doesn't block the API
threading.Thread(target=read_serial_data, daemon=True).start()

# --- 4. API ENDPOINTS ---

@app.get("/api/motor")
async def get_motor_data():
    """The React dashboard calls this every second"""
    return latest_hardware_data

@app.post("/api/subscribe")
async def subscribe_notifications(request: Request):
    """Handles the push notification setup from the browser"""
    data = await request.json()
    print("🔔 New Notification Subscription Received")
    # For a hackathon, we just confirm receipt. 
    # Real logic would save this 'data' to a database to send alerts later.
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)