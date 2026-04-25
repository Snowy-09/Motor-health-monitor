import serial
import json
import threading

# --- ARDUINO CONFIG ---
# Replace 'COM3' with the port you saw in the Arduino IDE!
ARDUINO_PORT = 'COM3' 
BAUD_RATE = 9600

latest_hardware_data = {
    "temp": 0, "vibration": 0, "current": 0, 
    "ml_status": "NORMAL", "future_temp": 0, "time": 0
}

def serial_reader():
    global latest_hardware_data
    try:
        # Open the connection to the Arduino
        ser = serial.Serial(ARDUINO_PORT, BAUD_RATE, timeout=1)
        print(f"✅ Successfully connected to Arduino on {ARDUINO_PORT}")
        
        while True:
            if ser.in_waiting > 0:
                # Read the line from Arduino
                line = ser.readline().decode('utf-8').strip()
                try:
                    # Parse the JSON string
                    data = json.loads(line)
                    
                    # Update our global storage
                    latest_hardware_data["temp"] = data["temp"]
                    latest_hardware_data["vibration"] = data["vibration"]
                    latest_hardware_data["current"] = data["current"]
                    latest_hardware_data["time"] += 1
                    
                    # Basic Prediction Logic
                    latest_hardware_data["future_temp"] = data["temp"] + 1.5 
                    if data["temp"] > 50: # Matching your teammate's threshold
                         latest_hardware_data["ml_status"] = "WARNING"
                    else:
                         latest_hardware_data["ml_status"] = "NORMAL"

                except:
                    pass # Ignore messy data
    except Exception as e:
        print(f"❌ Serial Error: {e}")

# Start the background thread
threading.Thread(target=serial_reader, daemon=True).start()