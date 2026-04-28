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

// Previous values for vibration
int prevX = 0, prevY = 0, prevZ = 0;

// ----- Current Sensor -----
float offsetVoltage = 2.5;   // will be calibrated
float sensitivity = 0.185;   // ACS712-5A

// ----- Thresholds -----
float CURRENT_THRESHOLD = 4.0;
float TEMP_THRESHOLD = 50.0;
int VIB_THRESHOLD = 10000;

void calibrateCurrentSensor() {
  long sum = 0;

  Serial.println("Calibrating current sensor...");
  delay(1000);

  for (int i = 0; i < 200; i++) {
    sum += analogRead(CURRENT_PIN);
    delay(5);
  }

  float avg = sum / 200.0;
  offsetVoltage = avg * (5.0 / 1023.0);

  Serial.print("Offset Voltage: ");
  Serial.println(offsetVoltage);
}

void setup() {
  Serial.begin(9600);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  sensors.begin();

  // ----- MPU6050 INIT -----
  Wire.begin();

  Wire.beginTransmission(MPU_addr);
  Wire.write(0x6B);
  Wire.write(0x00);
  Wire.endTransmission(true);

  Wire.beginTransmission(MPU_addr);
  Wire.write(0x1C);
  Wire.write(0x00);
  Wire.endTransmission(true);

  // ----- CURRENT CALIBRATION -----
  calibrateCurrentSensor();

  Serial.println("SYSTEM STARTED");
}

void loop() {

  // ----- CURRENT (smoothed) -----
  float totalVoltage = 0;

  for (int i = 0; i < 10; i++) {
    int raw = analogRead(CURRENT_PIN);
    totalVoltage += raw * (5.0 / 1023.0);
    delay(2);
  }

  float voltage = totalVoltage / 10.0;

  float current = (voltage - offsetVoltage) / sensitivity;

  // remove noise
  if (abs(current) < 0.05) current = 0;

  // ----- TEMPERATURE -----
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);

  // ----- VIBRATION -----
  Wire.beginTransmission(MPU_addr);
  Wire.write(0x3B);
  Wire.endTransmission(false);

  if (Wire.requestFrom(MPU_addr, 6, true) == 6) {
    AcX = Wire.read() << 8 | Wire.read();
    AcY = Wire.read() << 8 | Wire.read();
    AcZ = Wire.read() << 8 | Wire.read();
  }

  int vibration = abs(AcX - prevX) + abs(AcY - prevY) + abs(AcZ - prevZ);

  prevX = AcX;
  prevY = AcY;
  prevZ = AcZ;

  // ----- JSON OUTPUT -----
  Serial.print("{\"temp\": ");
  Serial.print(tempC);
  Serial.print(", \"vibration\": ");
  Serial.print(vibration);
  Serial.print(", \"current\": ");
  Serial.print(current);
  Serial.println("}");

  // ----- CONTROL LOGIC -----
  if (current > CURRENT_THRESHOLD || tempC > TEMP_THRESHOLD || vibration > VIB_THRESHOLD) {
    digitalWrite(RELAY_PIN, HIGH); // OFF
  } else {
    digitalWrite(RELAY_PIN, LOW);  // ON
  }

  delay(500);
}