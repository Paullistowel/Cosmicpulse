import { create } from 'zustand';

import type { Measurement, VitalType } from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import { CHARACTERISTICS, SERVICES, parseCharacteristic, type GattReading } from '@/services/health-integrations/ble/gatt';
import { useHealth } from '@/store/health';

/**
 * Web Bluetooth — a genuinely browser-supported device integration.
 *
 * Works in Chromium browsers (Chrome, Edge, Opera; desktop and Android) over
 * HTTPS or localhost, with standard Bluetooth SIG GATT medical profiles:
 * Heart Rate (0x180D), Blood Pressure (0x1810), Pulse Oximeter (0x1822),
 * Health Thermometer (0x1809) and Weight Scale (0x181D). Safari and Firefox
 * do not implement Web Bluetooth; the UI says so. Parsing reuses the mobile
 * app's GATT parsers. Apple Watch does NOT expose these profiles to browsers.
 */

/* Minimal Web Bluetooth typings (not in lib.dom). */
type BTChar = EventTarget & { value?: DataView; uuid: string; startNotifications(): Promise<BTChar>; stopNotifications(): Promise<BTChar> };
type BTService = { uuid: string; getCharacteristic(uuid: string): Promise<BTChar> };
type BTServer = { connected: boolean; getPrimaryServices(): Promise<BTService[]>; disconnect(): void };
type BTDevice = EventTarget & { id: string; name?: string; gatt?: { connect(): Promise<BTServer> } };
type BT = { requestDevice(o: unknown): Promise<BTDevice>; getAvailability?(): Promise<boolean> };

export const webBluetoothSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator && typeof window !== 'undefined' && window.isSecureContext;

type BleState = {
  status: 'idle' | 'requesting' | 'connected' | 'disconnected' | 'error';
  deviceName?: string;
  deviceId?: string;
  services: string[];
  live?: { type: VitalType; text: string; at: number };
  recorded: number;
  error?: string;
};

export const useBle = create<BleState>()(() => ({ status: 'idle', services: [], recorded: 0 }));

let server: BTServer | null = null;
let lastHrSavedAt = 0;
const hrWindow: number[] = [];

const SERVICE_NAMES: Record<string, string> = {
  [SERVICES.heartRate]: 'Heart rate',
  [SERVICES.bloodPressure]: 'Blood pressure',
  [SERVICES.pulseOximeter]: 'Pulse oximeter',
  [SERVICES.thermometer]: 'Thermometer',
  [SERVICES.weightScale]: 'Weight scale',
};

const CHARS_FOR: Record<string, string[]> = {
  [SERVICES.heartRate]: [CHARACTERISTICS.heartRateMeasurement],
  [SERVICES.bloodPressure]: [CHARACTERISTICS.bloodPressureMeasurement],
  [SERVICES.pulseOximeter]: [CHARACTERISTICS.plxSpotCheck, CHARACTERISTICS.plxContinuous],
  [SERVICES.thermometer]: [CHARACTERISTICS.temperatureMeasurement],
  [SERVICES.weightScale]: [CHARACTERISTICS.weightMeasurement],
};

/** Canonical units (mmHg, °C, kg) — values keep `original` when converted. */
export function toMeasurement(r: GattReading, device: { id: string; name: string }, at = new Date()): Omit<Measurement, 'id'> {
  let value = r.value;
  let value2 = r.type === 'blood_pressure' ? r.value2 : undefined;
  const original = { value: r.value, value2, unit: r.unit };
  if (r.type === 'blood_pressure' && r.unit === 'kPa') {
    value = Math.round(r.value * 7.50062);
    value2 = Math.round(r.value2 * 7.50062);
  }
  if (r.type === 'temperature' && r.unit === 'degF') value = Math.round((((r.value - 32) * 5) / 9) * 10) / 10;
  if (r.type === 'weight' && r.unit === 'lb') value = Math.round((r.value / 2.20462) * 10) / 10;
  return {
    type: r.type,
    value,
    value2,
    unit: VITAL_META[r.type].unit,
    takenAt: (r.at ?? at).toISOString(),
    source: { kind: 'live', deviceId: device.id, deviceName: device.name },
    provider: 'ble',
    syncedAt: at.toISOString(),
    original,
    context: r.type === 'heart_rate' ? 'unspecified' : undefined,
  };
}

function onReading(r: GattReading, device: { id: string; name: string }) {
  const now = Date.now();
  const text = r.type === 'blood_pressure' ? `${Math.round(r.value)}/${Math.round(r.value2)} ${r.unit}` : `${r.value} ${r.unit}`;
  useBle.setState({ live: { type: r.type, text, at: now } });
  if (r.type === 'heart_rate') {
    if (r.sensorContact === false) return;
    hrWindow.push(r.value);
    // Heart-rate straps notify every second: store one averaged reading per minute.
    if (now - lastHrSavedAt < 60_000) return;
    const mean = Math.round(hrWindow.reduce((a, b) => a + b, 0) / hrWindow.length);
    hrWindow.length = 0;
    lastHrSavedAt = now;
    useHealth.getState().addMeasurement({ ...toMeasurement({ ...r, value: mean }, device), note: 'Mean of 1 minute of live Bluetooth samples' });
  } else {
    useHealth.getState().addMeasurement(toMeasurement(r, device));
  }
  useBle.setState((s) => ({ recorded: s.recorded + 1 }));
}

export async function connectBluetooth(): Promise<void> {
  if (!webBluetoothSupported()) throw new Error('Web Bluetooth is not available in this browser. Use Chrome or Edge on desktop or Android.');
  const bt = (navigator as unknown as { bluetooth: BT }).bluetooth;
  useBle.setState({ status: 'requesting', error: undefined });
  try {
    const all = Object.values(SERVICES);
    const device = await bt.requestDevice({ filters: all.map((s) => ({ services: [s] })), optionalServices: all });
    const name = device.name || 'Bluetooth sensor';
    device.addEventListener('gattserverdisconnected', () => useBle.setState({ status: 'disconnected' }));
    server = (await device.gatt?.connect()) ?? null;
    if (!server) throw new Error('Could not connect to the device.');
    const services = await server.getPrimaryServices();
    const names: string[] = [];
    for (const svc of services) {
      const chars = CHARS_FOR[svc.uuid];
      if (!chars) continue;
      names.push(SERVICE_NAMES[svc.uuid]);
      for (const cu of chars) {
        try {
          const ch = await svc.getCharacteristic(cu);
          ch.addEventListener('characteristicvaluechanged', () => {
            if (!ch.value) return;
            const bytes = new Uint8Array(ch.value.buffer.slice(ch.value.byteOffset, ch.value.byteOffset + ch.value.byteLength));
            const parsed = parseCharacteristic(cu, bytes);
            if (parsed) onReading(parsed, { id: `ble-${device.id}`, name });
          });
          await ch.startNotifications();
        } catch {
          /* characteristic optional on this device */
        }
      }
    }
    if (!names.length) throw new Error('This device does not expose a supported medical profile.');
    useBle.setState({ status: 'connected', deviceName: name, deviceId: device.id, services: names });
  } catch (e) {
    const msg = (e as Error).name === 'NotFoundError' ? 'No device selected.' : (e as Error).message;
    useBle.setState({ status: 'error', error: msg });
    throw new Error(msg);
  }
}

export function disconnectBluetooth() {
  server?.disconnect();
  server = null;
  useBle.setState({ status: 'disconnected', live: undefined });
}
