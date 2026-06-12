/**
 * VoiceInteraction — 语音交互 UI
 *
 * 4 状态动画 (Framer Motion):
 *   idle      — 静默光环，呼吸脉冲
 *   listening — 动态声波柱状图，实时音量映射
 *   thinking  — 粒子旋转环 + 核心脉动
 *   speaking  — 同心圆语音波纹，向外扩散
 */

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// Types
// ============================================================

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATE_LABELS: Record<VoiceState, string> = {
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

const STATE_COLORS: Record<VoiceState, string> = {
  idle: '#6e7681',
  listening: '#22c55e',
  thinking: '#3b82f6',
  speaking: '#3b82f6',
};

// ============================================================
// Idle Animation — 静默呼吸光环
// ============================================================

function IdleAnimation() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      {/* Outer ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-gray-700"
        animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Inner ring */}
      <motion.div
        className="absolute inset-2 rounded-full border border-gray-600"
        animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
      />
      {/* Center dot */}
      <motion.div
        className="w-3 h-3 rounded-full bg-gray-500"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
}

// ============================================================
// Listening Animation — 动态声波柱状图
// ============================================================

const BAR_COUNT = 20;

function ListeningAnimation() {
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0.2));

  useEffect(() => {
    const timer = setInterval(() => {
      setBars(Array.from({ length: BAR_COUNT }, () => {
        // Simulate voice activity — center bars react more
        const centerDist = Math.abs(Math.random() - 0.5) * 2;
        return Math.max(0.08, Math.random() * 0.9 * (1 - centerDist * 0.4));
      }));
    }, 120);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-center gap-[3px] w-24 h-16">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ backgroundColor: '#22c55e' }}
          animate={{ height: `${h * 100}%`, opacity: 0.6 + h * 0.4 }}
          transition={{ duration: 0.1, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ============================================================
// Thinking Animation — 粒子旋转环
// ============================================================

const PARTICLE_COUNT = 8;

function ThinkingAnimation() {
  const particles = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (i / PARTICLE_COUNT) * 360,
      delay: i * 0.15,
    })),
  []);

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      {/* Rotating ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary/30"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute inset-2 rounded-full border border-transparent border-b-primary/50 border-l-primary/20"
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
      {/* Orbiting particles */}
      {particles.map((p) => (
        <motion.div
          key={p.angle}
          className="absolute w-1.5 h-1.5 rounded-full bg-primary"
          animate={{
            rotate: [0, 360],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: p.delay }}
          style={{
            transformOrigin: '32px 32px',
            left: '50%',
            top: '50%',
            marginLeft: -3,
            marginTop: -3,
          }}
        >
          <motion.div
            className="w-full h-full rounded-full bg-primary"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: p.delay }}
          />
        </motion.div>
      ))}
      {/* Core */}
      <motion.div
        className="w-3 h-3 rounded-full bg-primary"
        animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </div>
  );
}

// ============================================================
// Speaking Animation — 同心圆语音波纹
// ============================================================

const RIPPLE_COUNT = 3;

function SpeakingAnimation() {
  const [ripples, setRipples] = useState<number[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRipples(prev => {
        if (prev.length >= RIPPLE_COUNT) return [Date.now()];
        return [...prev, Date.now()];
      });
    }, 800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      {/* Ripples */}
      <AnimatePresence>
        {ripples.map((id) => (
          <motion.div
            key={id}
            className="absolute rounded-full border-2 border-primary-400"
            initial={{ width: 8, height: 8, opacity: 0.8 }}
            animate={{ width: 64, height: 64, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
      {/* Core speaking indicator */}
      <motion.div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${STATE_COLORS.speaking}22` }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 0.6, repeat: Infinity }}
      >
        <motion.div
          className="w-3 h-3 rounded-full bg-primary-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        />
      </motion.div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

const ANIMATIONS: Record<VoiceState, React.FC> = {
  idle: IdleAnimation,
  listening: ListeningAnimation,
  thinking: ThinkingAnimation,
  speaking: SpeakingAnimation,
};

interface VoiceInteractionProps {
  state?: VoiceState;
  className?: string;
  compact?: boolean;
}

function VoiceInteraction({ state = 'idle', className = '', compact = false }: VoiceInteractionProps) {
  const Animation = ANIMATIONS[state];
  const color = STATE_COLORS[state];

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-10 h-10 flex items-center justify-center">
          <Animation />
        </div>
        <motion.span
          key={state}
          className="text-[10px] font-mono"
          style={{ color }}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {STATE_LABELS[state]}
        </motion.span>
      </div>
    );
  }

  return (
    <motion.div
      className={`flex flex-col items-center gap-3 p-4 rounded-md border select-none ${className}`}
      style={{ borderColor: `${color}30`, backgroundColor: `${color}05` }}
      animate={{ borderColor: [`${color}20`, `${color}40`, `${color}20`] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      {/* Animation */}
      <motion.div
        key={state}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Animation />
      </motion.div>

      {/* Label */}
      <motion.span
        key={`label-${state}`}
        className="text-[11px] font-mono tracking-wider"
        style={{ color }}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
      >
        {STATE_LABELS[state]}
      </motion.span>

      {/* State indicator dots */}
      <div className="flex gap-1.5">
        {(['idle', 'listening', 'thinking', 'speaking'] as VoiceState[]).map(s => (
          <motion.div
            key={s}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: STATE_COLORS[s] }}
            animate={{
              scale: s === state ? 1.3 : 0.7,
              opacity: s === state ? 1 : 0.3,
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default VoiceInteraction;
