import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import {
  Bug,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Wrench,
} from './icons';
import { ExecutionStep } from '../services/dataOperations/DataFrameManager';

export interface DebugInfo {
  rawOutput: string;
  steps: ExecutionStep[];
  finalResult: string;
  error?: string;
}

interface Props {
  debug: DebugInfo;
}

export default function FunctionCallDebugView({ debug }: Props) {
  const [open, setOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  const hasError = !!debug.error;
  const stepCount = debug.steps.length;

  return (
    <View style={[styles.container, Shadows.small]}>
      {/* Summary row — always visible */}
      <TouchableOpacity style={styles.header} onPress={() => setOpen((v) => !v)} activeOpacity={0.75}>
        <View style={styles.headerLeft}>
          <Bug size={14} color={hasError ? Colors.error : Colors.primaryDark} strokeWidth={2} />
          <Text style={[styles.headerText, hasError && styles.errorText]}>
            {hasError
              ? `Error at step ${debug.steps.length}`
              : `${stepCount} step${stepCount !== 1 ? 's' : ''} · result: ${shortResult(debug.finalResult)}`}
          </Text>
        </View>
        {open ? (
          <ChevronDown size={14} color={Colors.gray} />
        ) : (
          <ChevronRight size={14} color={Colors.gray} />
        )}
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {/* Steps */}
          {debug.steps.map((step, i) => (
            <StepRow key={i} step={step} index={i} />
          ))}

          {/* Error banner */}
          {hasError && (
            <View style={styles.errorBanner}>
              <AlertCircle size={13} color={Colors.error} />
              <Text style={styles.errorMsg}>{debug.error}</Text>
            </View>
          )}

          {/* Final result */}
          {!hasError && debug.finalResult !== '' && (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Final result</Text>
              <Text style={styles.resultValue}>{debug.finalResult}</Text>
            </View>
          )}

          {/* Raw model output toggle */}
          <TouchableOpacity
            style={styles.rawToggle}
            onPress={() => setRawOpen((v) => !v)}
            activeOpacity={0.75}
          >
            <Text style={styles.rawToggleText}>
              {rawOpen ? '▼ Hide raw output' : '▶ Show raw model output'}
            </Text>
          </TouchableOpacity>
          {rawOpen && (
            <ScrollView style={styles.rawScroll} nestedScrollEnabled>
              <Text style={styles.rawText}>{debug.rawOutput}</Text>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

function StepRow({ step, index }: { step: ExecutionStep; index: number }) {
  const [open, setOpen] = useState(false);
  const ok = !step.error;

  return (
    <View style={styles.step}>
      <TouchableOpacity style={styles.stepHeader} onPress={() => setOpen((v) => !v)} activeOpacity={0.75}>
        <View style={styles.stepLeft}>
          <View style={[styles.stepNum, ok ? styles.stepNumOk : styles.stepNumErr]}>
            <Text style={styles.stepNumText}>{index + 1}</Text>
          </View>
          <View style={[styles.stepIcon, ok ? styles.stepIconOk : styles.stepIconErr]}>
            {ok ? (
              <CheckCircle2 size={11} color={Colors.success} strokeWidth={2.5} />
            ) : (
              <AlertCircle size={11} color={Colors.error} strokeWidth={2.5} />
            )}
          </View>
          <Text style={styles.stepFn}>{step.fn}</Text>
        </View>
        {open ? (
          <ChevronDown size={12} color={Colors.gray} />
        ) : (
          <ChevronRight size={12} color={Colors.gray} />
        )}
      </TouchableOpacity>

      {open && (
        <View style={styles.stepBody}>
          {Object.keys(step.args).length > 0 && (
            <View style={styles.argsBlock}>
              <Text style={styles.blockLabel}>Args</Text>
              <Text style={styles.mono}>{JSON.stringify(step.args, null, 2)}</Text>
            </View>
          )}
          {step.error ? (
            <View style={styles.errBlock}>
              <Text style={styles.blockLabel}>Error</Text>
              <Text style={[styles.mono, styles.errorMono]}>{step.error}</Text>
            </View>
          ) : (
            <View style={styles.argsBlock}>
              <Text style={styles.blockLabel}>Result</Text>
              <Text style={styles.mono}>{step.result}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function shortResult(r: string): string {
  if (!r) return '(empty)';
  const firstLine = r.split('\n')[0];
  return firstLine.length > 40 ? firstLine.slice(0, 40) + '…' : firstLine;
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${Colors.primaryDark}30`,
    backgroundColor: `${Colors.primaryDark}08`,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  headerText: { ...Typography.caption, color: Colors.primaryDark, fontWeight: '600', flex: 1 },
  errorText: { color: Colors.error },
  body: { borderTopWidth: 1, borderTopColor: `${Colors.primaryDark}20`, padding: Spacing.md, gap: Spacing.sm },
  step: {
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
  },
  stepLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumOk: { backgroundColor: `${Colors.success}20` },
  stepNumErr: { backgroundColor: `${Colors.error}20` },
  stepNumText: { ...Typography.caption, fontSize: 10, fontWeight: '700', color: Colors.charcoal },
  stepIcon: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  stepIconOk: {},
  stepIconErr: {},
  stepFn: { ...Typography.caption, color: Colors.charcoal, fontWeight: '600', fontFamily: 'monospace' },
  stepBody: { borderTopWidth: 1, borderTopColor: Colors.lightGray, padding: Spacing.sm, gap: Spacing.sm },
  argsBlock: { gap: 4 },
  errBlock: { gap: 4 },
  blockLabel: { ...Typography.caption, color: Colors.gray, textTransform: 'uppercase', fontSize: 9, fontWeight: '700' },
  mono: { ...Typography.caption, fontFamily: 'monospace', color: Colors.charcoal, backgroundColor: Colors.offWhite, padding: Spacing.sm, borderRadius: BorderRadius.sm },
  errorMono: { color: Colors.error, backgroundColor: '#fff0f0' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#fff0f0', padding: Spacing.sm, borderRadius: BorderRadius.sm },
  errorMsg: { ...Typography.caption, color: Colors.error, flex: 1 },
  resultRow: {
    backgroundColor: `${Colors.secondary}10`,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.secondary,
  },
  resultLabel: { ...Typography.caption, color: Colors.secondaryDark, textTransform: 'uppercase', fontSize: 9, fontWeight: '700' },
  resultValue: { ...Typography.body, color: Colors.charcoal, fontWeight: '600' },
  rawToggle: { paddingVertical: Spacing.xs },
  rawToggleText: { ...Typography.caption, color: Colors.gray, textDecorationLine: 'underline' },
  rawScroll: { maxHeight: 120 },
  rawText: { ...Typography.caption, fontFamily: 'monospace', color: Colors.darkGray },
});
