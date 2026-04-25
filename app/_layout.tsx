import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

// ── Auth Guard ─────────────────────────────────────────────────────────────────
function AuthGuard() {
  const router   = useRouter()
  const segments = useSegments()

  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null)
  const [hasDevice, setHasDevice] = useState<boolean | null>(null)

  // 1. Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // 2. Load profile + device when session changes
  useEffect(() => {
    if (!session) {
      setProfile(null)
      setHasDevice(null)
      return
    }
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))

    supabase
      .from('devices')
      .select('id')
      .eq('owner_id', session.user.id)
      .single()
      .then(({ data }) => setHasDevice(!!data))
  }, [session?.user.id])

  // 3. Redirect based on state
  useEffect(() => {
    if (session === undefined) return  // still loading

    const inAuth = segments[0] === '(auth)'
    const inTabs = segments[0] === '(tabs)'

    if (!session) {
      // Not logged in — only allow auth screens
      if (!inAuth) router.replace('/(auth)/login')
      return
    }

    // Logged in but profile/device not yet loaded
    if (profile === null || hasDevice === null) return

    if (!profile?.full_name) {
      // Need profile setup
      const onSetup = segments[1] === 'profile-setup' || segments[1] === 'verify'
      if (!onSetup) router.replace('/(auth)/profile-setup')
    } else if (!hasDevice) {
      // Need device setup
      if (segments[1] !== 'device-setup') router.replace('/(auth)/device-setup')
    } else {
      // Fully set up → go to tabs
      if (inAuth) router.replace('/(tabs)')
    }
  }, [session, profile, hasDevice, segments])

  return null
}

// ── Root Layout ────────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#0f172a' } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
