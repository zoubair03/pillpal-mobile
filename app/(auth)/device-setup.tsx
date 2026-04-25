import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Animated, Platform,
  KeyboardAvoidingView, Alert, FlatList
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useBLE } from '@/hooks/useBLE'
import { useSupabase } from '@/hooks/useSupabase'
import type { Device } from 'react-native-ble-plx'

type SetupStep = 'scan' | 'wifi' | 'wait' | 'register' | 'success'

const STEPS = [
  { id: 'scan',     label: 'Scan',   icon: 'bluetooth-outline' },
  { id: 'wifi',     label: 'WiFi',   icon: 'wifi-outline' },
  { id: 'wait',     label: 'Link',   icon: 'sync-outline' },
  { id: 'register', label: 'Ready',  icon: 'checkmark-circle-outline' },
]

export default function DeviceSetupScreen() {
  const router             = useRouter()
  const ble                = useBLE()
  const { registerDevice } = useSupabase()

  const [step,          setStep]         = useState<SetupStep>('scan')
  const [ssid,          setSsid]         = useState('')
  const [wifiPass,      setWifiPass]     = useState('')
  const [serialNumber,  setSerialNumber] = useState('')
  const [loading,       setLoading]      = useState(false)
  const [wifiNetworks,  setWifiNetworks] = useState<string[]>([])
  const [fetchingWifi,  setFetchingWifi] = useState(false)
  
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start()
  }, [step])

  // ── Auto-extract Serial Number when connected ──────────────────────────────
  useEffect(() => {
    if (ble.selectedDevice?.name?.startsWith('PillPal-SN-')) {
      const sn = ble.selectedDevice.name.replace('PillPal-', '')
      setSerialNumber(sn)
    }
  }, [ble.selectedDevice])

  // ── Fetch WiFi List ────────────────────────────────────────────────────────
  const fetchWifi = async () => {
    setFetchingWifi(true)
    const list = await ble.getWifiList()
    setWifiNetworks(list)
    setFetchingWifi(false)
  }

  useEffect(() => {
    if (step === 'wifi') {
      fetchWifi()
    }
  }, [step, ble.selectedDevice])

  // ── Logic: Step 1 → Step 2 ────────────────────────────────────────────────
  const onSelectDevice = async (device: Device) => {
    try {
      await ble.connect(device)
      setStep('wifi')
    } catch (err) {
      Alert.alert('Connection Failed', 'Could not connect to the device. Please try again.')
    }
  }

  // ── Logic: Step 2 → Step 3 ────────────────────────────────────────────────
  const onSendCredentials = async () => {
    if (!ssid.trim()) { Alert.alert('Missing SSID', 'Please select or enter your WiFi name.'); return }
    setStep('wait')
    
    try {
      await ble.provision(ssid.trim(), wifiPass)
    } catch (err: any) {
      console.error('Provision error:', err)
      // Don't immediately fail; let the status monitor handle it
    }
  }

  // ── Logic: Step 3 → Step 4 ────────────────────────────────────────────────
  useEffect(() => {
    if (step === 'wait' && ble.status === 'success') {
      setTimeout(() => setStep('register'), 1000)
    }
  }, [ble.status, step])

  // ── Logic: Final Registration ──────────────────────────────────────────────
  const onFinalRegister = async () => {
    if (!serialNumber) { Alert.alert('Missing Serial', 'Device serial number not found.'); return }
    setLoading(true)
    const { error } = await registerDevice(serialNumber)
    setLoading(false)
    if (error) {
      const msg = typeof error === 'string' ? error : error.message
      Alert.alert('Registration Error', msg)
    } else {
      setStep('success')
    }
  }

  // ── Sub-component: Step Indicator ──────────────────────────────────────────
  const StepIndicator = () => (
    <View style={styles.stepsRow}>
      {STEPS.map((s, i) => {
        const isActive = s.id === step || (step === 'success' && s.id === 'register')
        const isDone   = (step === 'wifi' && i < 1) || 
                         (step === 'wait' && i < 2) || 
                         (step === 'register' && i < 3) ||
                         (step === 'success')
        
        return (
          <View key={s.id} style={styles.stepItem}>
            <View style={[
              styles.stepCircle,
              isActive && styles.stepCircleActive,
              isDone && styles.stepCircleDone
            ]}>
              <Ionicons 
                name={isDone ? 'checkmark' : s.icon as any} 
                size={16} 
                color={isActive || isDone ? '#fff' : '#64748b'} 
              />
            </View>
            <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{s.label}</Text>
            {i < STEPS.length - 1 && <View style={styles.stepLine} />}
          </View>
        )
      })}
    </View>
  )

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => {
              if (router.canGoBack()) {
                router.back()
              } else {
                router.replace('/(auth)/login')
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#94a3b8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Device Setup</Text>
          <View style={{ width: 24 }} />
        </View>

        <StepIndicator />

        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          {/* ── STEP: SCAN ── */}
          {step === 'scan' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Searching for Device</Text>
              <Text style={styles.sectionDesc}>
                Plug in your PillPal and ensure the blue light is blinking.
              </Text>

              <TouchableOpacity 
                style={[styles.primaryBtn, ble.status === 'scanning' && styles.btnDisabled]} 
                onPress={ble.scan}
                disabled={ble.status === 'scanning'}
              >
                {ble.status === 'scanning' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="search" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Find My PillPal</Text>
                  </>
                )}
              </TouchableOpacity>

              {ble.foundDevices.length > 0 && (
                <View style={styles.deviceList}>
                  <Text style={styles.listLabel}>Devices Found:</Text>
                  {ble.foundDevices.map(d => (
                    <TouchableOpacity key={d.id} style={styles.deviceItem} onPress={() => onSelectDevice(d)}>
                      <View style={styles.deviceIcon}>
                        <Ionicons name="hardware-chip-outline" size={24} color="#6366f1" />
                      </View>
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceName}>{d.name || 'Unknown Device'}</Text>
                        <Text style={styles.deviceId}>{d.id}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#475569" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {ble.foundDevices.length === 0 && ble.status !== 'scanning' && (
                <View style={styles.emptyState}>
                  <Ionicons name="bluetooth-outline" size={48} color="#1e293b" />
                  <Text style={styles.emptyText}>Tap the button above to start scanning</Text>
                </View>
              )}
            </View>
          )}

          {/* ── STEP: WIFI ── */}
          {step === 'wifi' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connect to WiFi</Text>
              <Text style={styles.sectionDesc}>
                Select your network from the list below or enter it manually.
              </Text>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>WiFi Network (SSID)</Text>
                  {fetchingWifi && <ActivityIndicator size="small" color="#6366f1" />}
                </View>

                {/* WiFi Selection List */}
                {wifiNetworks.length > 0 ? (
                  <View style={styles.wifiList}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
                      {wifiNetworks.map((net, i) => (
                        <TouchableOpacity 
                          key={i} 
                          style={[styles.wifiChip, ssid === net && styles.wifiChipActive]}
                          onPress={() => setSsid(net)}
                        >
                          <Ionicons name="wifi" size={14} color={ssid === net ? '#fff' : '#64748b'} />
                          <Text style={[styles.wifiChipText, ssid === net && styles.wifiChipTextActive]}>{net}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : !fetchingWifi && (
                  <TouchableOpacity style={styles.rescanWifi} onPress={fetchWifi}>
                    <Ionicons name="refresh-outline" size={14} color="#6366f1" />
                    <Text style={styles.rescanWifiText}>Rescan WiFi networks</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.inputWrap}>
                  <Ionicons name="wifi-outline" size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input}
                    placeholder="Or enter SSID manually"
                    placeholderTextColor="#475569"
                    value={ssid}
                    onChangeText={setSsid}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>WiFi Password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#475569"
                    value={wifiPass}
                    onChangeText={setWifiPass}
                    secureTextEntry
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={onSendCredentials}>
                <Text style={styles.btnText}>Connect Device</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.textBtn} onPress={() => { ble.disconnect(); setStep('scan'); }}>
                <Text style={styles.textBtnLabel}>Try different device</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP: WAIT ── */}
          {step === 'wait' && (
            <View style={[styles.section, styles.centeredSection]}>
              <View style={styles.statusIconWrap}>
                {ble.status === 'error' ? (
                  <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
                ) : (
                  <ActivityIndicator size="large" color="#6366f1" />
                )}
              </View>
              <Text style={styles.sectionTitle}>
                {ble.status === 'error' ? 'Connection Failed' : 'Linking Device...'}
              </Text>
              <Text style={styles.sectionDescCentered}>{ble.statusMessage}</Text>

              {ble.status === 'error' && (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('wifi')}>
                  <Text style={styles.btnText}>Try Again</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── STEP: REGISTER ── */}
          {step === 'register' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Device Identified!</Text>
              <Text style={styles.sectionDesc}>
                We've successfully linked to your PillPal. One final step to register it to your account.
              </Text>

              <View style={styles.idBadge}>
                <Text style={styles.idLabel}>Serial Number</Text>
                <Text style={styles.idValue}>{serialNumber || 'Checking...'}</Text>
              </View>

              <TouchableOpacity 
                style={[styles.primaryBtn, loading && styles.btnDisabled]} 
                onPress={onFinalRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Complete Registration</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP: SUCCESS ── */}
          {step === 'success' && (
            <View style={[styles.section, styles.centeredSection]}>
              <View style={[styles.statusIconWrap, { backgroundColor: '#052e16', borderColor: '#166534' }]}>
                <Ionicons name="checkmark-done-circle" size={64} color="#10b981" />
              </View>
              <Text style={styles.sectionTitle}>Success!</Text>
              <Text style={styles.sectionDescCentered}>
                Your PillPal is now fully configured and linked to your account.
              </Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)')}>
                <Text style={styles.btnText}>Enter Dashboard</Text>
                <Ionicons name="home-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>
          )}

        </Animated.View>

        <Text style={styles.footerText}>
          Issues? Hold the reset button on your device for 5 seconds to re-enter pairing mode.
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: 50, 
    paddingBottom: 20 
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#1e293b' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  
  stepsRow: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 40, marginBottom: 24 },
  stepItem: { flex: 1, alignItems: 'center', position: 'relative' },
  stepCircle: { 
    width: 32, height: 32, borderRadius: 16, 
    backgroundColor: '#1e293b', alignItems: 'center', 
    justifyContent: 'center', borderWidth: 1, borderColor: '#334155',
    zIndex: 2
  },
  stepCircleActive: { backgroundColor: '#6366f1', borderColor: '#818cf8', elevation: 4 },
  stepCircleDone: { backgroundColor: '#10b981', borderColor: '#34d399' },
  stepLabel: { fontSize: 10, color: '#64748b', marginTop: 6, fontWeight: '600' },
  stepLabelActive: { color: '#f8fafc' },
  stepLine: { 
    position: 'absolute', top: 16, left: '50%', right: '-50%', 
    height: 2, backgroundColor: '#1e293b', zIndex: 1 
  },

  card: { 
    marginHorizontal: 20, backgroundColor: '#1e293b', 
    borderRadius: 28, padding: 24, borderWidth: 1, borderColor: '#334155',
    minHeight: 400, justifyContent: 'center'
  },
  section: { gap: 20 },
  centeredSection: { alignItems: 'center', textAlign: 'center' },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  sectionDesc: { fontSize: 14, color: '#94a3b8', lineHeight: 22 },
  sectionDescCentered: { fontSize: 14, color: '#94a3b8', lineHeight: 22, textAlign: 'center' },

  primaryBtn: { 
    backgroundColor: '#6366f1', borderRadius: 16, height: 56, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  textBtn: { alignItems: 'center', paddingTop: 8 },
  textBtnLabel: { color: '#64748b', fontSize: 14, fontWeight: '600' },

  deviceList: { marginTop: 10, gap: 10 },
  listLabel: { fontSize: 12, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  deviceItem: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a',
    padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#334155'
  },
  deviceIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1e1b4b', alignItems: 'center', justifyContent: 'center' },
  deviceInfo: { flex: 1, marginLeft: 12 },
  deviceName: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  deviceId: { color: '#475569', fontSize: 11, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: '#475569', fontSize: 13, textAlign: 'center' },

  inputGroup: { gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  inputWrap: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', 
    borderRadius: 16, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 16 
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#f8fafc', fontSize: 15, paddingVertical: 16 },

  wifiList: { marginTop: 4 },
  wifiChip: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, 
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' 
  },
  wifiChipActive: { backgroundColor: '#6366f1', borderColor: '#818cf8' },
  wifiChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  wifiChipTextActive: { color: '#fff' },
  rescanWifi: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  rescanWifiText: { color: '#6366f1', fontSize: 12, fontWeight: '600' },

  statusIconWrap: { 
    width: 100, height: 100, borderRadius: 32, 
    backgroundColor: '#1e1b4b', alignItems: 'center', 
    justifyContent: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#334155'
  },

  idBadge: { 
    backgroundColor: '#0f172a', padding: 16, borderRadius: 16, 
    borderWidth: 1, borderColor: '#334155', alignItems: 'center', gap: 4
  },
  idLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  idValue: { color: '#f8fafc', fontSize: 24, fontWeight: '800', letterSpacing: 2 },

  footerText: { 
    textAlign: 'center', color: '#334155', fontSize: 12, 
    paddingHorizontal: 40, marginTop: 30, lineHeight: 18 
  }
})
