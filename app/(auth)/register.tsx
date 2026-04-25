import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, Animated
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'

export default function RegisterScreen() {
  const router    = useRouter()
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start()
  }, [])

  const handleRegister = async () => {
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError('Please fill in all fields.'); return
    }
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        data: { full_name: name.trim(), phone: phone.trim() },
      },
    })

    setLoading(false)
    if (authError) {
      setError(authError.message)
    } else {
      router.push({ pathname: '/(auth)/verify', params: { email: email.trim().toLowerCase() } })
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Back */}
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
            <Text style={styles.backText}>Back to login</Text>
          </TouchableOpacity>

          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.iconWrap}>
              <Text style={styles.pill}>💊</Text>
            </View>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Set up your PillPal account with a secure email code.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={16} color="#f87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Full Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ahmed Ben Ali"
                  placeholderTextColor="#475569"
                  autoCapitalize="words"
                  value={name}
                  onChangeText={setName}
                  editable={!loading}
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
                  editable={!loading}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#475569"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="person-add-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Send Verification Code</Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginBold}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>Secured by Supabase Auth · No passwords stored</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f172a' },
  inner:       { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 48 },
  content:     { gap: 20 },
  back:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText:    { color: '#94a3b8', fontSize: 14 },
  brand:       { alignItems: 'center', gap: 12 },
  iconWrap:    { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  pill:        { fontSize: 32 },
  title:       { fontSize: 26, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  subtitle:    { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  card:        { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155', gap: 14 },
  errorBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#450a0a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#7f1d1d' },
  errorText:   { color: '#fca5a5', fontSize: 13, flex: 1, lineHeight: 18 },
  field:       { gap: 6 },
  label:       { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 14, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14 },
  inputIcon:   { marginRight: 8 },
  input:       { flex: 1, color: '#f8fafc', fontSize: 15, paddingVertical: 14 },
  btn:         { backgroundColor: '#6366f1', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  loginLink:   { alignItems: 'center' },
  loginText:   { color: '#64748b', fontSize: 14 },
  loginBold:   { color: '#818cf8', fontWeight: '700' },
  footer:      { textAlign: 'center', fontSize: 11, color: '#334155' },
})
