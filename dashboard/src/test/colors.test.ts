/**
 * Color Consistency Test Suite
 *
 * This test suite verifies that the centralized color configuration maintains
 * consistency across all color definitions and follows established patterns.
 *
 * **What is tested:**
 * - All required color groups are exported
 * - Status colors follow consistent patterns
 * - Button variants have all required states
 * - Color shade values follow conventions
 * - No duplicate color definitions
 * - All required status states are covered
 */

import { describe, test, expect } from 'vitest'
import {
  statusColors,
  buttonVariants,
  metricColors,
  errorColors,
  successColors,
  warningColors,
  infoColors,
  bgColors,
  textColors,
  borderColors,
  interactiveStates,
  colorPalette,
  accentColors,
  darkModeAccentColors,
  sidebarColors,
  darkModeSidebarColors,
  modalColors,
  darkModeModalColors,
  tableColors,
  darkModeTableColors,
  kanbanColors,
  darkModeKanbanColors,
  chatColors,
  darkModeChatColors,
  dropdownColors,
  darkModeDropdownColors,
  codeBlockColors,
  darkModeCodeBlockColors,
  darkModeColors,
  type StatusColorScheme,
  type ButtonColorScheme,
  type AccentColorScheme,
  type SidebarColorScheme,
  type ModalColorScheme,
  type TableColorScheme,
  type KanbanColorScheme,
  type ChatColorScheme,
  type DropdownColorScheme,
  type CodeBlockColorScheme,
} from '@/lib/colors'

describe('Color Constants Exports', () => {
  test('exports all required color constants', () => {
    // Verify all color groups are exported
    expect(statusColors, 'statusColors should be exported').toBeDefined()
    expect(buttonVariants, 'buttonVariants should be exported').toBeDefined()
    expect(metricColors, 'metricColors should be exported').toBeDefined()
    expect(errorColors, 'errorColors should be exported').toBeDefined()
    expect(successColors, 'successColors should be exported').toBeDefined()
    expect(warningColors, 'warningColors should be exported').toBeDefined()
    expect(infoColors, 'infoColors should be exported').toBeDefined()
    expect(bgColors, 'bgColors should be exported').toBeDefined()
    expect(textColors, 'textColors should be exported').toBeDefined()
    expect(borderColors, 'borderColors should be exported').toBeDefined()
    expect(interactiveStates, 'interactiveStates should be exported').toBeDefined()
    expect(colorPalette, 'colorPalette should be exported').toBeDefined()
    expect(accentColors, 'accentColors should be exported').toBeDefined()
    expect(darkModeAccentColors, 'darkModeAccentColors should be exported').toBeDefined()
    expect(sidebarColors, 'sidebarColors should be exported').toBeDefined()
    expect(darkModeSidebarColors, 'darkModeSidebarColors should be exported').toBeDefined()
    expect(modalColors, 'modalColors should be exported').toBeDefined()
    expect(darkModeModalColors, 'darkModeModalColors should be exported').toBeDefined()
    expect(tableColors, 'tableColors should be exported').toBeDefined()
    expect(darkModeTableColors, 'darkModeTableColors should be exported').toBeDefined()
    expect(kanbanColors, 'kanbanColors should be exported').toBeDefined()
    expect(darkModeKanbanColors, 'darkModeKanbanColors should be exported').toBeDefined()
    expect(chatColors, 'chatColors should be exported').toBeDefined()
    expect(darkModeChatColors, 'darkModeChatColors should be exported').toBeDefined()
    expect(dropdownColors, 'dropdownColors should be exported').toBeDefined()
    expect(darkModeDropdownColors, 'darkModeDropdownColors should be exported').toBeDefined()
    expect(codeBlockColors, 'codeBlockColors should be exported').toBeDefined()
    expect(darkModeCodeBlockColors, 'darkModeCodeBlockColors should be exported').toBeDefined()
    expect(darkModeColors, 'darkModeColors should be exported').toBeDefined()
  })

  test('exports have correct TypeScript types', () => {
    // Verify status colors conform to StatusColorScheme
    Object.values(statusColors).forEach((color, index) => {
      expect(
        color.bg && color.text && color.border && color.solid && color.label,
        `Status color at index ${index} should have all required properties (bg, text, border, solid, label)`
      ).toBeTruthy()
    })

    // Verify button variants conform to ButtonColorScheme
    Object.values(buttonVariants).forEach((variant, index) => {
      expect(
        variant.bg && variant.text && variant.border && variant.hoverBg,
        `Button variant at index ${index} should have all required properties (bg, text, border, hoverBg)`
      ).toBeTruthy()
    })
  })
})

describe('Status Colors', () => {
  test('status colors match Tailwind class patterns', () => {
    const tailwindPattern = /^(bg|text|border|hover:)-[a-z]+-\d+$/

    Object.entries(statusColors).forEach(([status, colors]) => {
      expect(
        colors.bg,
        `Status "${status}" bg should match Tailwind pattern`
      ).toMatch(tailwindPattern)

      expect(
        colors.text,
        `Status "${status}" text should match Tailwind pattern`
      ).toMatch(tailwindPattern)

      expect(
        colors.border,
        `Status "${status}" border should match Tailwind pattern`
      ).toMatch(tailwindPattern)

      expect(
        colors.solid,
        `Status "${status}" solid should match Tailwind pattern`
      ).toMatch(tailwindPattern)

      expect(
        colors.label,
        `Status "${status}" should have a human-readable label`
      ).toBeTruthy()
    })
  })

  test('all required status colors exist', () => {
    const requiredStatuses = [
      'pending',
      'running',
      'success',
      'failed',
      'timeout',
      'approved',
      'denied',
      'unknown',
    ]

    requiredStatuses.forEach((status) => {
      expect(
        statusColors[status],
        `Status "${status}" should be defined in statusColors`
      ).toBeDefined()
    })

    // Verify no extra statuses are defined
    const definedStatuses = Object.keys(statusColors)
    const extraStatuses = definedStatuses.filter(
      (s) => !requiredStatuses.includes(s)
    )

    expect(
      extraStatuses.length,
      `Unexpected status colors found: ${extraStatuses.join(', ')}`
    ).toBe(0)
  })

  test('status colors use consistent shade values', () => {
    // Verify status colors follow the pattern: bg-50, text-700, border-200, solid-500
    // Note: 'unknown' status is exempt as it's a special fallback state
    const exemptStatuses = ['unknown']

    Object.entries(statusColors).forEach(([status, colors]) => {
      if (exemptStatuses.includes(status)) {
        return
      }

      // Extract shade numbers from color classes
      const bgShade = colors.bg.match(/-(\d+)$/)?.[1]
      const textShade = colors.text.match(/-(\d+)$/)?.[1]
      const borderShade = colors.border.match(/-(\d+)$/)?.[1]
      const solidShade = colors.solid.match(/-(\d+)$/)?.[1]

      expect(
        bgShade,
        `Status "${status}" bg should use shade 50, got ${colors.bg}`
      ).toBe('50')

      expect(
        textShade,
        `Status "${status}" text should use shade 700, got ${colors.text}`
      ).toBe('700')

      expect(
        borderShade,
        `Status "${status}" border should use shade 200, got ${colors.border}`
      ).toBe('200')

      expect(
        solidShade,
        `Status "${status}" solid should use shade 500, got ${colors.solid}`
      ).toBe('500')
    })
  })

  test('related status colors share color families', () => {
    // Success and approved should share green colors
    expect(
      statusColors.success.bg,
      'success and approved should share the same background color'
    ).toBe(statusColors.approved.bg)
    expect(
      statusColors.success.text,
      'success and approved should share the same text color'
    ).toBe(statusColors.approved.text)

    // Failed and denied should share red colors
    expect(
      statusColors.failed.bg,
      'failed and denied should share the same background color'
    ).toBe(statusColors.denied.bg)
    expect(
      statusColors.failed.text,
      'failed and denied should share the same text color'
    ).toBe(statusColors.denied.text)
  })
})

describe('Button Variants', () => {
  test('all required button variants exist', () => {
    const requiredVariants = ['primary', 'secondary', 'danger', 'ghost']

    requiredVariants.forEach((variant) => {
      expect(
        buttonVariants[variant],
        `Button variant "${variant}" should be defined`
      ).toBeDefined()
    })

    // Verify no extra variants are defined
    const definedVariants = Object.keys(buttonVariants)
    const extraVariants = definedVariants.filter(
      (v) => !requiredVariants.includes(v)
    )

    expect(
      extraVariants.length,
      `Unexpected button variants found: ${extraVariants.join(', ')}`
    ).toBe(0)
  })

  test('button variants have all required states', () => {
    Object.entries(buttonVariants).forEach(([variant, colors]) => {
      expect(
        colors.bg,
        `Button variant "${variant}" should have bg property`
      ).toBeDefined()
      expect(
        colors.bg.startsWith('bg-'),
        `Button variant "${variant}" bg should start with "bg-"`
      ).toBeTruthy()

      expect(
        colors.text,
        `Button variant "${variant}" should have text property`
      ).toBeDefined()
      expect(
        colors.text.startsWith('text-'),
        `Button variant "${variant}" text should start with "text-"`
      ).toBeTruthy()

      expect(
        colors.border,
        `Button variant "${variant}" should have border property`
      ).toBeDefined()
      expect(
        colors.border.startsWith('border-'),
        `Button variant "${variant}" border should start with "border-"`
      ).toBeTruthy()

      expect(
        colors.hoverBg,
        `Button variant "${variant}" should have hoverBg property`
      ).toBeDefined()
      expect(
        colors.hoverBg.startsWith('hover:bg-'),
        `Button variant "${variant}" hoverBg should start with "hover:bg-"`
      ).toBeTruthy()
    })
  })

  test('button variants use Tailwind classes', () => {
    // Pattern matches: bg-gray-900, text-white, border-transparent
    // Handles both shaded colors and special colors like white/transparent
    const tailwindPattern = /^(bg|text|border)-(white|black|transparent|[a-z]+-\d+)$/
    const hoverPattern = /^hover:bg-(white|black|[a-z]+-\d+)$/

    Object.entries(buttonVariants).forEach(([variant, colors]) => {
      expect(
        colors.bg,
        `Button variant "${variant}" bg should be a valid Tailwind class`
      ).toMatch(tailwindPattern)

      expect(
        colors.text,
        `Button variant "${variant}" text should be a valid Tailwind class`
      ).toMatch(tailwindPattern)

      expect(
        colors.border,
        `Button variant "${variant}" border should be a valid Tailwind class`
      ).toMatch(tailwindPattern)

      expect(
        colors.hoverBg,
        `Button variant "${variant}" hoverBg should be a valid hover class`
      ).toMatch(hoverPattern)

      if (colors.hoverText) {
        expect(
          colors.hoverText,
          `Button variant "${variant}" hoverText should be a valid hover class`
        ).toMatch(/^hover:text-(white|black|[a-z]+-\d+)$/)
      }
    })
  })
})

describe('Color Consistency', () => {
  test('colors use consistent shade values across semantic groups', () => {
    // Verify semantic colors follow consistent patterns
    const semanticGroups = [
      { name: 'errorColors', colors: errorColors },
      { name: 'successColors', colors: successColors },
      { name: 'warningColors', colors: warningColors },
      { name: 'infoColors', colors: infoColors },
    ]

    semanticGroups.forEach(({ name, colors }) => {
      // Text should be shade 600
      expect(
        colors.text.endsWith('-600'),
        `${name}.text should use shade 600, got ${colors.text}`
      ).toBeTruthy()

      // Text alt should be shade 700
      expect(
        colors.textAlt.endsWith('-700'),
        `${name}.textAlt should use shade 700, got ${colors.textAlt}`
      ).toBeTruthy()

      // Bg should be shade 50
      expect(
        colors.bg.endsWith('-50'),
        `${name}.bg should use shade 50, got ${colors.bg}`
      ).toBeTruthy()

      // Border should be either shade 200 or 300 (both are acceptable for emphasis)
      const borderShade = colors.border.match(/-(\d+)$/)?.[1]
      expect(
        borderShade === '200' || borderShade === '300',
        `${name}.border should use shade 200 or 300, got ${colors.border}`
      ).toBeTruthy()
    })
  })

  test('no duplicate color definitions across semantic names', () => {
    // Collect all color values from semantic groups
    const allColors = new Map<string, string[]>()

    const semanticGroups = [
      errorColors,
      successColors,
      warningColors,
      infoColors,
    ]

    semanticGroups.forEach((colorGroup) => {
      Object.entries(colorGroup).forEach(([key, value]) => {
        if (typeof value === 'string') {
          if (!allColors.has(value)) {
            allColors.set(value, [])
          }
          allColors.get(value)!.push(key)
        }
      })
    })

    // Check for duplicates across different semantic names
    const duplicates: Array<{ color: string; usages: string[] }> = []

    allColors.forEach((usages, color) => {
      if (usages.length > 1) {
        // Check if the same color is used for different semantic purposes
        const uniqueSemanticGroups = new Set(
          usages.map((usage) => usage.split(/[A-Z]/)[0])
        )

        if (uniqueSemanticGroups.size > 1) {
          duplicates.push({ color, usages })
        }
      }
    })

    expect(
      duplicates.length,
      `Found duplicate color values across different semantic meanings:\n${duplicates
        .map(
          (d) =>
            `  - ${d.color}: used for ${d.usages.join(', ')}`
        )
        .join('\n')}`
    ).toBe(0)
  })

  test('color palette has complete shade ranges', () => {
    const colorFamilies = ['gray', 'blue', 'green', 'red', 'amber', 'yellow'] as Array<keyof typeof colorPalette>
    const expectedShades = ['50', '100', '200', '300', '400', '500', '600', '700', '800']

    colorFamilies.forEach((family) => {
      expect(
        colorPalette[family],
        `Color palette should have ${family} color family`
      ).toBeDefined()

      expectedShades.forEach((shade) => {
        expect(
          colorPalette[family][shade as '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800'],
          `Color palette ${family} should have shade ${shade}`
        ).toBeDefined()
      })
    })
  })
})

describe('Neutral Colors', () => {
  test('background colors have hierarchical structure', () => {
    expect(bgColors.primary, 'bgColors.primary should be defined').toBeDefined()
    expect(
      bgColors.secondary,
      'bgColors.secondary should be defined'
    ).toBeDefined()
    expect(
      bgColors.tertiary,
      'bgColors.tertiary should be defined'
    ).toBeDefined()
    expect(
      bgColors.inverted,
      'bgColors.inverted should be defined'
    ).toBeDefined()

    // Verify they're all different (hierarchical)
    const bgValues = Object.values(bgColors)
    const uniqueBgValues = new Set(bgValues)

    expect(
      uniqueBgValues.size,
      'Background colors should all be unique (hierarchical)'
    ).toBe(bgValues.length)
  })

  test('text colors have hierarchical structure', () => {
    const requiredTextColors = [
      'primary',
      'secondary',
      'tertiary',
      'muted',
      'veryMuted',
      'inverted',
    ] as Array<keyof typeof textColors>

    requiredTextColors.forEach((key) => {
      expect(
        textColors[key],
        `textColors.${key} should be defined`
      ).toBeDefined()
    })

    // Verify they all start with 'text-'
    Object.entries(textColors).forEach(([key, value]) => {
      expect(
        value.startsWith('text-'),
        `textColors.${key} should start with "text-"`
      ).toBeTruthy()
    })
  })

  test('border colors have varying weights', () => {
    const requiredBorderColors = [
      'default',
      'thick',
      'subtle',
      'strong',
      'transparent',
    ] as Array<keyof typeof borderColors>

    requiredBorderColors.forEach((key) => {
      expect(
        borderColors[key],
        `borderColors.${key} should be defined`
      ).toBeDefined()
    })

    // Verify they all start with 'border-'
    Object.entries(borderColors).forEach(([key, value]) => {
      expect(
        value.startsWith('border-'),
        `borderColors.${key} should start with "border-"`
      ).toBeTruthy()
    })
  })
})

describe('Interactive States', () => {
  test('interactive states have all required properties', () => {
    expect(
      interactiveStates.focusRing,
      'interactiveStates.focusRing should be defined'
    ).toBeDefined()
    expect(
      interactiveStates.focusRingAlt,
      'interactiveStates.focusRingAlt should be defined'
    ).toBeDefined()
    expect(
      interactiveStates.hoverBg,
      'interactiveStates.hoverBg should be defined'
    ).toBeDefined()
    expect(
      interactiveStates.disabled,
      'interactiveStates.disabled should be defined'
    ).toBeDefined()
  })

  test('interactive states use correct pseudo-classes', () => {
    expect(
      interactiveStates.focusRing.startsWith('ring-'),
      'focusRing should start with "ring-"'
    ).toBeTruthy()

    expect(
      interactiveStates.focusRingAlt?.startsWith('ring-'),
      'focusRingAlt should start with "ring-"'
    ).toBeTruthy()

    expect(
      interactiveStates.hoverBg.startsWith('hover:'),
      'hoverBg should start with "hover:"'
    ).toBeTruthy()

    expect(
      interactiveStates.disabled.startsWith('disabled:'),
      'disabled should start with "disabled:"'
    ).toBeTruthy()
  })

  test('focus rings use orange brand accent color', () => {
    expect(
      interactiveStates.focusRing,
      'focusRing should use orange brand color'
    ).toContain('orange')

    expect(
      interactiveStates.focusRingAlt,
      'focusRingAlt should use amber/orange brand color'
    ).toMatch(/orange|amber/)
  })
})

describe('Accent / Brand Colors', () => {
  test('accent colors are defined with all required properties', () => {
    const requiredProps: (keyof AccentColorScheme)[] = [
      'bg', 'text', 'border', 'solid', 'bgSubtle',
      'textOnDark', 'borderOnDark', 'hoverBg',
      'focusRing', 'gradientFrom', 'gradientTo',
    ]

    requiredProps.forEach((prop) => {
      expect(
        accentColors[prop],
        `accentColors.${prop} should be defined`
      ).toBeDefined()
    })
  })

  test('accent colors use orange color family', () => {
    const orangeFields = ['bg', 'text', 'border', 'solid', 'bgSubtle', 'hoverBg', 'focusRing']
    orangeFields.forEach((field) => {
      const value = accentColors[field as keyof AccentColorScheme]
      expect(
        value.includes('orange') || value.includes('amber'),
        `accentColors.${field} should use orange or amber, got: ${value}`
      ).toBeTruthy()
    })
  })

  test('dark mode accent colors are defined', () => {
    const requiredProps: (keyof AccentColorScheme)[] = [
      'bg', 'text', 'border', 'solid', 'bgSubtle',
      'textOnDark', 'borderOnDark', 'hoverBg',
      'focusRing', 'gradientFrom', 'gradientTo',
    ]

    requiredProps.forEach((prop) => {
      expect(
        darkModeAccentColors[prop],
        `darkModeAccentColors.${prop} should be defined`
      ).toBeDefined()
    })
  })

  test('primary button uses orange brand color', () => {
    expect(
      buttonVariants.primary.bg,
      'Primary button should use orange background'
    ).toContain('orange')
  })
})

describe('Metric Colors', () => {
  test('metric colors have all required variants', () => {
    const requiredMetrics = ['default', 'green', 'red', 'amber']

    requiredMetrics.forEach((metric) => {
      expect(
        metricColors[metric],
        `Metric color "${metric}" should be defined`
      ).toBeDefined()
    })

    // Verify no extra metrics are defined
    const definedMetrics = Object.keys(metricColors)
    const extraMetrics = definedMetrics.filter((m) => !requiredMetrics.includes(m))

    expect(
      extraMetrics.length,
      `Unexpected metric colors found: ${extraMetrics.join(', ')}`
    ).toBe(0)
  })

  test('metric colors use appropriate shade values', () => {
    // Default metric can use any shade (typically darker for neutral)
    // Colored metrics (green, red, amber) should use 600 for consistency
    const coloredMetrics = ['green', 'red', 'amber']

    coloredMetrics.forEach((metric) => {
      expect(
        metricColors[metric].text.endsWith('-600'),
        `Metric color "${metric}" should use shade 600, got ${metricColors[metric].text}`
      ).toBeTruthy()
    })

    // Default should exist but can use different shade
    expect(
      metricColors.default.text.match(/text-gray-\d+/),
      'Metric color "default" should be a gray shade'
    ).toBeTruthy()
  })
})

describe('Color Format Validation', () => {
  test('all color strings follow Tailwind CSS format', () => {
    // Pattern matches:
    // - bg-gray-50, text-blue-600 (with shades)
    // - bg-white, text-black (special colors)
    // - border-transparent (utilities)
    // - hover:bg-gray-50, disabled:opacity-50 (pseudo-classes)
    const tailwindClassPattern =
      /^(hover:|disabled:)?(bg|text|border|ring)-(white|black|transparent|[a-z]+-\d+)$|^disabled:opacity-\d+$/

    // Collect all color values from all exports
    const allColorObjects = [
      statusColors,
      buttonVariants,
      metricColors,
      errorColors,
      successColors,
      warningColors,
      infoColors,
      bgColors,
      textColors,
      borderColors,
      interactiveStates,
    ]

    let invalidColors: Array<{ path: string; value: string }> = []

    allColorObjects.forEach((colorObj, objIndex) => {
      const objName = Object.keys({ statusColors, buttonVariants, metricColors, errorColors, successColors, warningColors, infoColors, bgColors, textColors, borderColors, interactiveStates })[objIndex]

      Object.entries(colorObj).forEach(([key, value]) => {
        if (typeof value === 'string') {
          if (!tailwindClassPattern.test(value)) {
            invalidColors.push({ path: `${objName}.${key}`, value })
          }
        }
      })
    })

    expect(
      invalidColors.length,
      `All color values should follow Tailwind CSS format. Invalid colors found:\n${invalidColors
        .map((c) => `  - ${c.path}: "${c.value}"`)
        .join('\n')}`
    ).toBe(0)
  })
})

describe('Type Safety', () => {
  test('status colors have correct TypeScript interface', () => {
    const sampleStatus: StatusColorScheme = {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      solid: 'bg-green-500',
      label: 'Test',
    }

    expect(sampleStatus).toBeDefined()
    expect(sampleStatus.bg).toBeTruthy()
    expect(sampleStatus.text).toBeTruthy()
    expect(sampleStatus.border).toBeTruthy()
    expect(sampleStatus.solid).toBeTruthy()
    expect(sampleStatus.label).toBeTruthy()
  })

  test('button variants have correct TypeScript interface', () => {
    const sampleVariant: ButtonColorScheme = {
      bg: 'bg-white',
      text: 'text-gray-700',
      border: 'border-gray-300',
      hoverBg: 'hover:bg-gray-50',
    }

    expect(sampleVariant).toBeDefined()
    expect(sampleVariant.bg).toBeTruthy()
    expect(sampleVariant.text).toBeTruthy()
    expect(sampleVariant.border).toBeTruthy()
    expect(sampleVariant.hoverBg).toBeTruthy()
  })

  test('sidebar colors have correct TypeScript interface', () => {
    const sample: SidebarColorScheme = {
      bg: 'bg-gray-900',
      text: 'text-gray-300',
      activeItem: 'bg-gray-800 text-white border-orange-500',
      hoverItem: 'hover:bg-gray-800',
      divider: 'border-gray-800',
    }

    expect(sample).toBeDefined()
    expect(sample.bg).toBeTruthy()
    expect(sample.text).toBeTruthy()
    expect(sample.activeItem).toBeTruthy()
    expect(sample.hoverItem).toBeTruthy()
    expect(sample.divider).toBeTruthy()
  })

  test('modal colors have correct TypeScript interface', () => {
    const sample: ModalColorScheme = {
      overlay: 'bg-black/50',
      panel: 'bg-white',
      border: 'border-gray-200',
      header: 'text-gray-900',
    }

    expect(sample).toBeDefined()
    expect(sample.overlay).toBeTruthy()
    expect(sample.panel).toBeTruthy()
    expect(sample.border).toBeTruthy()
    expect(sample.header).toBeTruthy()
  })

  test('table colors have correct TypeScript interface', () => {
    const sample: TableColorScheme = {
      headerBg: 'bg-gray-50',
      headerText: 'text-gray-600',
      rowBg: 'bg-white',
      rowAltBg: 'bg-gray-50',
      rowHover: 'hover:bg-gray-50',
      border: 'border-gray-200',
    }

    expect(sample).toBeDefined()
    expect(sample.headerBg).toBeTruthy()
    expect(sample.headerText).toBeTruthy()
    expect(sample.rowBg).toBeTruthy()
    expect(sample.rowAltBg).toBeTruthy()
    expect(sample.rowHover).toBeTruthy()
    expect(sample.border).toBeTruthy()
  })

  test('kanban colors have correct TypeScript interface', () => {
    const sample: KanbanColorScheme = {
      columnBg: 'bg-gray-100',
      cardBg: 'bg-white',
      cardBorder: 'border-gray-200',
      columnHeader: 'text-gray-700',
    }

    expect(sample).toBeDefined()
    expect(sample.columnBg).toBeTruthy()
    expect(sample.cardBg).toBeTruthy()
    expect(sample.cardBorder).toBeTruthy()
    expect(sample.columnHeader).toBeTruthy()
  })

  test('chat colors have correct TypeScript interface', () => {
    const sample: ChatColorScheme = {
      ownBubble: 'bg-orange-600 text-white',
      otherBubble: 'bg-gray-100 text-gray-900',
      inputBg: 'bg-white',
      inputBorder: 'border-gray-200',
    }

    expect(sample).toBeDefined()
    expect(sample.ownBubble).toBeTruthy()
    expect(sample.otherBubble).toBeTruthy()
    expect(sample.inputBg).toBeTruthy()
    expect(sample.inputBorder).toBeTruthy()
  })

  test('dropdown colors have correct TypeScript interface', () => {
    const sample: DropdownColorScheme = {
      bg: 'bg-white',
      border: 'border-gray-200',
      itemHover: 'hover:bg-gray-100',
      itemText: 'text-gray-700',
      itemChecked: 'data-[state=checked]:bg-orange-50 data-[state=checked]:text-orange-700',
      divider: 'border-gray-100',
    }

    expect(sample).toBeDefined()
    expect(sample.bg).toBeTruthy()
    expect(sample.border).toBeTruthy()
    expect(sample.itemHover).toBeTruthy()
    expect(sample.itemText).toBeTruthy()
    expect(sample.itemChecked).toBeTruthy()
    expect(sample.divider).toBeTruthy()
  })

  test('code block colors have correct TypeScript interface', () => {
    const sample: CodeBlockColorScheme = {
      bg: 'bg-gray-900',
      text: 'text-gray-100',
    }

    expect(sample).toBeDefined()
    expect(sample.bg).toBeTruthy()
    expect(sample.text).toBeTruthy()
  })
})

describe('Sidebar Colors', () => {
  test('light mode sidebar colors have all required properties', () => {
    expect(sidebarColors.bg).toBeDefined()
    expect(sidebarColors.text).toBeDefined()
    expect(sidebarColors.activeItem).toBeDefined()
    expect(sidebarColors.hoverItem).toBeDefined()
    expect(sidebarColors.divider).toBeDefined()
  })

  test('light mode sidebar uses dark background', () => {
    expect(sidebarColors.bg).toBe('bg-gray-900')
  })

  test('dark mode sidebar colors have all required properties', () => {
    expect(darkModeSidebarColors.bg).toBeDefined()
    expect(darkModeSidebarColors.text).toBeDefined()
    expect(darkModeSidebarColors.activeItem).toBeDefined()
    expect(darkModeSidebarColors.hoverItem).toBeDefined()
    expect(darkModeSidebarColors.divider).toBeDefined()
  })

  test('dark mode sidebar uses near-black background', () => {
    expect(darkModeSidebarColors.bg).toBe('dark:bg-gray-950')
  })
})

describe('Modal Colors', () => {
  test('light mode modal colors have all required properties', () => {
    expect(modalColors.overlay).toBeDefined()
    expect(modalColors.panel).toBeDefined()
    expect(modalColors.border).toBeDefined()
    expect(modalColors.header).toBeDefined()
  })

  test('light mode modal uses white panel', () => {
    expect(modalColors.panel).toBe('bg-white')
  })

  test('dark mode modal colors have all required properties', () => {
    expect(darkModeModalColors.overlay).toBeDefined()
    expect(darkModeModalColors.panel).toBeDefined()
    expect(darkModeModalColors.border).toBeDefined()
    expect(darkModeModalColors.header).toBeDefined()
  })

  test('dark mode modal uses darker overlay', () => {
    expect(darkModeModalColors.overlay).toBe('dark:bg-black/70')
  })
})

describe('Table Colors', () => {
  test('light mode table colors have all required properties', () => {
    expect(tableColors.headerBg).toBeDefined()
    expect(tableColors.headerText).toBeDefined()
    expect(tableColors.rowBg).toBeDefined()
    expect(tableColors.rowAltBg).toBeDefined()
    expect(tableColors.rowHover).toBeDefined()
    expect(tableColors.border).toBeDefined()
  })

  test('light mode table uses white rows', () => {
    expect(tableColors.rowBg).toBe('bg-white')
  })

  test('dark mode table colors have all required properties', () => {
    expect(darkModeTableColors.headerBg).toBeDefined()
    expect(darkModeTableColors.headerText).toBeDefined()
    expect(darkModeTableColors.rowBg).toBeDefined()
    expect(darkModeTableColors.rowAltBg).toBeDefined()
    expect(darkModeTableColors.rowHover).toBeDefined()
    expect(darkModeTableColors.border).toBeDefined()
  })

  test('dark mode table uses near-black rows', () => {
    expect(darkModeTableColors.rowBg).toBe('dark:bg-gray-950')
  })
})

describe('Kanban Colors', () => {
  test('light mode kanban colors have all required properties', () => {
    expect(kanbanColors.columnBg).toBeDefined()
    expect(kanbanColors.cardBg).toBeDefined()
    expect(kanbanColors.cardBorder).toBeDefined()
    expect(kanbanColors.columnHeader).toBeDefined()
  })

  test('light mode kanban uses white cards', () => {
    expect(kanbanColors.cardBg).toBe('bg-white')
  })

  test('dark mode kanban colors have all required properties', () => {
    expect(darkModeKanbanColors.columnBg).toBeDefined()
    expect(darkModeKanbanColors.cardBg).toBeDefined()
    expect(darkModeKanbanColors.cardBorder).toBeDefined()
    expect(darkModeKanbanColors.columnHeader).toBeDefined()
  })

  test('dark mode kanban uses gray-800 cards', () => {
    expect(darkModeKanbanColors.cardBg).toBe('dark:bg-gray-800')
  })
})

describe('Chat Colors', () => {
  test('light mode chat colors have all required properties', () => {
    expect(chatColors.ownBubble).toBeDefined()
    expect(chatColors.otherBubble).toBeDefined()
    expect(chatColors.inputBg).toBeDefined()
    expect(chatColors.inputBorder).toBeDefined()
  })

  test('own bubble uses orange brand color', () => {
    expect(chatColors.ownBubble).toContain('orange')
    expect(chatColors.ownBubble).toContain('white')
  })

  test('dark mode chat colors have all required properties', () => {
    expect(darkModeChatColors.ownBubble).toBeDefined()
    expect(darkModeChatColors.otherBubble).toBeDefined()
    expect(darkModeChatColors.inputBg).toBeDefined()
    expect(darkModeChatColors.inputBorder).toBeDefined()
  })

  test('dark mode own bubble maintains orange brand', () => {
    expect(darkModeChatColors.ownBubble).toContain('orange')
  })
})

describe('Dropdown Colors', () => {
  test('light mode dropdown colors have all required properties', () => {
    expect(dropdownColors.bg).toBeDefined()
    expect(dropdownColors.border).toBeDefined()
    expect(dropdownColors.itemHover).toBeDefined()
    expect(dropdownColors.itemText).toBeDefined()
    expect(dropdownColors.itemChecked).toBeDefined()
    expect(dropdownColors.divider).toBeDefined()
  })

  test('light mode dropdown uses white background', () => {
    expect(dropdownColors.bg).toBe('bg-white')
  })

  test('dark mode dropdown colors have all required properties', () => {
    expect(darkModeDropdownColors.bg).toBeDefined()
    expect(darkModeDropdownColors.border).toBeDefined()
    expect(darkModeDropdownColors.itemHover).toBeDefined()
    expect(darkModeDropdownColors.itemText).toBeDefined()
    expect(darkModeDropdownColors.itemChecked).toBeDefined()
    expect(darkModeDropdownColors.divider).toBeDefined()
  })

  test('dark mode dropdown uses gray-800 background', () => {
    expect(darkModeDropdownColors.bg).toBe('dark:bg-gray-800')
  })
})

describe('Code Block Colors', () => {
  test('light mode code block colors have all required properties', () => {
    expect(codeBlockColors.bg).toBeDefined()
    expect(codeBlockColors.text).toBeDefined()
  })

  test('light mode code block uses dark background', () => {
    expect(codeBlockColors.bg).toBe('bg-gray-900')
  })

  test('dark mode code block colors have all required properties', () => {
    expect(darkModeCodeBlockColors.bg).toBeDefined()
    expect(darkModeCodeBlockColors.text).toBeDefined()
  })

  test('dark mode code block uses near-black background', () => {
    expect(darkModeCodeBlockColors.bg).toBe('dark:bg-gray-950')
  })
})

describe('Dark Mode Colors Aggregation', () => {
  test('darkModeColors includes all new token groups', () => {
    const requiredKeys = [
      'sidebar',
      'modal',
      'table',
      'kanban',
      'chat',
      'dropdown',
      'codeBlock',
    ]

    requiredKeys.forEach((key) => {
      expect(
        (darkModeColors as Record<string, unknown>)[key],
        `darkModeColors should include "${key}"`
      ).toBeDefined()
    })
  })

  test('darkModeColors sidebar references darkModeSidebarColors', () => {
    expect(darkModeColors.sidebar).toBe(darkModeSidebarColors)
  })

  test('darkModeColors modal references darkModeModalColors', () => {
    expect(darkModeColors.modal).toBe(darkModeModalColors)
  })

  test('darkModeColors table references darkModeTableColors', () => {
    expect(darkModeColors.table).toBe(darkModeTableColors)
  })

  test('darkModeColors kanban references darkModeKanbanColors', () => {
    expect(darkModeColors.kanban).toBe(darkModeKanbanColors)
  })

  test('darkModeColors chat references darkModeChatColors', () => {
    expect(darkModeColors.chat).toBe(darkModeChatColors)
  })

  test('darkModeColors dropdown references darkModeDropdownColors', () => {
    expect(darkModeColors.dropdown).toBe(darkModeDropdownColors)
  })

  test('darkModeColors codeBlock references darkModeCodeBlockColors', () => {
    expect(darkModeColors.codeBlock).toBe(darkModeCodeBlockColors)
  })
})
