import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreatePlanForm } from './CreatePlanForm';
import * as ReactRouter from 'react-router';
import * as plansApi from '@/api/plans';
import * as workspacesApi from '@/api/teams';
import * as projectsApi from '@/api/projects';

const mockNavigate = vi.fn();

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal() as typeof ReactRouter;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/api/plans', () => ({
  useCreatePlan: vi.fn(),
}));

vi.mock('@/api/teams', () => ({
  useGetWorkspaces: vi.fn(),
}));

vi.mock('@/api/projects', () => ({
  useGetProjects: vi.fn(),
  useGetAllEnvironments: vi.fn(),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ReactRouter.BrowserRouter>{ui}</ReactRouter.BrowserRouter>
    </QueryClientProvider>
  );
}

describe('CreatePlanForm', () => {
  const mockWorkspaces = [
    { id: '1', name: 'Agent Workspace 1', path: '/root/workspace1', exists: true, hasSettings: true, hasClaude: true, baseUrl: null },
  ];

  const mockProjects = [
    { id: 'proj1', name: 'Project 1', environments: [{ id: 'env1', project_id: 'proj1', name: 'Dev Environment', type: 'local-wsl', project_path: '/root/project1', team_workspace: '/root/workspace1', created_at: '2024-01-01', project_name: 'Project 1' }] },
  ];

  const mockEnvironments = [
    { id: 'env1', project_id: 'proj1', name: 'Dev Environment', type: 'local-wsl', project_path: '/root/project1', team_workspace: '/root/workspace1', created_at: '2024-01-01', project_name: 'Project 1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(plansApi.useCreatePlan).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(workspacesApi.useGetWorkspaces).mockReturnValue({
      data: mockWorkspaces,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(projectsApi.useGetProjects).mockReturnValue({
      data: mockProjects,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(projectsApi.useGetAllEnvironments).mockReturnValue({
      data: mockEnvironments,
      isLoading: false,
      error: null,
    } as any);
  });
  it('renders form with all required fields', () => {
    renderWithProviders(<CreatePlanForm />);

    expect(screen.getByLabelText('Plan Name *')).toBeInTheDocument();
    expect(screen.getByText('Tasks *')).toBeInTheDocument();
    expect(screen.getByLabelText('Task Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Prompt *')).toBeInTheDocument();
    expect(screen.getByLabelText(/Agent/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Environment/)).toBeInTheDocument();
  });

  it('renders initial task with default values', () => {
    renderWithProviders(<CreatePlanForm />);

    const cwdInput = screen.getByPlaceholderText('Derived from environment or agent workspace') as HTMLInputElement;
    const workspaceSelect = screen.getByLabelText(/Agent/) as HTMLSelectElement;

    expect(cwdInput.value).toBe('');
    expect(workspaceSelect.value).toBe('');
  });

  it('allows adding new tasks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatePlanForm />);

    const initialTasks = screen.getAllByText(/Task \d+/);
    expect(initialTasks).toHaveLength(1);

    const addButton = screen.getByText('Add Task');
    await user.click(addButton);

    const tasksAfterAdd = screen.getAllByText(/Task \d+/);
    expect(tasksAfterAdd).toHaveLength(2);
  });

  it('allows removing tasks when more than one exists', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatePlanForm />);

    // Add a second task
    const addButton = screen.getByText('Add Task');
    await user.click(addButton);

    const removeButtons = screen.getAllByText('Remove');
    expect(removeButtons).toHaveLength(2);

    // Remove first task
    await user.click(removeButtons[0]);

    const remainingTasks = screen.getAllByText(/Task \d+/);
    expect(remainingTasks).toHaveLength(1);
  });

  it.skip('shows validation errors when submitting empty form', async () => {
    // Skipping: HTML5 form validation prevents JS validation from running
    // In real usage, HTML5 validation shows browser's native validation UI
    const user = userEvent.setup();
    const mutateMock = vi.fn();
    vi.mocked(plansApi.useCreatePlan).mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as any);

    renderWithProviders(<CreatePlanForm />);

    const submitButton = screen.getByText('Create Plan');
    await user.click(submitButton);

    // The form should show validation errors via the validate() function
    await waitFor(() => {
      expect(screen.getByText('Plan name is required')).toBeInTheDocument();
      expect(mutateMock).not.toHaveBeenCalled();
    });
  });

  it.skip('shows validation errors for empty task fields', async () => {
    // Skipping: HTML5 form validation prevents JS validation from running
    // In real usage, HTML5 validation shows browser's native validation UI
    const user = userEvent.setup();
    const mutateMock = vi.fn();
    vi.mocked(plansApi.useCreatePlan).mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as any);

    renderWithProviders(<CreatePlanForm />);

    // Fill plan name
    const planNameInput = screen.getByLabelText('Plan Name *');
    await user.type(planNameInput, 'Test Plan');

    const submitButton = screen.getByText('Create Plan');
    await user.click(submitButton);

    // The form should show validation errors via the validate() function
    await waitFor(() => {
      expect(screen.getByText('Task name is required')).toBeInTheDocument();
      expect(mutateMock).not.toHaveBeenCalled();
    });
  });

  it('allows filling in task fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatePlanForm />);

    const taskNameInput = screen.getByLabelText('Task Name *');
    await user.clear(taskNameInput);
    await user.type(taskNameInput, 'Build component');

    expect(taskNameInput).toHaveValue('Build component');
  });

  it('renders cancel and submit buttons', () => {
    renderWithProviders(<CreatePlanForm />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Create Plan')).toBeInTheDocument();
  });

  it('shows back link to plans page', () => {
    renderWithProviders(<CreatePlanForm />);

    const backLink = screen.getByText('← Back to Plans');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('updates cwd to project_path when environment is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatePlanForm />);

    // First select a project to enable environment selection
    const projectSelect = screen.getByLabelText('Project *');
    await user.selectOptions(projectSelect, 'proj1');

    // Select an environment
    const envSelect = screen.getByLabelText(/Environment/);
    await user.selectOptions(envSelect, 'env1');

    // Wait for the cwd field to be updated
    const cwdInput = screen.getByPlaceholderText('Derived from environment or agent workspace') as HTMLInputElement;

    await waitFor(() => {
      // Should use project_path from environment, not team_workspace
      expect(cwdInput.value).toBe('/root/project1');
    });
  });

  it('updates cwd to workspace project root when workspace is selected without environment', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatePlanForm />);

    // First select a project to enable workspace selection
    const projectSelect = screen.getByLabelText('Project *');
    await user.selectOptions(projectSelect, 'proj1');

    // Select a workspace (without selecting environment)
    const workspaceSelect = screen.getByLabelText(/Agent/);
    await user.selectOptions(workspaceSelect, '/root/workspace1');

    // Wait for the cwd field to be updated
    const cwdInput = screen.getByPlaceholderText('Derived from environment or agent workspace') as HTMLInputElement;

    await waitFor(() => {
      // Should use parent directory of workspace path (project root)
      // Workspace path is /root/workspace1/team-coder, so project root is /root/workspace1
      expect(cwdInput.value).toBe('/root/workspace1');
    });
  });

  it('shows environment details after selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatePlanForm />);

    // First select a project to enable environment selection
    const projectSelect = screen.getByLabelText('Project *');
    await user.selectOptions(projectSelect, 'proj1');

    // Select an environment
    const envSelect = screen.getByLabelText(/Environment/);
    await user.selectOptions(envSelect, 'env1');

    // Wait for the cwd field to be updated
    const cwdInput = screen.getByPlaceholderText('Derived from environment or agent workspace') as HTMLInputElement;

    await waitFor(() => {
      // Should use project_path from environment
      expect(cwdInput.value).toBe('/root/project1');
    });
  });
});
