import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'

const OTP_LENGTH = 6

export default function VerifyScreen() {
  const router      = useRouter()
  const { email }   = useLocalSearchParams<{ email: string }>()

  const [token,   setToken]   = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resent,  setResent]  = useState(false)
  const inputRef  = useRef<TextInput>(null)
  const shakeAnim = useRef(new Animated.Value(0)).current
  const fadeAnim  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!email) { router.replace('/(auth)/login'); return }
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start()
    // Focus the hidden input after mount
    setTimeout(() => inputRef.current?.focus(), 400)
  }, [])

  // ── Auto-submit when all 6 digits entered ─────────────────
  useEffect(() => {
    if (token.length === OTP_LENGTH) handleVerify()
  }, [token])

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start()
  }

  const handleVerify = async () => {
    if (token.length !== OTP_LENGTH) return
    setError(null)
    setLoading(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email as string,
      token,
      type: 'email',
    })

    setLoading(false)
    if (verifyError) {
      setError(verifyError.message)
      setToken('')
      shake()
    } else {
      // Check if profile exists → go to profile-setup or device-setup
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (!profile?.full_name) {
        router.replace('/(auth)/profile-setup')
      } else {
        const { data: device } = await supabase
          .from('devices')
          .select('id')
          .eq('owner_id', user.id)
          .single()

        router.replace(device ? '/(tabs)' : '/(auth)/device-setup')
      }
    }
  }

  const handleResend = async () => {
    setResent(false)
    await supabase.auth.signInWithOtp({
      email: email as string,
      options: { shouldCreateUser: false },
    })
    setResent(true)
    setTimeout(() => setResent(false), 4000)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>

        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          <Text style={styles.backText}>Change email</Text>
        </TouchableOpacity>

        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.iconWrap}>
            <Ionicons name="mail" size={32} color="#10b981" />
          </View>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
        </View>

        {/* OTP Boxes + hidden input */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
        >
          <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const filled  = i < token.length
              const current = i === token.length
              return (
                <View
                  key={i}
                  style={[
                    styles.digitBox,
                    filled  && styles.digitBoxFilled,
                    current && styles.digitBoxActive,
                    error   && styles.digitBoxError,
                  ]}
                >
                  {loading && i < token.length
                    ? <ActivityIndicator size="small" color="#6366f1" />
                    : <Text style={styles.digit}>{token[i] ?? ''}</Text>
                  }
                </View>
              )
            })}
          </Animated.View>
        </TouchableOpacity>

        {/* Hidden text input */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={token}
          onChangeText={t => {
            setError(null)
            setToken(t.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH))
          }}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          editable={!loading}
        />

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${(token.length / OTP_LENGTH) * 100}%` }]} />
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color="#f87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Success resend */}
        {resent && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#34d399" />
            <Text style={styles.successText}>New code sent!</Text>
          </View>
        )}

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.btn, (loading || token.length !== OTP_LENGTH) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={loading || token.length !== OTP_LENGTH}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnText}>Verify & Sign In</Text>
          }
        </TouchableOpacity>

        {/* Footer actions */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleResend} style={styles.footerBtn}>
            <Ionicons name="refresh-outline" size={14} color="#818cf8" />
            <Text style={styles.footerBtnText}>Resend code</Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>·</Text>
          <Text style={styles.footerHint}>Code expires in 10 min</Text>
        </View>

        <Text style={styles.hint}>Check spam if not received</Text>

      </Animated.View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0f172a' },
  inner:           { flex: 1, paddingHorizontal: 24, paddingTop: 56, gap: 24 },
  back:            { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText:        { color: '#94a3b8', fontSize: 14 },
  brand:           { alignItems: 'center', gap: 12 },
  iconWrap:        { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#052e16', borderWidth: 1, borderColor: '#166534', shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  title:           { fontSize: 26, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  subtitle:        { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  emailHighlight:  { color: '#f8fafc', fontWeight: '700' },
  otpRow:          { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  digitBox:        { width: 46, height: 58, borderRadius: 14, borderWidth: 2, borderColor: '#334155', backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  digitBoxFilled:  { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  digitBoxActive:  { borderColor: '#818cf8', backgroundColor: '#1e293b' },
  digitBoxError:   { borderColor: '#ef4444', backgroundColor: '#450a0a' },
  digit:           { fontSize: 24, fontWeight: '800', color: '#f8fafc', fontVariant: ['tabular-nums'] },
  hiddenInput:     { position: 'absolute', opacity: 0, width: 1, height: 1 },
  progressTrack:   { height: 4, backgroundColor: '#1e293b', borderRadius: 2, overflow: 'hidden' },
  progressFill:    { height: '100%', backgroundColor: '#6366f1', borderRadius: 2 },
  errorBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#450a0a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#7f1d1d' },
  errorText:       { color: '#fca5a5', fontSize: 13, flex: 1 },
  successBox:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#052e16', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#166534' },
  successText:     { color: '#34d399', fontSize: 13, fontWeight: '600' },
  btn:             { backgroundColor: '#6366f1', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled:     { opacity: 0.4 },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerBtnText:   { color: '#818cf8', fontSize: 13, fontWeight: '600' },
  footerDot:       { color: '#334155' },
  footerHint:      { color: '#475569', fontSize: 13 },
  hint:            { textAlign: 'center', fontSize: 12, color: '#334155' },
})
