import { useState, useCallback } from 'react'

export type MicrophoneStatus = 'idle' | 'requesting' | 'granted' | 'denied'

interface UseMicrophoneReturn {
  status: MicrophoneStatus
  requestAccess: () => Promise<boolean>
}

function isCapacitorNative(): boolean {
  return typeof (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform === 'function' &&
    ((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor!.isNativePlatform!() ?? false)
}

// On Capacitor, getUserMedia itself triggers the native OS permission dialog.
// No separate plugin needed; this is a no-op placeholder for future plugin use.
async function requestCapacitorPermission(): Promise<boolean> {
  return true
}

export function useMicrophone(): UseMicrophoneReturn {
  const [status, setStatus] = useState<MicrophoneStatus>('idle')

  const requestAccess = useCallback(async (): Promise<boolean> => {
    setStatus('requesting')

    if (isCapacitorNative()) {
      const granted = await requestCapacitorPermission()
      if (!granted) {
        setStatus('denied')
        return false
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      for (const track of stream.getTracks()) {
        track.stop()
      }
      setStatus('granted')
      return true
    } catch {
      setStatus('denied')
      return false
    }
  }, [])

  return { status, requestAccess }
}
