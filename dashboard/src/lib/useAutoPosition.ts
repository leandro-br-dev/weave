import { useState, useEffect, useCallback, type RefObject } from 'react'

export interface Position {
  horizontal: 'left' | 'right'
  vertical: 'top' | 'bottom'
}

interface UseAutoPositionOptions {
  /** Horizontal offset in pixels (gap between trigger and dropdown) */
  offset?: number
  /** Minimum space required on any side before flipping */
  minSpace?: number
  /** Prefer a specific horizontal side when both fit */
  preferHorizontal?: 'left' | 'right'
  /** Prefer a specific vertical side when both fit */
  preferVertical?: 'top' | 'bottom'
  /** Whether the dropdown is currently open (recalculate only when open) */
  isOpen: boolean
}

/**
 * Computes the best position for a dropdown relative to a trigger element.
 *
 * Returns Tailwind-compatible position classes and inline styles that position
 * the dropdown so it stays within the viewport.
 *
 * The hook measures the trigger element's bounding rect on every open state
 * change and on window resize, then picks the side (left/right/top/bottom)
 * that has the most available space.
 */
export function useAutoPosition(
  triggerRef: RefObject<HTMLElement | null>,
  {
    offset = 4,
    minSpace = 120,
    preferHorizontal = 'right',
    preferVertical = 'bottom',
    isOpen,
  }: UseAutoPositionOptions
) {
  const [position, setPosition] = useState<Position>({
    horizontal: preferHorizontal,
    vertical: preferVertical,
  })

  const calculate = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const spaceLeft = rect.left
    const spaceRight = window.innerWidth - rect.right
    const spaceAbove = rect.top
    const spaceBelow = window.innerHeight - rect.bottom

    // Pick horizontal: prefer configured side, flip if not enough space
    let horizontal: 'left' | 'right'
    if (preferHorizontal === 'right' && spaceRight >= minSpace) {
      horizontal = 'right'
    } else if (preferHorizontal === 'left' && spaceLeft >= minSpace) {
      horizontal = 'left'
    } else if (spaceRight >= spaceLeft) {
      horizontal = 'right'
    } else {
      horizontal = 'left'
    }

    // Pick vertical: prefer configured side, flip if not enough space
    let vertical: 'top' | 'bottom'
    if (preferVertical === 'bottom' && spaceBelow >= minSpace) {
      vertical = 'bottom'
    } else if (preferVertical === 'top' && spaceAbove >= minSpace) {
      vertical = 'top'
    } else if (spaceBelow >= spaceAbove) {
      vertical = 'bottom'
    } else {
      vertical = 'top'
    }

    setPosition({ horizontal, vertical })
  }, [triggerRef, minSpace, preferHorizontal, preferVertical])

  // Recalculate when dropdown opens or window resizes
  useEffect(() => {
    if (!isOpen) return
    calculate()
    window.addEventListener('resize', calculate)
    return () => window.removeEventListener('resize', calculate)
  }, [isOpen, calculate])

  // Also recalculate on scroll
  useEffect(() => {
    if (!isOpen) return
    calculate()
    window.addEventListener('scroll', calculate, true)
    return () => window.removeEventListener('scroll', calculate, true)
  }, [isOpen, calculate])

  /**
   * Returns Tailwind CSS classes to apply to the dropdown container.
   * Use this when the dropdown is rendered **inside** a relative-positioned parent.
   */
  const getPositionClasses = useCallback(() => {
    const h = position.horizontal === 'right' ? 'left-full' : 'right-full'
    const v = position.vertical === 'top' ? 'bottom-0' : 'top-0'
    const hMargin = position.horizontal === 'right' ? 'ml-1' : 'mr-1'
    return `${h} ${v} ${hMargin}`
  }, [position])

  /**
   * Returns inline styles for `fixed` positioning.
   * Use this when the dropdown is rendered **outside** the trigger's DOM tree
   * (e.g. via a React Portal).
   */
  const getFixedPositionStyles = useCallback((): React.CSSProperties => {
    const trigger = triggerRef.current
    if (!trigger) return {}

    const rect = trigger.getBoundingClientRect()

    const styles: React.CSSProperties = { position: 'fixed' }

    if (position.horizontal === 'right') {
      styles.left = rect.right + offset
    } else {
      styles.right = window.innerWidth - rect.left + offset
    }

    if (position.vertical === 'top') {
      styles.bottom = window.innerHeight - rect.bottom
    } else {
      styles.top = rect.top
    }

    return styles
  }, [position, triggerRef, offset])

  return { position, getPositionClasses, getFixedPositionStyles, recalculate: calculate }
}
