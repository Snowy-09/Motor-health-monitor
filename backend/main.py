from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import time
import serial
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import Pipeline

# ---> ADD THIS LINE <---
from simulator import generate_demo_data

# --- CONFIGURATION ---
SERIAL_PORT = 'COM5'  # Update this!
BAUD_RATE = 9600
HISTORY_LIMIT = 1800

app = FastAPI()

# Allow the React app to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INITIALIZE SERIAL ---
try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
    time.sleep(2)
    print(f"✅ Connected to {SERIAL_PORT}")
except Exception as e:
    print(f"❌ Serial Error: {e}")
    ser = None

# Global Data Store
data_history = pd.DataFrame(columns=['time', 'temp', 'vib', 'current'])
start_time = time.time()

# --- ML MODELS ---
def get_dynamic_threshold(current_load):
    if current_load > 4.0: return 75.0, "HEAVY"
    elif current_load < 0.5: return 45.0, "IDLE"
    return 60.0, "NOMINAL"

def predict_future(df, feature, seconds_ahead=15):
    if len(df) < 15: return None
    model = Pipeline([
        ('poly', PolynomialFeatures(degree=2)),
        ('linear', LinearRegression())
    ])
    X = df[['time']].values
    y = df[feature].values
    model.fit(X, y)
    future_time = X[-1][0] + seconds_ahead
    return model.predict([[future_time]])[0]

def is_anomaly(val, history):
    if len(history) < 20: return False
    z = (val - np.mean(history)) / (np.std(history) + 0.1)
    return abs(z) > 3

# --- THE API BRIDGE ---
@app.get("/api/motor")
def get_motor_data():
    global data_history
    elapsed = time.time() - start_time

    # 1. Read from Simulator (Instead of Arduino)
    temp, vib, curr = generate_demo_data(elapsed)

    # 2. Update History
    new_row = pd.DataFrame({'time': [elapsed], 'temp': [temp], 'vib': [vib], 'current': [curr]})
    data_history = pd.concat([data_history, new_row], ignore_index=True).tail(HISTORY_LIMIT)

    # 3. Run ML Math
    limit, state = get_dynamic_threshold(curr)
    prediction = predict_future(data_history, 'temp')
    
    # Safe check for anomaly history
    vib_history = data_history['vib'].iloc[:-1] if not data_history.empty else []
    anomaly = is_anomaly(vib, vib_history)

    # 4. Generate the AI Console Messages
    status_color = "NORMAL"
    log_msg = "All systems nominal."

    if anomaly:
        status_color = "WARNING"
        log_msg = f"⚠️ ANOMALY: Irregular vibration pattern ({vib:.1f})"
    elif prediction and prediction > limit:
        status_color = "WARNING"
        log_msg = f"🛑 CRITICAL: Predicted overheat ({prediction:.1f}°C) in 15s!"
    elif prediction:
        log_msg = f"📈 Trend: Expected {prediction:.1f}°C soon."

    # 5. Blast it over the Wi-Fi to React!
    return {
        "time": elapsed,
        "temp": temp,
        "vibration": vib,
        "current": curr,
        "state": state,
        "target_limit": limit,
        "future_temp": round(prediction, 1) if prediction else temp,
        "ml_status": status_color,
        "ai_log": log_msg
    }