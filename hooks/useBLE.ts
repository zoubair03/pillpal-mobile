// ── BLE Provisioning Hook ─────────────────────────────────────────────────────
// Scans for a PillPal ESP32, connects via BLE, and sends WiFi credentials.
//
// ESP32 BLE Service/Characteristic UUIDs (must match firmware):
//   Service  : 12345678-1234-5678-1234-56789abcdef0
//   SSID     : 12345678-1234-5678-1234-56789abcdef1  (Write)
//   Password : 12345678-1234-5678-1234-56789abcdef2  (Write)
//   Status   : 12345678-1234-5678-1234-56789abcdef3  (Notify)

import { useState, useCallback, useRef } from 'react'
import { Platform, PermissionsAndroid } from 'react-native'
import { BleManager, Device, State } from 'react-native-ble-plx'
import base64 from 'base64-js'

// UUIDs ── must match your ESP32 firmware ─────────────────────────────────────
export const BLE_SERVICE_UUID   = '12345678-1234-5678-1234-56789abcdef0'
export const BLE_SSID_UUID      = '12345678-1234-5678-1234-56789abcdef1'
export const BLE_PASS_UUID      = '12345678-1234-5678-1234-56789abcdef2'
export const BLE_STATUS_UUID    = '12345678-1234-5678-1234-56789abcdef3'
export const BLE_WIFI_LIST_UUID = '12345678-1234-5678-1234-56789abcdef4'

// ESP32 advertises this local name
const DEVICE_PREFIX = 'PillPal'

type BLEStatus =
  | 'idle'
  | 'requesting_permission'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'sending'
  | 'waiting_wifi'
  | 'success'
  | 'error'

interface UseBLEReturn {
  status:         BLEStatus
  statusMessage:  string
  foundDevices:   Device[]
  selectedDevice: Device | null
  scan:           () => Promise<void>
  connect:        (device: Device) => Promise<void>
  provision:      (ssid: string, password: string) => Promise<void>
  getWifiList:    () => Promise<string[]>
  disconnect:     () => void
  reset:          () => void
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  return base64.fromByteArray(bytes)
}

function fromBase64(b64: string): string {
  const bytes = base64.toByteArray(b64)
  return new TextDecoder().decode(bytes)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function useBLE(): UseBLEReturn {
  const manager        = useRef(new BleManager()).current
  const lastDeviceIdRef = useRef<string | null>(null)
  const lastDeviceNameRef = useRef<string | null>(null)
  const [status, setStatus]               = useState<BLEStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('Ready to scan')
  const [foundDevices, setFoundDevices]   = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)

  const ensureDeviceConnected = useCallback(async (): Promise<Device | null> => {
    try {
      if (selectedDevice) {
        const connected = await selectedDevice.isConnected()
        if (connected) return selectedDevice
      }

      const targetId = selectedDevice?.id ?? lastDeviceIdRef.current
      if (!targetId) return null

      const reconnected = await manager.connectToDevice(targetId, { autoConnect: false })
      if (Platform.OS === 'android') {
        await reconnected.requestMTU(512)
      }
      await reconnected.discoverAllServicesAndCharacteristics()

      lastDeviceIdRef.current = reconnected.id
      lastDeviceNameRef.current = reconnected.name ?? reconnected.id
      setSelectedDevice(reconnected)
      setStatus('connected')
      setStatusMessage(`Reconnected to ${lastDeviceNameRef.current}`)
      return reconnected
    } catch (err: any) {
      setSelectedDevice(null)
      setStatus('error')
      setStatusMessage(`Device disconnected: ${err.message}`)
      return null
    }
  }, [manager, selectedDevice])

  // ── Android BLE permissions (Android 12+) ──────────────────────────────────
  const requestAndroidPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ])
      return Object.values(results).every(r => r === 'granted')
    }
    // Android < 12
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    )
    return result === 'granted'
  }, [])

  // ── Scan ───────────────────────────────────────────────────────────────────
  const scan = useCallback(async () => {
    setStatus('requesting_permission')
    setStatusMessage('Requesting Bluetooth permission...')
    setFoundDevices([])

    const granted = await requestAndroidPermissions()
    if (!granted) {
      setStatus('error')
      setStatusMessage('Bluetooth permission denied.')
      return
    }

    // Wait for BLE to be powered on
    const bleState = await manager.state()
    if (bleState !== State.PoweredOn) {
      setStatus('error')
      setStatusMessage('Bluetooth is off. Please enable it and try again.')
      return
    }

    setStatus('scanning')
    setStatusMessage('Scanning for PillPal devices...')
    const seen = new Set<string>()

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        setStatus('error')
        setStatusMessage(`Scan error: ${error.message}`)
        return
      }
      if (device?.name?.startsWith(DEVICE_PREFIX) && !seen.has(device.id)) {
        seen.add(device.id)
        setFoundDevices(prev => [...prev, device])
      }
    })

    // Stop scan after 10 seconds
    setTimeout(() => {
      manager.stopDeviceScan()
      setStatus(prev => (prev === 'scanning' ? 'idle' : prev))
      setStatusMessage(prev =>
        prev === 'Scanning for PillPal devices...'
          ? 'Scan complete.'
          : prev
      )
    }, 10000)
  }, [manager, requestAndroidPermissions])

  // ── Connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(async (device: Device) => {
    manager.stopDeviceScan()
    setStatus('connecting')
    setStatusMessage(`Connecting to ${device.name ?? device.id}...`)

    try {
      const connected = await device.connect({ autoConnect: false })
      
      // Request larger MTU for WiFi list transfer
      if (Platform.OS === 'android') {
        await connected.requestMTU(512)
      }
      
      await connected.discoverAllServicesAndCharacteristics()
      lastDeviceIdRef.current = connected.id
      lastDeviceNameRef.current = connected.name ?? connected.id
      setSelectedDevice(connected)
      setStatus('connected')
      setStatusMessage(`Connected to ${device.name ?? device.id}`)

      // Monitor for device disconnection and try to reconnect
      manager.onDeviceDisconnected(connected.id, async (error) => {
        console.warn('[BLE] Device disconnected:', error?.message)
        
        // Don't immediately clear state; try to reconnect silently
        try {
          await sleep(500)
          const reconnected = await manager.connectToDevice(connected.id, { autoConnect: false })
          if (Platform.OS === 'android') {
            await reconnected.requestMTU(512)
          }
          await reconnected.discoverAllServicesAndCharacteristics()
          setSelectedDevice(reconnected)
          setStatusMessage('Reconnected to device')
          console.log('[BLE] Reconnected successfully')
        } catch (reconnectErr) {
          console.warn('[BLE] Reconnection failed:', reconnectErr)
          setSelectedDevice(null)
          setStatus('idle')
          setStatusMessage('Device disconnected.')
        }
      })
    } catch (err: any) {
      setStatus('error')
      setStatusMessage(`Connection failed: ${err.message}`)
      throw err
    }
  }, [manager])

  // ── Provision ──────────────────────────────────────────────────────────────
  const provision = useCallback(async (ssid: string, password: string) => {
    let device = await ensureDeviceConnected()
    if (!device) {
      setStatus('error')
      setStatusMessage('No device connected. Reconnect and try again.')
      return
    }

    setStatus('sending')
    setStatusMessage('Sending WiFi credentials...')

    try {
      // Attempt to write credentials with multiple retries on disconnection
      let writeOk = false
      let lastWriteError: any = null

      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          await device.writeCharacteristicWithResponseForService(
            BLE_SERVICE_UUID, BLE_SSID_UUID, toBase64(ssid)
          )
          await sleep(300)
          await device.writeCharacteristicWithResponseForService(
            BLE_SERVICE_UUID, BLE_PASS_UUID, toBase64(password)
          )
          writeOk = true
          break
        } catch (err: any) {
          lastWriteError = err
          const msg = String(err?.message ?? '').toLowerCase()
          const disconnected = msg.includes('not connected') || msg.includes('disconnected')
          
          if (disconnected) {
            if (attempt < 3) {
              setStatusMessage(`Connection lost, reconnecting... (attempt ${attempt + 1}/3)`)
              await sleep(500)
              const reconnected = await ensureDeviceConnected()
              if (!reconnected) break
              device = reconnected
            }
          } else {
            // Non-connection error, don't retry
            break
          }
        }
      }

      if (!writeOk) {
        throw lastWriteError ?? new Error('Failed to send credentials.')
      }

      setStatus('waiting_wifi')
      setStatusMessage('Credentials sent! Waiting for ESP32 to connect to WiFi...')

      // Subscribe to status notifications from ESP32
      // Keep reconnecting if the device drops
      const subscribeToStatus = () => {
        device!.monitorCharacteristicForService(
          BLE_SERVICE_UUID, BLE_STATUS_UUID,
          async (error, characteristic) => {
            if (error) {
              console.warn('[BLE Monitor] Error:', error.message)
              // Try to reconnect and resubscribe
              const reconnected = await ensureDeviceConnected()
              if (reconnected) {
                subscribeToStatus()
              }
              return
            }
            
            if (!characteristic?.value) return
            const msg = fromBase64(characteristic.value)
            
            if (msg.startsWith('CONNECTED')) {
              setStatus('success')
              setStatusMessage('✅ Device connected to WiFi successfully!')
            } else if (msg.startsWith('FAILED')) {
              setStatus('error')
              setStatusMessage('❌ WiFi connection failed. Check your credentials.')
            } else if (msg === 'CREDENTIALS_RECEIVED') {
              setStatusMessage('✓ Credentials received. Connecting to WiFi...')
            } else if (msg.startsWith('CONNECTING')) {
              setStatusMessage('Connecting to WiFi...')
            } else {
              setStatusMessage(msg)
            }
          }
        )
      }

      subscribeToStatus()
    } catch (err: any) {
      setStatus('error')
      setStatusMessage(`Failed to send credentials: ${err.message}`)
    }
  }, [ensureDeviceConnected])

  // ── Get WiFi List ──────────────────────────────────────────────────────────
  const getWifiList = useCallback(async (): Promise<string[]> => {
    const device = await ensureDeviceConnected()
    if (!device) return []

    try {
      // ESP32 scan can take several seconds; poll until ready.
      for (let attempt = 0; attempt < 12; attempt++) {
        const char = await device.readCharacteristicForService(
          BLE_SERVICE_UUID, BLE_WIFI_LIST_UUID
        )
        if (!char?.value) {
          await sleep(800)
          continue
        }

        const listStr = fromBase64(char.value)
        if (listStr === 'SCANNING...') {
          await sleep(1000)
          continue
        }
        if (listStr === 'NONE') return []

        return listStr
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0)
      }

      return []
    } catch (err) {
      console.error('Failed to read wifi list:', err)
      return []
    }
  }, [ensureDeviceConnected])

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    selectedDevice?.cancelConnection()
    lastDeviceIdRef.current = null
    lastDeviceNameRef.current = null
    setSelectedDevice(null)
    setStatus('idle')
    setStatusMessage('Disconnected.')
  }, [selectedDevice])

  const reset = useCallback(() => {
    disconnect()
    setFoundDevices([])
    setStatus('idle')
    setStatusMessage('Ready to scan')
  }, [disconnect])

  return {
    status, statusMessage, foundDevices, selectedDevice,
    scan, connect, provision, getWifiList, disconnect, reset
  }
}
