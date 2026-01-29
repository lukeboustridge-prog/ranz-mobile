/**
 * Biometric Unlock Screen
 *
 * Quick unlock screen using Face ID / Touch ID / Fingerprint.
 * Shown when user returns to app and has biometrics enabled.
 *
 * Flow:
 * 1. Attempt biometric authentication on mount
 * 2. On success, validate stored token is still valid
 * 3. If valid, navigate to home
 * 4. If token expired, redirect to login for re-authentication
 * 5. User can always choose "Use Password Instead" to go to login
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
  getBiometricTypeName,
} from '../../src/lib/auth/biometrics';

export default function BiometricUnlockScreen() {
  const router = useRouter();
  const validateSession = useAuthStore((state) => state.validateSession);
  const biometricsEnabled = useAuthStore((state) => state.biometricsEnabled);

  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');

  // Get biometric type name for display
  useEffect(() => {
    async function loadBiometricType() {
      const capability = await getBiometricCapability();
      if (capability.types.length > 0) {
        setBiometricType(getBiometricTypeName(capability.types));
      }
    }
    loadBiometricType();
  }, []);

  // Attempt biometric unlock on mount
  useEffect(() => {
    if (biometricsEnabled) {
      attemptBiometricUnlock();
    }
  }, [biometricsEnabled]);

  async function attemptBiometricUnlock() {
    setError(null);
    setIsAuthenticating(true);

    try {
      // Check biometric capability first
      const capability = await getBiometricCapability();

      if (!capability.available) {
        setError('Biometric hardware not available on this device.');
        setIsAuthenticating(false);
        return;
      }

      if (!capability.enrolled) {
        setError('No biometrics enrolled. Please set up biometrics in device settings.');
        setIsAuthenticating(false);
        return;
      }

      // Attempt biometric authentication
      const result = await authenticateWithBiometrics({
        promptMessage: 'Unlock RANZ App',
        fallbackLabel: 'Use Password',
      });

      if (result.success) {
        // Validate that stored token is still valid
        const isValid = await validateSession();

        if (isValid) {
          // Token valid - proceed to home
          router.replace('/(main)/home');
        } else {
          // Token expired - need full login
          setError('Your session has expired. Please sign in again.');
          // Short delay to show message before redirect
          setTimeout(() => {
            router.replace('/(auth)/login');
          }, 2000);
        }
      } else if (result.fallbackToPassword) {
        // User chose to use password
        router.replace('/(auth)/login');
      } else {
        // Authentication failed
        setError(result.error || 'Authentication failed. Please try again.');
      }
    } catch (err) {
      console.error('[BiometricUnlock] Error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  }

  function handleUsePassword() {
    router.replace('/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Biometric Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>
            {biometricType === 'Face ID' ? '(^-^)' : '(*)'}
          </Text>
        </View>

        {/* Welcome Message */}
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>
          Use {biometricType} to unlock the app
        </Text>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Loading Indicator */}
        {isAuthenticating && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2d5c8f" />
            <Text style={styles.loadingText}>Authenticating...</Text>
          </View>
        )}

        {/* Try Again Button */}
        {!isAuthenticating && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={attemptBiometricUnlock}
          >
            <Text style={styles.primaryButtonText}>
              Try Again with {biometricType}
            </Text>
          </TouchableOpacity>
        )}

        {/* Use Password Link */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleUsePassword}
        >
          <Text style={styles.secondaryButtonText}>Use Password Instead</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e8eef6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 36,
    color: '#2d5c8f',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 32,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 320,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#2d5c8f',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  secondaryButtonText: {
    color: '#2d5c8f',
    fontSize: 16,
    fontWeight: '600',
  },
});
