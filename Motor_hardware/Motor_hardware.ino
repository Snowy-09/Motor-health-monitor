#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ----- Pins -----
#define CURRENT_PIN A0
#define TEMP_PIN 2
#define RELAY_PIN 7

// ----- Temperature Sensor -----
OneWire oneWire(TEMP_PIN);
DallasTemperature sensors(&oneWire);

// ----- MPU6050 -----
const int MPU_addr = 0x68;
int16_t AcX, AcY, AcZ;

// ----- Thresholds (adjust later) -----
float CURRENT_THRESHOLD = 2.0;   // Amps
float TEMP_THRESHOLD = 50.0;     // °C
int VIB_THRESHOLD = 20000;       // raw value

void setup() {
  Serial.begin(9600);

  // Relay setup
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // Motor ON (depends on relay logic)

  // Temp sensor
  sensors.begin();

  // MPU6050 init
  Wire.begin();
  Wire.beginTransmission(MPU_addr);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  Serial.println("System Started...");
}

void loop() {

  // ----- CURRENT -----
  int rawCurrent = analogRead(CURRENT_PIN);
  float voltage = rawCurrent * (5.0 / 1023.0);
  float current = (voltage - 2.5) / 0.185; // for ACS712-5A

  // ----- TEMPERATURE -----
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);

  // ----- VIBRATION (MPU6050) -----
  Wire.beginTransmission(MPU_addr);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_addr, 6, true);

  AcX = Wire.read() << 8 | Wire.read();
  AcY = Wire.read() << 8 | Wire.read();
  AcZ = Wire.read() << 8 | Wire.read();

  int vibration = abs(AcX) + abs(AcY) + abs(AcZ);

  // ----- PRINT VALUES -----
// ----- PRINT VALUES (JSON FORMAT FOR PYTHON) -----
  Serial.print("{\"temp\": ");
  Serial.print(tempC);
  Serial.print(", \"vibration\": ");
  Serial.print(vibration);
  Serial.print(", \"current\": ");
  Serial.print(current);
  Serial.println("}");

  // ----- CONTROL LOGIC -----
  if (current > CURRENT_THRESHOLD || tempC > TEMP_THRESHOLD || vibration > VIB_THRESHOLD) {
    Serial.println("⚠️ Threshold exceeded! Turning OFF motor.");
    digitalWrite(RELAY_PIN, HIGH); // OFF
  } else {
    digitalWrite(RELAY_PIN, LOW);  // ON
  }

  delay(500);
}