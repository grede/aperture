/**
 * iOS Simulator device representation
 */
export interface SimulatorDevice {
  /** Simulator UDID */
  udid: string;
  /** Device name (e.g., "iPhone 15 Pro") */
  name: string;
  /** iOS version (e.g., "17.2") */
  version: string;
  /** Current device state */
  state: DeviceState;
  /** Device type (e.g., "iPhone", "iPad") */
  deviceType: DeviceType;
  /** WebDriverAgent session URL (when connected) */
  wdaSessionUrl?: string;
  /** Whether the device is available for use */
  isAvailable: boolean;
}

/**
 * Device state as reported by simctl
 */
export type DeviceState =
  | 'Shutdown'
  | 'Booted'
  | 'Booting'
  | 'Shutting Down'
  | 'Creating'
  | 'Unknown';

/**
 * Device type classification
 */
export type DeviceType = 'iPhone' | 'iPad' | 'Unknown';

/**
 * Boot status with progress information
 */
export interface BootStatus {
  /** Current state */
  state: DeviceState;
  /** Is the device ready for interaction? */
  isReady: boolean;
  /** Progress message */
  message?: string;
}

/**
 * App installation information
 */
export interface AppInfo {
  /** Bundle identifier */
  bundleId: string;
  /** App name */
  name: string;
  /** Path to .app bundle */
  path: string;
  /** App version */
  version?: string;
}

/**
 * simctl device list response
 */
export interface SimctlDeviceList {
  devices: {
    [runtime: string]: SimctlDevice[];
  };
}

/**
 * Individual device from simctl list
 */
export interface SimctlDevice {
  udid: string;
  name: string;
  state: DeviceState;
  isAvailable: boolean;
  deviceTypeIdentifier?: string;
}
