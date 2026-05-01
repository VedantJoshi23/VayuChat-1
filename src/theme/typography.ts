import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const Typography = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    color: Colors.charcoal,
  },
  h2: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 36,
    color: Colors.charcoal,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    color: Colors.charcoal,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    color: Colors.charcoal,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: Colors.charcoal,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: Colors.darkGray,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    color: Colors.darkGray,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: Colors.gray,
  },
  mono: {
    fontSize: 13,
    fontFamily: 'Monaco',
    fontWeight: '500',
    color: Colors.charcoal,
  },
});
