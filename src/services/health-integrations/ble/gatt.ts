/* Copied verbatim from the CosmicPulse mobile app (src/services/health-integrations/ble/gatt.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
/**
 * Bluetooth SIG GATT profile parsers — pure, dependency-free, unit-tested.
 *
 * Only standard, published profiles are supported, so any certified device
 * implementing them works without vendor SDKs:
 *   Heart Rate (0x180D / 0x2A37)
 *   Blood Pressure (0x1810 / 0x2A35)
 *   Pulse Oximeter (0x1822 / 0x2A5E spot-check, 0x2A5F continuous)
 *   Health Thermometer (0x1809 / 0x2A1C)
 *   Weight Scale (0x181D / 0x2A9D)
 * Proprietary devices (most consumer watches) are not readable over BLE.
 */

export const uuid16 = (short: string) => `0000${short.toLowerCase()}-0000-1000-8000-00805f9b34fb`;

export const SERVICES = {
  heartRate: uuid16('180d'),
  bloodPressure: uuid16('1810'),
  pulseOximeter: uuid16('1822'),
  thermometer: uuid16('1809'),
  weightScale: uuid16('181d'),
} as const;

export const CHARACTERISTICS = {
  heartRateMeasurement: uuid16('2a37'),
  bloodPressureMeasurement: uuid16('2a35'),
  plxSpotCheck: uuid16('2a5e'),
  plxContinuous: uuid16('2a5f'),
  temperatureMeasurement: uuid16('2a1c'),
  weightMeasurement: uuid16('2a9d'),
} as const;

export type ServiceKey = keyof typeof SERVICES;

export const SERVICE_LABEL: Record<ServiceKey, string> = {
  heartRate: 'Heart-rate monitor',
  bloodPressure: 'Blood-pressure monitor',
  pulseOximeter: 'Pulse oximeter',
  thermometer: 'Thermometer',
  weightScale: 'Weight scale',
};

/** Characteristic to subscribe to for each service (notify or indicate). */
export const SERVICE_CHARACTERISTICS: Record<ServiceKey, string[]> = {
  heartRate: [CHARACTERISTICS.heartRateMeasurement],
  bloodPressure: [CHARACTERISTICS.bloodPressureMeasurement],
  pulseOximeter: [CHARACTERISTICS.plxSpotCheck, CHARACTERISTICS.plxContinuous],
  thermometer: [CHARACTERISTICS.temperatureMeasurement],
  weightScale: [CHARACTERISTICS.weightMeasurement],
};

export function serviceKeyFor(serviceUuid: string): ServiceKey | undefined {
  const u = serviceUuid.toLowerCase();
  const full = u.length === 4 ? uuid16(u) : u;
  return (Object.keys(SERVICES) as ServiceKey[]).find((k) => SERVICES[k] === full);
}

/* ------------------------------- primitives ------------------------------- */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 → bytes (ble-plx delivers characteristic values as base64). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (i + k < clean.length ? B64.indexOf(clean[i + k]) : -1));
    out.push((n[0] << 2) | (n[1] >> 4));
    if (n[2] >= 0) out.push(((n[1] & 15) << 4) | (n[2] >> 2));
    if (n[3] >= 0) out.push(((n[2] & 3) << 6) | n[3]);
  }
  return Uint8Array.from(out);
}

class Reader {
  constructor(
    private b: Uint8Array,
    public o = 0,
  ) {}
  has(n: number) {
    return this.o + n <= this.b.length;
  }
  u8() {
    if (!this.has(1)) throw new RangeError('truncated');
    return this.b[this.o++];
  }
  u16() {
    if (!this.has(2)) throw new RangeError('truncated');
    const v = this.b[this.o] | (this.b[this.o + 1] << 8);
    this.o += 2;
    return v;
  }
  u24() {
    return this.u16() | (this.u8() << 16);
  }
  /** IEEE-11073 16-bit SFLOAT. NaN for the reserved special values. */
  sfloat() {
    const raw = this.u16();
    if (raw === 0x07ff || raw === 0x0800 || raw === 0x07fe || raw === 0x0802 || raw === 0x0801) return NaN;
    let mantissa = raw & 0x0fff;
    if (mantissa >= 0x0800) mantissa -= 0x1000;
    let exp = raw >> 12;
    if (exp >= 0x8) exp -= 0x10;
    return mantissa * 10 ** exp;
  }
  /** IEEE-11073 32-bit FLOAT. */
  float() {
    const raw = (this.u16() | (this.u16() << 16)) >>> 0;
    const m = raw & 0x00ffffff;
    if (m === 0x007fffff || m === 0x00800000 || m === 0x007ffffe || m === 0x00800002 || m === 0x00800001) return NaN;
    const mantissa = m >= 0x00800000 ? m - 0x01000000 : m;
    let exp = raw >>> 24;
    if (exp >= 0x80) exp -= 0x100;
    return mantissa * 10 ** exp;
  }
  /** GATT Date Time (0x2A08), interpreted as device-local time. Undefined if the device clock is unset. */
  dateTime(): Date | undefined {
    const year = this.u16();
    const month = this.u8();
    const day = this.u8();
    const h = this.u8();
    const mi = this.u8();
    const s = this.u8();
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day, h, mi, s);
  }
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

/* --------------------------------- parsers -------------------------------- */

export type GattReading =
  | { type: 'heart_rate'; value: number; unit: 'bpm'; sensorContact?: boolean; rrMs?: number[]; at?: Date }
  | { type: 'blood_pressure'; value: number; value2: number; unit: 'mmHg' | 'kPa'; pulse?: number; at?: Date }
  | { type: 'spo2'; value: number; unit: '%'; pulse?: number; at?: Date }
  | { type: 'temperature'; value: number; unit: 'degC' | 'degF'; at?: Date }
  | { type: 'weight'; value: number; unit: 'kg' | 'lb'; at?: Date };

/** Heart Rate Measurement (0x2A37). */
export function parseHeartRate(bytes: Uint8Array): GattReading {
  const r = new Reader(bytes);
  const flags = r.u8();
  const value = flags & 0x01 ? r.u16() : r.u8();
  const contactSupported = (flags & 0x04) !== 0;
  const sensorContact = contactSupported ? (flags & 0x02) !== 0 : undefined;
  if (flags & 0x08) r.u16(); // energy expended
  const rrMs: number[] = [];
  if (flags & 0x10) while (r.has(2)) rrMs.push(round((r.u16() / 1024) * 1000, 0));
  return { type: 'heart_rate', value, unit: 'bpm', sensorContact, ...(rrMs.length ? { rrMs } : {}) };
}

/** Blood Pressure Measurement (0x2A35). */
export function parseBloodPressure(bytes: Uint8Array): GattReading {
  const r = new Reader(bytes);
  const flags = r.u8();
  const unit = flags & 0x01 ? 'kPa' : 'mmHg';
  const sys = r.sfloat();
  const dia = r.sfloat();
  r.sfloat(); // mean arterial pressure
  const at = flags & 0x02 ? r.dateTime() : undefined;
  const pulse = flags & 0x04 ? r.sfloat() : undefined;
  return { type: 'blood_pressure', value: sys, value2: dia, unit, ...(pulse !== undefined && Number.isFinite(pulse) ? { pulse } : {}), ...(at ? { at } : {}) };
}

/** PLX Spot-check Measurement (0x2A5E). */
export function parsePlxSpotCheck(bytes: Uint8Array): GattReading {
  const r = new Reader(bytes);
  const flags = r.u8();
  const spo2 = r.sfloat();
  const pulse = r.sfloat();
  const at = flags & 0x01 ? r.dateTime() : undefined;
  return { type: 'spo2', value: spo2, unit: '%', ...(Number.isFinite(pulse) ? { pulse } : {}), ...(at && !(flags & 0x10) ? { at } : {}) };
}

/** PLX Continuous Measurement (0x2A5F) — uses the SpO2PR-Normal fields. */
export function parsePlxContinuous(bytes: Uint8Array): GattReading {
  const r = new Reader(bytes);
  r.u8(); // flags (optional fast/slow fields follow the normal pair and are ignored)
  const spo2 = r.sfloat();
  const pulse = r.sfloat();
  return { type: 'spo2', value: spo2, unit: '%', ...(Number.isFinite(pulse) ? { pulse } : {}) };
}

/** Temperature Measurement (0x2A1C). */
export function parseTemperature(bytes: Uint8Array): GattReading {
  const r = new Reader(bytes);
  const flags = r.u8();
  const value = r.float();
  const at = flags & 0x02 ? r.dateTime() : undefined;
  return { type: 'temperature', value: round(value, 2), unit: flags & 0x01 ? 'degF' : 'degC', ...(at ? { at } : {}) };
}

/** Weight Measurement (0x2A9D). */
export function parseWeight(bytes: Uint8Array): GattReading {
  const r = new Reader(bytes);
  const flags = r.u8();
  const imperial = (flags & 0x01) !== 0;
  const raw = r.u16();
  const at = flags & 0x02 ? r.dateTime() : undefined;
  return { type: 'weight', value: round(imperial ? raw * 0.01 : raw * 0.005, 3), unit: imperial ? 'lb' : 'kg', ...(at ? { at } : {}) };
}

/** Dispatch by characteristic UUID; null for unsupported characteristics or malformed packets. */
export function parseCharacteristic(characteristicUuid: string, bytes: Uint8Array): GattReading | null {
  try {
    switch (characteristicUuid.toLowerCase()) {
      case CHARACTERISTICS.heartRateMeasurement:
        return parseHeartRate(bytes);
      case CHARACTERISTICS.bloodPressureMeasurement:
        return parseBloodPressure(bytes);
      case CHARACTERISTICS.plxSpotCheck:
        return parsePlxSpotCheck(bytes);
      case CHARACTERISTICS.plxContinuous:
        return parsePlxContinuous(bytes);
      case CHARACTERISTICS.temperatureMeasurement:
        return parseTemperature(bytes);
      case CHARACTERISTICS.weightMeasurement:
        return parseWeight(bytes);
      default:
        return null;
    }
  } catch {
    return null;
  }
}
