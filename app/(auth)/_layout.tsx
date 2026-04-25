import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        animation:    'slide_from_right',
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="device-setup" />
    </Stack>
  )
}
