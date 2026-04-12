import type { ReactElement } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { lifeTheme } from '../theme';
import { AppIconSVG } from './AppIconSVG';

export function AppLoadingSplash(): ReactElement {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.94)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [logoOpacity, logoScale, textOpacity]);

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <AppIconSVG size={120} />
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity }}>
        <Text style={styles.wordmark}>LIFEOS</Text>
        <Text style={styles.version}>v3.0 Nexus</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoWrap: {
    borderWidth: 1,
    borderColor: '#BDFF00',
    borderRadius: 28,
    padding: 10,
    marginBottom: 18,
    backgroundColor: '#121212'
  },
  wordmark: {
    color: '#BDFF00',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center'
  },
  version: {
    color: lifeTheme.colors.muted,
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2
  }
});

export default AppLoadingSplash;
