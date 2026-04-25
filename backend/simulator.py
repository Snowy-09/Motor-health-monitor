import random

def generate_demo_data(elapsed_time):
    """
    Creates a 120-second looping storyline to test the ML models.
    Returns: (temperature, vibration, current)
    """
    cycle_time = int(elapsed_time) % 120 

    if cycle_time < 40:
        # PHASE 1: Normal Operation (Idling)
        temp = 45.0 + random.uniform(-0.5, 0.5)
        vib = 0.5 + random.uniform(-0.1, 0.1)
        curr = 3.2 + random.uniform(-0.2, 0.2)
        
    elif cycle_time < 50:
        # PHASE 2: Sudden Vibration Anomaly (Testing Z-Score)
        temp = 47.0 + random.uniform(-0.5, 0.5)
        vib = 2.8 + random.uniform(-0.4, 0.4) # Spikes from 0.5 to 2.8!
        curr = 3.5 + random.uniform(-0.2, 0.2)
        
    elif cycle_time < 100:
        # PHASE 3: Gradual Overheating (Testing Polynomial Forecast)
        # Temp curves upward exponentially over 50 seconds
        progress = (cycle_time - 50) / 50.0 
        temp = 47.0 + (35.0 * (progress ** 2)) + random.uniform(-0.5, 0.5)
        vib = 0.7 + random.uniform(-0.1, 0.1)
        curr = 4.5 + random.uniform(-0.2, 0.2)
        
    else:
        # PHASE 4: Cooldown / System Reset
        progress = (cycle_time - 100) / 20.0
        temp = 82.0 - (37.0 * progress) + random.uniform(-0.5, 0.5)
        vib = 0.5 + random.uniform(-0.1, 0.1)
        curr = 1.0 + random.uniform(-0.1, 0.1)

    return temp, vib, curr