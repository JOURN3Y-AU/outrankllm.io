'use client'

/**
 * HiringBrand Platform Score Card
 * Shows score and mention count for each AI platform
 */

import Image from 'next/image'
import { hbColors, hbFonts, hbShadows, hbRadii, hbPlatformConfig, getScoreColor } from './shared/constants'
import type { HBPlatform } from './shared/types'

interface HBPlatformCardProps {
  platform: HBPlatform
  score: number
  mentionCount: number
  totalQuestions: number
}

export function HBPlatformCard({ platform, score, mentionCount, totalQuestions }: HBPlatformCardProps) {
  const config = hbPlatformConfig[platform]
  const scoreColor = getScoreColor(score)

  return (
    <div
      style={{
        background: hbColors.surface,
        borderRadius: hbRadii.lg,
        padding: '20px',
        boxShadow: hbShadows.sm,
        border: `1px solid ${hbColors.surfaceDim}`,
        transition: 'all 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = hbShadows.teal
        e.currentTarget.style.borderColor = hbColors.teal
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = hbShadows.sm
        e.currentTarget.style.borderColor = hbColors.surfaceDim
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {/* Platform icon */}
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: hbRadii.md,
            background: `linear-gradient(135deg, ${config.color}20, ${config.color}10)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            src={config.iconPath}
            alt={config.name}
            width={config.iconSize.width}
            height={config.iconSize.height}
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Platform name */}
        <div>
          <div
            style={{
              fontFamily: hbFonts.display,
              fontSize: '16px',
              fontWeight: 600,
              color: hbColors.slate,
            }}
          >
            {config.name}
          </div>
          <div
            style={{
              fontFamily: hbFonts.body,
              fontSize: '12px',
              color: hbColors.slateLight,
            }}
          >
            {config.weight === 10 ? 'Most Popular' : `${config.weight}x weight`}
          </div>
        </div>
      </div>

      {/* Score */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '4px',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontFamily: hbFonts.display,
            fontSize: '36px',
            fontWeight: 700,
            color: scoreColor,
            lineHeight: 1,
          }}
        >
          {score}
        </span>
        <span
          style={{
            fontFamily: hbFonts.body,
            fontSize: '14px',
            color: hbColors.slateLight,
          }}
        >
          / 100
        </span>
      </div>

      {/* Mention count */}
      <div
        style={{
          fontFamily: hbFonts.body,
          fontSize: '13px',
          color: hbColors.slateMid,
        }}
      >
        Mentioned in{' '}
        <span style={{ fontWeight: 600, color: hbColors.slate }}>
          {mentionCount} of {totalQuestions}
        </span>{' '}
        responses
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: '12px',
          height: '6px',
          background: hbColors.surfaceDim,
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            background: scoreColor,
            borderRadius: '3px',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}
