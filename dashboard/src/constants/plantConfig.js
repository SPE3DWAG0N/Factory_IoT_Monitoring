// Plant Configuration & Machine Specifications
// AWS ap-south-1 (Mumbai) & Ethereum Sepolia Testnet

export const PLANT_CONFIG = {
  region: 'ap-south-1',
  regionName: 'AWS Mumbai',
  prefix: 'plant-',
  sepoliaChainId: 11155111,
  contractAddress: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
  alchemyRpc: 'https://eth-sepolia.g.alchemy.com/v2/demo-key',
  s3Bucket: 'plant-reports-849204918231',
  dynamoDbReadings: 'plant-readings',
  dynamoDbFaults: 'plant-faults',
  dynamoDbReports: 'plant-reports',
  snsTopicArn: 'arn:aws:sns:ap-south-1:849204918231:plant-fault-alerts',
  refreshInterval: 5000, // 5 seconds as specified in plan
  limits: {
    temperature: 90, // °C
    vibration: 7.0, // mm/s
    current: 12.0,   // A
  }
};

export const MACHINES = {
  'MACHINE-A': {
    id: 'MACHINE-A',
    name: 'Machine A: Motor-Pump Set',
    code: 'MPS-101',
    description: 'High-pressure chemical feed pump driven by 3-phase induction motor',
    nominalRpm: 1450,
    sensors: [
      {
        deviceId: 'A1-MOTOR-TEMP',
        name: 'Motor Winding Temp',
        part: 'motor_winding',
        sensorType: 'temperature',
        unit: '°C',
        baselineMin: 58.0,
        baselineMax: 74.0,
        limit: 90.0,
        description: 'Stator coil temperature sensor (PT100 RTD)',
        topic: 'plant/MACHINE-A/A1-MOTOR-TEMP/telemetry'
      },
      {
        deviceId: 'A2-MOTOR-CURR',
        name: 'Motor Supply Current',
        part: 'motor_supply',
        sensorType: 'current',
        unit: 'A',
        baselineMin: 7.2,
        baselineMax: 9.8,
        limit: 12.0,
        description: 'Phase current CT sensor',
        topic: 'plant/MACHINE-A/A2-MOTOR-CURR/telemetry'
      },
      {
        deviceId: 'A3-MOTOR-VIB',
        name: 'Drive-End Bearing Vibration',
        part: 'motor_bearing_de',
        sensorType: 'vibration',
        unit: 'mm/s',
        baselineMin: 2.1,
        baselineMax: 4.2,
        limit: 7.0,
        description: 'Triaxial piezoceramic accelerometer',
        topic: 'plant/MACHINE-A/A3-MOTOR-VIB/telemetry'
      },
      {
        deviceId: 'A4-PUMP-VIB',
        name: 'Pump Bearing Vibration',
        part: 'pump_casing_bearing',
        sensorType: 'vibration',
        unit: 'mm/s',
        baselineMin: 2.2,
        baselineMax: 4.4,
        limit: 7.0,
        description: 'Impeller housing vibration transducer',
        topic: 'plant/MACHINE-A/A4-PUMP-VIB/telemetry'
      }
    ]
  },
  'MACHINE-B': {
    id: 'MACHINE-B',
    name: 'Machine B: Conveyor Drive',
    code: 'CNV-204',
    description: 'Heavy payload bulk material transport belt conveyor with helical gearbox',
    nominalRpm: 920,
    sensors: [
      {
        deviceId: 'B1-MOTOR-TEMP',
        name: 'Conveyor Motor Casing Temp',
        part: 'conveyor_motor_casing',
        sensorType: 'temperature',
        unit: '°C',
        baselineMin: 56.0,
        baselineMax: 73.0,
        limit: 90.0,
        description: 'Surface thermistor on drive motor housing',
        topic: 'plant/MACHINE-B/B1-MOTOR-TEMP/telemetry'
      },
      {
        deviceId: 'B2-MOTOR-CURR',
        name: 'Conveyor Supply Current',
        part: 'conveyor_motor_supply',
        sensorType: 'current',
        unit: 'A',
        baselineMin: 7.5,
        baselineMax: 9.9,
        limit: 12.0,
        description: 'Variable frequency drive load monitor',
        topic: 'plant/MACHINE-B/B2-MOTOR-CURR/telemetry'
      },
      {
        deviceId: 'B3-GBOX-VIB',
        name: 'Gearbox Housing Vibration',
        part: 'gearbox_casing',
        sensorType: 'vibration',
        unit: 'mm/s',
        baselineMin: 2.3,
        baselineMax: 4.5,
        limit: 7.0,
        description: 'Industrial seismic velocity sensor',
        topic: 'plant/MACHINE-B/B3-GBOX-VIB/telemetry'
      },
      {
        deviceId: 'B4-GBOX-TEMP',
        name: 'Gearbox Oil Temperature',
        part: 'gearbox_oil_sump',
        sensorType: 'temperature',
        unit: '°C',
        baselineMin: 59.0,
        baselineMax: 75.0,
        limit: 90.0,
        description: 'Submerged oil reservoir thermocouple',
        topic: 'plant/MACHINE-B/B4-GBOX-TEMP/telemetry'
      }
    ]
  }
};

export const ALL_SENSORS = [
  ...MACHINES['MACHINE-A'].sensors.map(s => ({ ...s, machineId: 'MACHINE-A' })),
  ...MACHINES['MACHINE-B'].sensors.map(s => ({ ...s, machineId: 'MACHINE-B' }))
];
