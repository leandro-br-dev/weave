#!/usr/bin/env python3
"""
Python Basic Test Example

This example demonstrates basic Python test patterns using pytest.
Use this as a reference for writing simple unit tests in Python.
"""

import pytest
from typing import Dict, List


# =============================================================================
# EXAMPLE: Simple Function Tests
# =============================================================================

def add_numbers(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b


def format_name(first: str, last: str) -> str:
    """Format a full name from first and last name."""
    return f"{first} {last}"


class TestSimpleFunctions:
    """Test suite for simple utility functions."""

    def test_add_numbers_with_positive_integers(self):
        """Test adding two positive integers."""
        # Arrange
        num1 = 5
        num2 = 10

        # Act
        result = add_numbers(num1, num2)

        # Assert
        assert result == 15
        assert isinstance(result, int)

    def test_add_numbers_with_negative_integers(self):
        """Test adding negative integers."""
        # Arrange
        num1 = -5
        num2 = -10

        # Act
        result = add_numbers(num1, num2)

        # Assert
        assert result == -15

    def test_add_numbers_with_zero(self):
        """Test adding zero."""
        # Arrange
        num1 = 5
        num2 = 0

        # Act
        result = add_numbers(num1, num2)

        # Assert
        assert result == 5

    def test_format_name_with_valid_inputs(self):
        """Test formatting name with valid inputs."""
        # Arrange
        first_name = "John"
        last_name = "Doe"

        # Act
        result = format_name(first_name, last_name)

        # Assert
        assert result == "John Doe"
        assert " " in result
        assert result.startswith(first_name)
        assert result.endswith(last_name)


# =============================================================================
# EXAMPLE: Parameterized Tests
# =============================================================================

def multiply_by_two(x: int) -> int:
    """Multiply a number by two."""
    return x * 2


class TestParameterizedTests:
    """Test suite demonstrating parameterized tests."""

    @pytest.mark.parametrize("input_value,expected", [
        (1, 2),
        (2, 4),
        (5, 10),
        (10, 20),
        (-3, -6),
    ])
    def test_multiply_by_two_with_various_inputs(self, input_value: int, expected: int):
        """Test multiply_by_two with various inputs."""
        # Arrange
        test_input = input_value

        # Act
        result = multiply_by_two(test_input)

        # Assert
        assert result == expected


# =============================================================================
# EXAMPLE: Error Handling Tests
# =============================================================================

def divide_numbers(a: int, b: int) -> float:
    """Divide two numbers."""
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b


def validate_email(email: str) -> bool:
    """Validate email format."""
    if not email:
        raise ValueError("Email cannot be empty")
    if "@" not in email:
        raise ValueError("Email must contain @")
    return True


class TestErrorHandling:
    """Test suite for error handling."""

    def test_divide_by_zero_raises_error(self):
        """Test that dividing by zero raises ValueError."""
        # Arrange
        numerator = 10
        denominator = 0

        # Act & Assert
        with pytest.raises(ValueError, match="Cannot divide by zero"):
            divide_numbers(numerator, denominator)

    def test_divide_with_valid_inputs(self):
        """Test division with valid inputs."""
        # Arrange
        numerator = 10
        denominator = 2

        # Act
        result = divide_numbers(numerator, denominator)

        # Assert
        assert result == 5.0

    def test_validate_empty_email_raises_error(self):
        """Test that empty email raises ValueError."""
        # Arrange
        empty_email = ""

        # Act & Assert
        with pytest.raises(ValueError, match="Email cannot be empty"):
            validate_email(empty_email)

    def test_validate_invalid_email_raises_error(self):
        """Test that invalid email format raises ValueError."""
        # Arrange
        invalid_email = "invalid-email"

        # Act & Assert
        with pytest.raises(ValueError, match="Email must contain @"):
            validate_email(invalid_email)

    def test_validate_valid_email_succeeds(self):
        """Test that valid email passes validation."""
        # Arrange
        valid_email = "user@example.com"

        # Act
        result = validate_email(valid_email)

        # Assert
        assert result is True


# =============================================================================
# EXAMPLE: List/Collection Tests
# =============================================================================

def filter_even_numbers(numbers: List[int]) -> List[int]:
    """Filter even numbers from a list."""
    return [num for num in numbers if num % 2 == 0]


def sum_list(numbers: List[int]) -> int:
    """Sum all numbers in a list."""
    return sum(numbers)


class TestListOperations:
    """Test suite for list/collection operations."""

    def test_filter_even_numbers_from_mixed_list(self):
        """Test filtering even numbers."""
        # Arrange
        input_list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

        # Act
        result = filter_even_numbers(input_list)

        # Assert
        assert result == [2, 4, 6, 8, 10]
        assert len(result) == 5
        assert all(num % 2 == 0 for num in result)

    def test_filter_even_numbers_from_empty_list(self):
        """Test filtering from empty list."""
        # Arrange
        input_list = []

        # Act
        result = filter_even_numbers(input_list)

        # Assert
        assert result == []
        assert len(result) == 0

    def test_filter_even_numbers_from_all_odd_list(self):
        """Test filtering when all numbers are odd."""
        # Arrange
        input_list = [1, 3, 5, 7, 9]

        # Act
        result = filter_even_numbers(input_list)

        # Assert
        assert result == []

    def test_sum_list_with_positive_numbers(self):
        """Test summing list of positive numbers."""
        # Arrange
        input_list = [1, 2, 3, 4, 5]

        # Act
        result = sum_list(input_list)

        # Assert
        assert result == 15

    def test_sum_list_with_negative_numbers(self):
        """Test summing list with negative numbers."""
        # Arrange
        input_list = [-1, -2, -3, -4, -5]

        # Act
        result = sum_list(input_list)

        # Assert
        assert result == -15


# =============================================================================
# EXAMPLE: Dictionary Tests
# =============================================================================

def get_user_name(user: Dict[str, str]) -> str:
    """Get user name from user dictionary."""
    return user.get('name', 'Unknown')


def merge_dicts(dict1: Dict, dict2: Dict) -> Dict:
    """Merge two dictionaries."""
    return {**dict1, **dict2}


class TestDictionaryOperations:
    """Test suite for dictionary operations."""

    def test_get_user_name_with_valid_user(self):
        """Test getting name from valid user dict."""
        # Arrange
        user = {'name': 'John Doe', 'email': 'john@example.com'}

        # Act
        result = get_user_name(user)

        # Assert
        assert result == 'John Doe'

    def test_get_user_name_with_missing_name(self):
        """Test getting name when name key is missing."""
        # Arrange
        user = {'email': 'john@example.com'}

        # Act
        result = get_user_name(user)

        # Assert
        assert result == 'Unknown'

    def test_merge_dicts(self):
        """Test merging two dictionaries."""
        # Arrange
        dict1 = {'a': 1, 'b': 2}
        dict2 = {'c': 3, 'd': 4}

        # Act
        result = merge_dicts(dict1, dict2)

        # Assert
        assert result == {'a': 1, 'b': 2, 'c': 3, 'd': 4}

    def test_merge_dicts_with_overlapping_keys(self):
        """Test merging dicts with overlapping keys."""
        # Arrange
        dict1 = {'a': 1, 'b': 2}
        dict2 = {'b': 3, 'c': 4}

        # Act
        result = merge_dicts(dict1, dict2)

        # Assert
        assert result == {'a': 1, 'b': 3, 'c': 4}
        assert result['b'] == 3  # dict2's value takes precedence


# =============================================================================
# EXAMPLE: String Tests
# =============================================================================

def capitalize_words(text: str) -> str:
    """Capitalize first letter of each word."""
    return ' '.join(word.capitalize() for word in text.split())


def reverse_string(text: str) -> str:
    """Reverse a string."""
    return text[::-1]


class TestStringOperations:
    """Test suite for string operations."""

    def test_capitalize_words_with_lowercase(self):
        """Test capitalizing lowercase words."""
        # Arrange
        input_text = "hello world"

        # Act
        result = capitalize_words(input_text)

        # Assert
        assert result == "Hello World"

    def test_capitalize_words_with_mixed_case(self):
        """Test capitalizing mixed case words."""
        # Arrange
        input_text = "hELLO wORLD"

        # Act
        result = capitalize_words(input_text)

        # Assert
        assert result == "Hello World"

    def test_capitalize_empty_string(self):
        """Test capitalizing empty string."""
        # Arrange
        input_text = ""

        # Act
        result = capitalize_words(input_text)

        # Assert
        assert result == ""

    def test_reverse_string(self):
        """Test reversing a string."""
        # Arrange
        input_text = "hello"

        # Act
        result = reverse_string(input_text)

        # Assert
        assert result == "olleh"

    def test_reverse_empty_string(self):
        """Test reversing empty string."""
        # Arrange
        input_text = ""

        # Act
        result = reverse_string(input_text)

        # Assert
        assert result == ""


# =============================================================================
# EXAMPLE: Using Fixtures
# =============================================================================

@pytest.fixture
def sample_user_data() -> Dict[str, str]:
    """Fixture providing sample user data."""
    return {
        'id': 'user-123',
        'name': 'Test User',
        'email': 'test@example.com',
    }


@pytest.fixture
def sample_task_list() -> List[Dict[str, str]]:
    """Fixture providing sample task list."""
    return [
        {'id': 'task-1', 'title': 'Task 1', 'status': 'pending'},
        {'id': 'task-2', 'title': 'Task 2', 'status': 'completed'},
        {'id': 'task-3', 'title': 'Task 3', 'status': 'pending'},
    ]


class TestFixtures:
    """Test suite demonstrating fixture usage."""

    def test_with_user_data_fixture(self, sample_user_data: Dict[str, str]):
        """Test using user data fixture."""
        # Act
        user_name = get_user_name(sample_user_data)

        # Assert
        assert user_name == 'Test User'
        assert sample_user_data['email'] == 'test@example.com'

    def test_with_task_list_fixture(self, sample_task_list: List[Dict[str, str]]):
        """Test using task list fixture."""
        # Arrange
        pending_tasks = [task for task in sample_task_list if task['status'] == 'pending']

        # Assert
        assert len(pending_tasks) == 2
        assert pending_tasks[0]['title'] == 'Task 1'
        assert pending_tasks[1]['title'] == 'Task 3'


# =============================================================================
# RUNNING THE TESTS
# =============================================================================
#
# Run all tests in this file:
#   pytest tests/examples/python-basic-example.test.py
#
# Run with verbose output:
#   pytest tests/examples/python-basic-example.test.py -v
#
# Run specific test class:
#   pytest tests/examples/python-basic-example.test.py::TestSimpleFunctions
#
# Run specific test:
#   pytest tests/examples/python-basic-example.test.py::TestSimpleFunctions::test_add_numbers_with_positive_integers
#
# Run with coverage:
#   pytest tests/examples/python-basic-example.test.py --cov=examples --cov-report=html
#
# Show local variables on failure:
#   pytest tests/examples/python-basic-example.test.py -l
# =============================================================================
