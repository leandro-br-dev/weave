#!/usr/bin/env python3
"""
Manual Test Script for Kanban Template Workflows
Tests all template CRUD operations and visibility rules
"""

import sqlite3
import json
import uuid
from datetime import datetime, timedelta

DB_PATH = '/root/projects/weave/api/data/database.db'

class TemplateTester:
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.cursor = self.conn.cursor()
        self.test_results = []
        self.project_a = "39ad704d-0dd6-4011-82f1-3a280402f478"  # Test Project
        self.project_b = "3b48bfd7-bdd7-4dad-831e-6f98716765f2"  # weave
        self.project_c = "9f4cc332-c780-4dca-85f7-8e7550e63afb"  # Another test project

    def cleanup(self):
        """Clean up test data"""
        print("🧹 Cleaning up test data...")
        self.cursor.execute("DELETE FROM kanban_tasks WHERE title LIKE 'Test %'")
        self.cursor.execute("DELETE FROM kanban_templates WHERE title LIKE 'Test %'")
        self.conn.commit()
        print("✅ Cleanup complete\n")

    def log_test(self, test_name, passed, details=""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"     {details}\n")

    def test_1_create_template_from_task_data(self):
        """Test Case 1: Create template using task data"""
        print("\n📋 TEST CASE 1: Create Template from Task Data")
        print("=" * 60)

        try:
            # Create template simulating "Save as Template"
            template_id = str(uuid.uuid4())
            template_data = {
                'id': template_id,
                'title': 'Test Template from Task',
                'description': 'Template created from task data',
                'priority': 3,
                'recurrence': 'daily',
                'is_public': 1,
                'project_id': None
            }

            self.cursor.execute("""
                INSERT INTO kanban_templates (
                    id, project_id, title, description, priority,
                    recurrence, is_public, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (
                template_data['id'],
                template_data['project_id'],
                template_data['title'],
                template_data['description'],
                template_data['priority'],
                template_data['recurrence'],
                template_data['is_public']
            ))

            self.conn.commit()

            # Verify template was created
            self.cursor.execute("SELECT * FROM kanban_templates WHERE id = ?", (template_id,))
            template = self.cursor.fetchone()

            if template and template[2] == 'Test Template from Task':
                self.log_test("Create template from task data", True,
                           f"Template ID: {template_id}")
                return template_id
            else:
                self.log_test("Create template from task data", False,
                           "Template not found or incorrect data")
                return None

        except Exception as e:
            self.log_test("Create template from task data", False, str(e))
            return None

    def test_2_create_project_specific_template(self):
        """Test Case 2: Create project-specific template"""
        print("\n📋 TEST CASE 2: Create Project-Specific Template")
        print("=" * 60)

        try:
            template_id = str(uuid.uuid4())

            self.cursor.execute("""
                INSERT INTO kanban_templates (
                    id, project_id, title, description, priority,
                    recurrence, is_public, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (template_id, self.project_a, 'Test Project A Template',
                  'Template specific to Project A', 2, 'weekly_monday', 0))

            self.conn.commit()

            # Verify
            self.cursor.execute("SELECT * FROM kanban_templates WHERE id = ?", (template_id,))
            template = self.cursor.fetchone()

            if template and template[1] == self.project_a and template[6] == 0:
                self.log_test("Create project-specific template", True,
                           f"Template for Project A: {template_id}")
                return template_id
            else:
                self.log_test("Create project-specific template", False,
                           "Template not created with correct project")
                return None

        except Exception as e:
            self.log_test("Create project-specific template", False, str(e))
            return None

    def test_3_edit_template(self, template_id):
        """Test Case 3: Edit template"""
        print("\n📋 TEST CASE 3: Edit Template")
        print("=" * 60)

        if not template_id:
            self.log_test("Edit template", False, "No template to edit")
            return

        try:
            # Update template
            self.cursor.execute("""
                UPDATE kanban_templates
                SET title = 'Updated Template Title',
                    priority = 1,
                    is_public = 0,
                    project_id = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            """, (self.project_b, template_id))

            self.conn.commit()

            # Verify update
            self.cursor.execute("SELECT * FROM kanban_templates WHERE id = ?", (template_id,))
            template = self.cursor.fetchone()

            if (template and template[2] == 'Updated Template Title' and
                template[4] == 1 and template[6] == 0):
                self.log_test("Edit template", True,
                           "Title, priority, and visibility updated")
            else:
                self.log_test("Edit template", False, "Update not applied correctly")

        except Exception as e:
            self.log_test("Edit template", False, str(e))

    def test_4_use_template(self, template_id):
        """Test Case 4: Use template to create task"""
        print("\n📋 TEST CASE 4: Use Template to Create Task")
        print("=" * 60)

        if not template_id:
            self.log_test("Use template", False, "No template to use")
            return

        try:
            # Get template
            self.cursor.execute("SELECT * FROM kanban_templates WHERE id = ?", (template_id,))
            template = self.cursor.fetchone()

            if not template:
                self.log_test("Use template", False, "Template not found")
                return

            # Create task from template (simulating API call)
            task_id = str(uuid.uuid4())

            # Get max order_index for planning column
            self.cursor.execute("""
                SELECT COALESCE(MAX(order_index), -1) as max_order
                FROM kanban_tasks
                WHERE project_id = ? AND column = 'planning'
            """, (self.project_a,))
            max_order = self.cursor.fetchone()[0]
            next_order = max_order + 1

            # Insert task
            self.cursor.execute("""
                INSERT INTO kanban_tasks (
                    id, project_id, title, description, column, priority,
                    order_index, pipeline_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'planning', ?, ?, 'idle', datetime('now'), datetime('now'))
            """, (task_id, self.project_a, template[2], template[3],
                  template[4], next_order))

            # Update template's last_run_at
            self.cursor.execute("""
                UPDATE kanban_templates
                SET last_run_at = datetime('now')
                WHERE id = ?
            """, (template_id,))

            self.conn.commit()

            # Verify task was created
            self.cursor.execute("SELECT * FROM kanban_tasks WHERE id = ?", (task_id,))
            task = self.cursor.fetchone()

            # Verify template was updated
            self.cursor.execute("SELECT last_run_at FROM kanban_templates WHERE id = ?", (template_id,))
            updated_template = self.cursor.fetchone()

            if (task and task[3] == 'planning' and
                task[2] == template[2] and  # Title matches
                updated_template and updated_template[0]):  # last_run_at set
                self.log_test("Use template to create task", True,
                           f"Task created in Planning column, template updated")
            else:
                self.log_test("Use template to create task", False,
                           "Task not created correctly")

        except Exception as e:
            self.log_test("Use template to create task", False, str(e))

    def test_5_delete_template(self):
        """Test Case 5: Delete template"""
        print("\n📋 TEST CASE 5: Delete Template")
        print("=" * 60)

        try:
            # Create a template to delete
            template_id = str(uuid.uuid4())
            self.cursor.execute("""
                INSERT INTO kanban_templates (
                    id, project_id, title, description, priority,
                    recurrence, is_public, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (template_id, None, 'Template to Delete', 'Will be deleted', 3, '', 1))

            self.conn.commit()

            # Create a task from this template first
            task_id = str(uuid.uuid4())
            self.cursor.execute("""
                INSERT INTO kanban_tasks (
                    id, project_id, title, description, column, priority,
                    order_index, pipeline_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'planning', ?, ?, 'idle', datetime('now'), datetime('now'))
            """, (task_id, self.project_a, 'Task from Deleted Template',
                  'Should remain after template deletion', 3, 0))

            self.conn.commit()

            # Delete template
            self.cursor.execute("DELETE FROM kanban_templates WHERE id = ?", (template_id,))
            self.conn.commit()

            # Verify template is deleted
            self.cursor.execute("SELECT * FROM kanban_templates WHERE id = ?", (template_id,))
            template = self.cursor.fetchone()

            # Verify task still exists
            self.cursor.execute("SELECT * FROM kanban_tasks WHERE id = ?", (task_id,))
            task = self.cursor.fetchone()

            if template is None and task is not None:
                self.log_test("Delete template", True,
                           "Template deleted, task remains")
            else:
                self.log_test("Delete template", False,
                           "Deletion failed or task was affected")

        except Exception as e:
            self.log_test("Delete template", False, str(e))

    def test_6_template_visibility(self):
        """Test Case 6: Project-specific vs Public template visibility"""
        print("\n📋 TEST CASE 6: Template Visibility (Public vs Project-Specific)")
        print("=" * 60)

        try:
            # Create public template
            public_id = str(uuid.uuid4())
            self.cursor.execute("""
                INSERT INTO kanban_templates (
                    id, project_id, title, description, priority,
                    recurrence, is_public, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (public_id, None, 'Public Template', 'Visible to all', 3, 'daily', 1))

            # Create Project A template
            project_a_id = str(uuid.uuid4())
            self.cursor.execute("""
                INSERT INTO kanban_templates (
                    id, project_id, title, description, priority,
                    recurrence, is_public, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (project_a_id, self.project_a, 'Project A Template',
                  'Only for Project A', 2, 'weekly_friday', 0))

            # Create Project B template
            project_b_id = str(uuid.uuid4())
            self.cursor.execute("""
                INSERT INTO kanban_templates (
                    id, project_id, title, description, priority,
                    recurrence, is_public, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (project_b_id, self.project_b, 'Project B Template',
                  'Only for Project B', 4, 'monthly', 0))

            self.conn.commit()

            # Test visibility for Project A
            self.cursor.execute("""
                SELECT * FROM kanban_templates
                WHERE project_id = ? OR is_public = 1
            """, (self.project_a,))
            project_a_templates = self.cursor.fetchall()

            # Test visibility for Project B
            self.cursor.execute("""
                SELECT * FROM kanban_templates
                WHERE project_id = ? OR is_public = 1
            """, (self.project_b,))
            project_b_templates = self.cursor.fetchall()

            # Count templates
            pa_count = len(project_a_templates)
            pb_count = len(project_b_templates)

            # Project A should see: Public + Project A templates (2)
            # Project B should see: Public + Project B templates (2)
            if pa_count == 2 and pb_count == 2:
                self.log_test("Template visibility rules", True,
                           f"Project A: {pa_count} templates, Project B: {pb_count} templates")

                # Verify specific templates
                pa_ids = [t[0] for t in project_a_templates]
                pb_ids = [t[0] for t in project_b_templates]

                if (public_id in pa_ids and project_a_id in pa_ids and
                    public_id in pb_ids and project_b_id in pb_ids and
                    project_b_id not in pa_ids and project_a_id not in pb_ids):
                    self.log_test("Template visibility filtering", True,
                               "Each project sees correct templates")
                else:
                    self.log_test("Template visibility filtering", False,
                               "Template filtering not working correctly")
            else:
                self.log_test("Template visibility rules", False,
                           f"Expected 2 templates each, got PA: {pa_count}, PB: {pb_count}")

        except Exception as e:
            self.log_test("Template visibility", False, str(e))

    def test_7_recurrence_display(self):
        """Test Case 7: Template recurrence display"""
        print("\n📋 TEST CASE 7: Template Recurrence")
        print("=" * 60)

        try:
            # Create templates with different recurrence patterns
            recurrences = ['hourly', 'daily', 'weekly_monday', 'weekly_friday', 'monthly', '']

            for rec in recurrences:
                template_id = str(uuid.uuid4())
                title = f'Template with {rec if rec else "no"} recurrence'
                self.cursor.execute("""
                    INSERT INTO kanban_templates (
                        id, project_id, title, description, priority,
                        recurrence, is_public, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """, (template_id, None, title, f'Recurrence: {rec}', 3, rec, 1))

            self.conn.commit()

            # Verify all templates created
            self.cursor.execute("SELECT COUNT(*) FROM kanban_templates WHERE title LIKE 'Template with %'")
            count = self.cursor.fetchone()[0]

            if count == len(recurrences):
                self.log_test("Create templates with recurrence", True,
                           f"Created {count} templates with different recurrence patterns")
            else:
                self.log_test("Create templates with recurrence", False,
                           f"Expected {len(recurrences)}, got {count}")

        except Exception as e:
            self.log_test("Template recurrence", False, str(e))

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)

        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r['passed'])
        failed = total - passed

        print(f"\nTotal Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")

        if failed > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['details']}")

        print("\n" + "=" * 60)

    def run_all_tests(self):
        """Run all tests"""
        print("\n🚀 Starting Manual Template Workflow Tests")
        print("=" * 60)

        self.cleanup()

        # Test 1: Create template from task
        template_id = self.test_1_create_template_from_task_data()

        # Test 2: Create project-specific template
        self.test_2_create_project_specific_template()

        # Test 3: Edit template
        self.test_3_edit_template(template_id)

        # Test 4: Use template
        self.test_4_use_template(template_id)

        # Test 5: Delete template
        self.test_5_delete_template()

        # Test 6: Template visibility
        self.test_6_template_visibility()

        # Test 7: Recurrence
        self.test_7_recurrence_display()

        # Print summary
        self.print_summary()

        self.conn.close()

if __name__ == '__main__':
    tester = TemplateTester()
    tester.run_all_tests()
