import React from 'react';
import { View, Image, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

interface PlotRendererProps {
  base64Image: string;
  title?: string;
  width?: number;
  height?: number;
}

export default function PlotRenderer({
  base64Image,
  title,
  width,
  height,
}: PlotRendererProps) {
  const { width: screenWidth } = useWindowDimensions();
  const plotWidth = width || screenWidth - Spacing.lg * 2;
  const plotHeight = height || 300;

  return (
    <View style={[styles.container, Shadows.small]}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Image
        source={{ uri: `data:image/png;base64,${base64Image}` }}
        style={[styles.image, { width: plotWidth, height: plotHeight }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  title: {
    ...Typography.h4,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    color: Colors.charcoal,
  },
  image: {
    margin: Spacing.lg,
    backgroundColor: Colors.offWhite,
    borderRadius: BorderRadius.md,
  },
});
