/**
 * TypeScript Basic Test Example
 *
 * This example demonstrates basic TypeScript test patterns using Vitest.
 * Use this as a reference for writing simple unit tests in TypeScript.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// =============================================================================
// EXAMPLE: Simple Function Tests
// =============================================================================

function addNumbers(a: number, b: number): number {
  return a + b
}

function formatName(first: string, last: string): string {
  return `${first} ${last}`
}

describe('Simple Functions', () => {
  describe('addNumbers', () => {
    it('should add two positive integers', () => {
      // Arrange
      const num1 = 5
      const num2 = 10

      // Act
      const result = addNumbers(num1, num2)

      // Assert
      expect(result).toBe(15)
      expect(typeof result).toBe('number')
    })

    it('should add negative integers', () => {
      // Arrange
      const num1 = -5
      const num2 = -10

      // Act
      const result = addNumbers(num1, num2)

      // Assert
      expect(result).toBe(-15)
    })

    it('should handle adding zero', () => {
      // Arrange
      const num1 = 5
      const num2 = 0

      // Act
      const result = addNumbers(num1, num2)

      // Assert
      expect(result).toBe(5)
    })
  })

  describe('formatName', () => {
    it('should format name with valid inputs', () => {
      // Arrange
      const firstName = 'John'
      const lastName = 'Doe'

      // Act
      const result = formatName(firstName, lastName)

      // Assert
      expect(result).toBe('John Doe')
      expect(result).toContain(' ')
      expect(result.startsWith(firstName)).toBe(true)
      expect(result.endsWith(lastName)).toBe(true)
    })
  })
})

// =============================================================================
// EXAMPLE: Parameterized Tests
// =============================================================================

function multiplyByTwo(x: number): number {
  return x * 2
}

describe('Parameterized Tests', () => {
  describe('multiplyByTwo', () => {
    it.each([
      [1, 2],
      [2, 4],
      [5, 10],
      [10, 20],
      [-3, -6],
    ])('should multiply %i by 2 to get %i', (inputValue: number, expected: number) => {
      // Arrange
      const testInput = inputValue

      // Act
      const result = multiplyByTwo(testInput)

      // Assert
      expect(result).toBe(expected)
    })

    it.each([
      { input: 1, expected: 2 },
      { input: 2, expected: 4 },
      { input: 5, expected: 10 },
    ])('should double $input to get $expected', ({ input, expected }: any) => {
      // Arrange
      const testInput = input

      // Act
      const result = multiplyByTwo(testInput)

      // Assert
      expect(result).toBe(expected)
    })
  })
})

// =============================================================================
// EXAMPLE: Error Handling Tests
// =============================================================================

function divideNumbers(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Cannot divide by zero')
  }
  return a / b
}

function validateEmail(email: string): boolean {
  if (!email) {
    throw new Error('Email cannot be empty')
  }
  if (!email.includes('@')) {
    throw new Error('Email must contain @')
  }
  return true
}

describe('Error Handling', () => {
  describe('divideNumbers', () => {
    it('should throw error when dividing by zero', () => {
      // Arrange
      const numerator = 10
      const denominator = 0

      // Act & Assert
      expect(() => divideNumbers(numerator, denominator)).toThrow('Cannot divide by zero')
      expect(() => divideNumbers(numerator, denominator)).toThrow(Error)
    })

    it('should divide numbers with valid inputs', () => {
      // Arrange
      const numerator = 10
      const denominator = 2

      // Act
      const result = divideNumbers(numerator, denominator)

      // Assert
      expect(result).toBe(5)
    })
  })

  describe('validateEmail', () => {
    it('should throw error for empty email', () => {
      // Arrange
      const emptyEmail = ''

      // Act & Assert
      expect(() => validateEmail(emptyEmail)).toThrow('Email cannot be empty')
    })

    it('should throw error for invalid email format', () => {
      // Arrange
      const invalidEmail = 'invalid-email'

      // Act & Assert
      expect(() => validateEmail(invalidEmail)).toThrow('Email must contain @')
    })

    it('should validate valid email', () => {
      // Arrange
      const validEmail = 'user@example.com'

      // Act
      const result = validateEmail(validEmail)

      // Assert
      expect(result).toBe(true)
    })
  })
})

// =============================================================================
// EXAMPLE: Array/Collection Tests
// =============================================================================

function filterEvenNumbers(numbers: number[]): number[] {
  return numbers.filter(num => num % 2 === 0)
}

function sumList(numbers: number[]): number {
  return numbers.reduce((sum, num) => sum + num, 0)
}

describe('Array Operations', () => {
  describe('filterEvenNumbers', () => {
    it('should filter even numbers from mixed list', () => {
      // Arrange
      const inputList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

      // Act
      const result = filterEvenNumbers(inputList)

      // Assert
      expect(result).toEqual([2, 4, 6, 8, 10])
      expect(result).toHaveLength(5)
      expect(result.every(num => num % 2 === 0)).toBe(true)
    })

    it('should handle empty list', () => {
      // Arrange
      const inputList: number[] = []

      // Act
      const result = filterEvenNumbers(inputList)

      // Assert
      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })

    it('should return empty list when all numbers are odd', () => {
      // Arrange
      const inputList = [1, 3, 5, 7, 9]

      // Act
      const result = filterEvenNumbers(inputList)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('sumList', () => {
    it('should sum list of positive numbers', () => {
      // Arrange
      const inputList = [1, 2, 3, 4, 5]

      // Act
      const result = sumList(inputList)

      // Assert
      expect(result).toBe(15)
    })

    it('should sum list with negative numbers', () => {
      // Arrange
      const inputList = [-1, -2, -3, -4, -5]

      // Act
      const result = sumList(inputList)

      // Assert
      expect(result).toBe(-15)
    })

    it('should return zero for empty list', () => {
      // Arrange
      const inputList: number[] = []

      // Act
      const result = sumList(inputList)

      // Assert
      expect(result).toBe(0)
    })
  })
})

// =============================================================================
// EXAMPLE: Object Tests
// =============================================================================

interface User {
  name?: string
  email?: string
}

function getUserName(user: User): string {
  return user.name ?? 'Unknown'
}

function mergeObjects(obj1: any, obj2: any): any {
  return { ...obj1, ...obj2 }
}

describe('Object Operations', () => {
  describe('getUserName', () => {
    it('should get name from valid user object', () => {
      // Arrange
      const user: User = { name: 'John Doe', email: 'john@example.com' }

      // Act
      const result = getUserName(user)

      // Assert
      expect(result).toBe('John Doe')
    })

    it('should return Unknown when name is missing', () => {
      // Arrange
      const user: User = { email: 'john@example.com' }

      // Act
      const result = getUserName(user)

      // Assert
      expect(result).toBe('Unknown')
    })

    it('should return Unknown when name is undefined', () => {
      // Arrange
      const user: User = {}

      // Act
      const result = getUserName(user)

      // Assert
      expect(result).toBe('Unknown')
    })
  })

  describe('mergeObjects', () => {
    it('should merge two objects', () => {
      // Arrange
      const obj1 = { a: 1, b: 2 }
      const obj2 = { c: 3, d: 4 }

      // Act
      const result = mergeObjects(obj1, obj2)

      // Assert
      expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 })
    })

    it('should handle overlapping keys', () => {
      // Arrange
      const obj1 = { a: 1, b: 2 }
      const obj2 = { b: 3, c: 4 }

      // Act
      const result = mergeObjects(obj1, obj2)

      // Assert
      expect(result).toEqual({ a: 1, b: 3, c: 4 })
      expect(result.b).toBe(3) // obj2's value takes precedence
    })
  })
})

// =============================================================================
// EXAMPLE: String Tests
// =============================================================================

function capitalizeWords(text: string): string {
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function reverseString(text: string): string {
  return text.split('').reverse().join('')
}

describe('String Operations', () => {
  describe('capitalizeWords', () => {
    it('should capitalize lowercase words', () => {
      // Arrange
      const inputText = 'hello world'

      // Act
      const result = capitalizeWords(inputText)

      // Assert
      expect(result).toBe('Hello World')
    })

    it('should capitalize mixed case words', () => {
      // Arrange
      const inputText = 'hELLO wORLD'

      // Act
      const result = capitalizeWords(inputText)

      // Assert
      expect(result).toBe('Hello World')
    })

    it('should handle empty string', () => {
      // Arrange
      const inputText = ''

      // Act
      const result = capitalizeWords(inputText)

      // Assert
      expect(result).toBe('')
    })

    it('should handle single word', () => {
      // Arrange
      const inputText = 'hello'

      // Act
      const result = capitalizeWords(inputText)

      // Assert
      expect(result).toBe('Hello')
    })
  })

  describe('reverseString', () => {
    it('should reverse a string', () => {
      // Arrange
      const inputText = 'hello'

      // Act
      const result = reverseString(inputText)

      // Assert
      expect(result).toBe('olleh')
    })

    it('should handle empty string', () => {
      // Arrange
      const inputText = ''

      // Act
      const result = reverseString(inputText)

      // Assert
      expect(result).toBe('')
    })

    it('should handle single character', () => {
      // Arrange
      const inputText = 'a'

      // Act
      const result = reverseString(inputText)

      // Assert
      expect(result).toBe('a')
    })
  })
})

// =============================================================================
// EXAMPLE: Async Function Tests
// =============================================================================

async function fetchData(id: string): Promise<{ id: string; data: string }> {
  // Simulate async operation
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ id, data: `Data for ${id}` })
    }, 100)
  })
}

async function fetchWithError(id: string): Promise<void> {
  // Simulate async error
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Failed to fetch'))
    }, 100)
  })
}

describe('Async Functions', () => {
  describe('fetchData', () => {
    it('should resolve with expected data', async () => {
      // Arrange
      const testId = 'test-123'

      // Act
      const result = await fetchData(testId)

      // Assert
      expect(result.id).toBe(testId)
      expect(result.data).toBe(`Data for ${testId}`)
    })

    it('should handle empty id', async () => {
      // Arrange
      const emptyId = ''

      // Act
      const result = await fetchData(emptyId)

      // Assert
      expect(result.id).toBe('')
      expect(result.data).toBe('Data for ')
    })
  })

  describe('fetchWithError', () => {
    it('should reject with error', async () => {
      // Arrange
      const testId = 'test-123'

      // Act & Assert
      await expect(fetchWithError(testId)).rejects.toThrow('Failed to fetch')
      await expect(fetchWithError(testId)).rejects.toThrow(Error)
    })
  })
})

// =============================================================================
// EXAMPLE: Mock Tests
// =============================================================================

// Mock object
const mockService = {
  getData: vi.fn(),
  postData: vi.fn(),
}

describe('Mock Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call mock function and return value', () => {
    // Arrange
    mockService.getData.mockReturnValue('mocked data')

    // Act
    const result = mockService.getData()

    // Assert
    expect(result).toBe('mocked data')
    expect(mockService.getData).toHaveBeenCalledTimes(1)
  })

  it('should call mock function with arguments', () => {
    // Arrange
    mockService.postData.mockReturnValue({ success: true })

    // Act
    const result = mockService.postData('test data')

    // Assert
    expect(result).toEqual({ success: true })
    expect(mockService.postData).toHaveBeenCalledWith('test data')
  })

  it('should handle mock function errors', () => {
    // Arrange
    mockService.getData.mockImplementation(() => {
      throw new Error('Service error')
    })

    // Act & Assert
    expect(() => mockService.getData()).toThrow('Service error')
  })

  it('should track multiple calls', () => {
    // Arrange
    mockService.getData.mockReturnValue('data')

    // Act
    mockService.getData()
    mockService.getData()
    mockService.getData()

    // Assert
    expect(mockService.getData).toHaveBeenCalledTimes(3)
  })
})

// =============================================================================
// RUNNING THE TESTS
// =============================================================================
//
// Run all tests in this file:
//   npm test -- tests/examples/typescript-basic-example.test.ts
//
// Run with verbose output:
//   npm test -- tests/examples/typescript-basic-example.test.ts --reporter=verbose
//
// Run specific test suite:
//   npm test -- tests/examples/typescript-basic-example.test.ts -t "Simple Functions"
//
// Run specific test:
//   npm test -- tests/examples/typescript-basic-example.test.ts -t "should add two positive integers"
//
// Run with coverage:
//   npm test -- tests/examples/typescript-basic-example.test.ts --coverage
//
// Run in watch mode:
//   npm test -- tests/examples/typescript-basic-example.test.ts --watch
//
// Run with UI:
//   npm test -- tests/examples/typescript-basic-example.test.ts --ui
// =============================================================================
