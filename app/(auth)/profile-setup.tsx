import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  Animated, Platform, KeyboardAvoidingView
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'

const STEPS = [
  { label: 'Account', icon: 'person-outline' },
  { label: 'Profile', icon: 'document-text-outline' },
  { label: 'Device',  icon: 'hardware-chip-outline' },
]

export default function ProfileSetupScreen() {
  const router    = useRouter()
  const [fullName, setFullName] = useState('')
  const [dob,      setDob]      = useState('')
  const [phone,    setPhone]    = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [])

  // Age preview from date of birth
  const agePreview = dob
    ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)
    : null

  const handleSave = async () => {
    if (!fullName.trim()) { setError('Full name is required.'); return }
    if (!dob)             { setError('Date of birth is required.'); return }
    if (!phone.trim())    { setError('Phone number is required.'); return }

    setError(null)
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/(auth)/login'); return }

    const { error: dbError } = await supabase
      .from('profiles')
      .upsert({
        id:              session.user.id,
        full_name:       fullName.trim(),
        birth_date:      dob,
        phone_number:    phone.trim(),
        medication_list: [],
      })

    setLoading(false)
    if (dbError) {
      setError(dbError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => router.replace('/(auth)/device-setup'), 1000)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Brand + Step indicator */}
          <View style={styles.brand}>
            <View style={styles.iconWrap}>
              <Text style={{ fontSize: 32 }}>💊</Text>
            </View>
            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>This information helps personalize your medication schedule.</Text>

            {/* Step dots */}
            <View style={styles.steps}>
              {STEPS.map((step, i) => (
                <View key={i} style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    i === 0 && styles.stepDone,
                    i === 1 && styles.stepActive,
                  ]}>
                    <Text style={styles.stepNum}>
                      {i === 0 ? '✓' : String(i + 1)}
                    </Text>
                  </View>
                  <Text style={[styles.stepLabel, i === 1 && styles.stepLabelActive]}>
                    {step.label}
                  </Text>
                  {i < STEPS.length - 1 && <View style={styles.stepLine} />}
                </View>
              ))}
            </View>
          </View>

          {/* Card */}
          <View style={styles.card}>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={16} color="#f87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {success && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#34d399" />
                <Text style={styles.successText}>Profile saved! Setting up your device...</Text>
              </View>
            )}

            {/* Full Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ahmed Ben Ali"
                  placeholderTextColor="#475569"
                  autoCapitalize="words"
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!loading && !success}
                />
              </View>
            </View>

            {/* Date of Birth */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Date of Birth</Text>
                {agePreview !== null && agePreview > 0 && (
                  <Text style={styles.ageHint}>({agePreview} years old)</Text>
                )}
              </View>
              <View style={styles.inputWrap}>
                <Ionicons name="calendar-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#475569"
                  keyboardType="numeric"
                  value={dob}
                  onChangeText={text => {
                    // Auto-insert dashes
                    const clean = text.replace(/[^0-9]/g, '')
                    let formatted = clean
                    if (clean.length > 4) formatted = clean.slice(0,4) + '-' + clean.slice(4)
                    if (clean.length > 6) formatted = clean.slice(0,4) + '-' + clean.slice(4,6) + '-' + clean.slice(6,8)
                    setDob(formatted)
                  }}
                  maxLength={10}
                  editable={!loading && !success}
                />
              </View>
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+216 XX XXX XXX"
                  placeholderTextColor="#475569"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!loading && !success}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, (loading || success) && styles.btnDisabled]}
              onPress={handleSave}
              disabled={loading || success}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : success
                ? <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Saved!</Text>
                  </>
                : <>
                    <Text style={styles.btnText}>Save & Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                  </>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>You can update this information anytime from settings.</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0f172a' },
  inner:           { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 48 },
  content:         { gap: 24 },
  brand:           { alignItems: 'center', gap: 12 },
  iconWrap:        { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  title:           { fontSize: 26, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  subtitle:        { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  steps:           { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  stepItem:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepDot:         { width: 26, height: 26, borderRadius: 13, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
  stepDone:        { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  stepActive:      { backgroundColor: '#6366f1', borderColor: '#818cf8', borderWidth: 2 },
  stepNum:         { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepLabel:       { fontSize: 11, color: '#64748b', fontWeight: '500' },
  stepLabelActive: { color: '#f8fafc', fontWeight: '700' },
  stepLine:        { width: 20, height: 1, backgroundColor: '#334155' },
  card:            { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155', gap: 14 },
  errorBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#450a0a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#7f1d1d' },
  errorText:       { color: '#fca5a5', fontSize: 13, flex: 1 },
  successBox:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#052e16', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#166534' },
  successText:     { color: '#34d399', fontSize: 13, fontWeight: '600' },
  field:           { gap: 6 },
  labelRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label:           { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  ageHint:         { fontSize: 12, color: '#64748b' },
  inputWrap:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 14, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14 },
  inputIcon:       { marginRight: 8 },
  input:           { flex: 1, color: '#f8fafc', fontSize: 15, paddingVertical: 14 },
  btn:             { backgroundColor: '#6366f1', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled:     { opacity: 0.6 },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer:          { textAlign: 'center', fontSize: 11, color: '#475569' },
})
