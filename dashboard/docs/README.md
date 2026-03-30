# Weave Dashboard

**Version:** 1.0.0
**Last Updated:** 2026-03-26
**Status:** Production Ready

---

## Overview

The Weave Dashboard is a modern React-based web application for managing AI agents, projects, workflows, and kanban boards. It provides a comprehensive interface for orchestrating AI agent operations with real-time updates and intuitive user experience.

### Key Features

- **Agent Management**: Create, monitor, and control AI agents with real-time status updates
- **Project Organization**: Organize agents into projects with configurable settings
- **Workflow Automation**: Design and execute approval workflows for agent operations
- **Kanban Board**: Visual task management with drag-and-drop support
- **Real-time Updates**: Live status updates via WebSocket connections
- **Chat Sessions**: Interactive chat interface with AI agents
- **Native Skills Management**: Browse and install agent capabilities from marketplace
- **Quick Actions**: One-click operations for common tasks

### Technology Stack

- **Framework**: React 19.2 with TypeScript
- **Build Tool**: Vite 7.3
- **State Management**: TanStack Query (React Query) 5.90
- **Routing**: React Router DOM 7.13
- **UI Framework**: Tailwind CSS 3.4
- **Component Libraries**: Radix UI (Dialog, Select)
- **Drag & Drop**: DnD Kit 6.3
- **Icons**: Lucide React 0.575
- **Internationalization**: i18next 25.8
- **Testing**: Vitest 3.1 with Testing Library
- **Real-time**: Socket.IO Client 4.8

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Backend API server running (typically on http://localhost:3000)

### Installation

```bash
# Navigate to dashboard directory
cd /root/projects/weave/dashboard

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure API endpoint in .env
# VITE_API_URL=http://localhost:3000
```

### Development

```bash
# Start development server (runs on http://localhost:5173)
npm run dev

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Type check
npm run build
```

### Build for Production

```bash
# Build production bundle
npm run build

# Preview production build
npm run preview

# Output will be in /dist directory
```

---

## Project Structure

```
dashboard/
├── docs/                      # Documentation (this file)
│   ├── README.md             # Dashboard overview and quick start
│   ├── ARCHITECTURE.md       # Dashboard architecture and patterns
│   ├── IMPLEMENTATION.md     # Implementation details and patterns
│   ├── UI_COMPONENTS.md      # UI components and styling guide
│   ├── TESTING.md            # Testing guide and reports
│   ├── I18N_USAGE.md         # Internationalization guide
│   ├── i18n-fix-report.md    # i18n bug fix report
│   ├── DARK_MODE.md          # Dark mode system reference
│   ├── BUILD.md              # Build configuration notes
│   └── components/           # Component-specific docs
│       ├── LANGUAGE_SELECTOR.md       # LanguageSelector component
│       └── PROJECT_SELECT_DROPDOWN.md # ProjectSelectDropdown component
├── src/
│   ├── api/                  # API client functions
│   │   ├── agents.ts         # Agent API endpoints
│   │   ├── projects.ts       # Project API endpoints
│   │   ├── plans.ts          # Plan API endpoints
│   │   ├── approvals.ts      # Approval workflow endpoints
│   │   ├── kanban.ts         # Kanban board endpoints
│   │   ├── chat.ts           # Chat session endpoints
│   │   ├── skills.ts         # Native skills endpoints
│   │   ├── marketplace.ts    # Marketplace endpoints
│   │   └── quickActions.ts   # Quick action endpoints
│   ├── components/           # Reusable UI components
│   │   ├── Button.tsx        # Button component
│   │   ├── Input.tsx         # Input field component
│   │   ├── Select.tsx        # Select dropdown component
│   │   ├── Switch.tsx        # Toggle switch component
│   │   ├── StatusBadge.tsx   # Status badge component
│   │   ├── MetricCard.tsx    # Metric card component
│   │   ├── Card.tsx          # Card container component
│   │   ├── Pagination.tsx    # Pagination component
│   │   ├── Toast.tsx         # Toast notification component
│   │   ├── ConfirmDialog.tsx # Confirmation dialog component
│   │   ├── QuickActionModal.tsx # Quick action modal
│   │   ├── EmptyState.tsx    # Empty state component
│   │   ├── PageHeader.tsx    # Page header component
│   │   ├── Layout.tsx        # Main layout component
│   │   └── index.ts          # Component exports
│   ├── features/             # Feature-specific components
│   │   ├── agents/           # Agent management
│   │   ├── projects/         # Project management
│   │   ├── plans/            # Plan management
│   │   ├── approvals/        # Approval workflows
│   │   ├── kanban/           # Kanban board
│   │   ├── chat/             # Chat sessions
│   │   ├── skills/           # Native skills
│   │   └── marketplace/      # Marketplace
│   ├── pages/                # Page components
│   │   ├── AgentsPage.tsx    # Agents page
│   │   ├── ProjectsPage.tsx  # Projects page
│   │   ├── PlansPage.tsx     # Plans page
│   │   ├── PlanDetailPage.tsx # Plan detail page
│   │   ├── WorkflowsPage.tsx # Workflows page
│   │   ├── ApprovalsPage.tsx # Approvals page
│   │   ├── KanbanPage.tsx    # Kanban board page
│   │   ├── ChatPage.tsx      # Chat page
│   │   ├── SkillsPage.tsx    # Skills page
│   │   ├── MarketplacePage.tsx # Marketplace page
│   │   └── SettingsPage.tsx  # Settings page
│   ├── lib/                  # Utility libraries
│   │   ├── colors.ts         # Centralized color system
│   │   ├── utils.ts          # Utility functions
│   │   └── cn.ts             # Class name utility
│   ├── hooks/                # Custom React hooks
│   │   └── (various hooks)
│   ├── test/                 # Test utilities and setup
│   │   └── colors.test.ts    # Color system tests
│   ├── App.tsx               # Root application component
│   └── main.tsx              # Application entry point
├── public/                   # Static assets
├── coverage/                 # Test coverage reports
├── dist/                     # Production build output
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── eslint.config.js          # ESLint configuration
```

---

## Core Concepts

### 1. Centralized Color System

The dashboard uses a centralized color configuration system located in `src/lib/colors.ts`. This ensures consistent styling across all components.

**Key Features:**
- 12 semantic color groups
- 8 predefined status colors
- Type-safe color definitions
- 100% test coverage

**Usage:**
```typescript
import { statusColors, buttonVariants } from '@/lib/colors'

// Use in components
const colors = statusColors[status]
<button className={buttonVariants.primary.bg}>
```

See [UI_COMPONENTS.md](./UI_COMPONENTS.md) for complete color system documentation.

### 2. API Integration with TanStack Query

All API calls are handled through custom hooks using TanStack Query for caching, refetching, and state management.

**Example:**
```typescript
import { useAgents, useUpdateAgent } from '@/api/agents'

// Query hook
const { data: agents, isLoading } = useAgents()

// Mutation hook
const updateAgent = useUpdateAgent()
```

### 3. Component Library

The dashboard includes a comprehensive set of reusable components:

- **Button**: Primary, secondary, danger, and ghost variants
- **Input**: Text input with error states
- **Select**: Dropdown select with Radix UI
- **Switch**: Toggle switch component
- **StatusBadge**: Status indicator badges
- **MetricCard**: KPI metric display
- **Card**: Container component
- **Pagination**: List pagination
- **Toast**: Notification toasts
- **ConfirmDialog**: Confirmation dialogs
- **EmptyState**: Empty state display

See [UI_COMPONENTS.md](./UI_COMPONENTS.md) for complete component documentation.

### 4. Routing

The dashboard uses React Router for client-side routing:

```typescript
/              - Workflows list page (default)
/agents        - Agents management page
/projects      - Projects management page
/plans/:id     - Plan/workflow detail page
/plans/new     - Create new workflow page
/approvals     - Approvals page
/kanban        - Kanban board page
/chat          - Chat sessions page
/marketplace   - Marketplace page
/settings      - Settings page
```

### 5. Real-time Updates

The dashboard uses Socket.IO for real-time updates:

- Agent status changes
- Plan execution updates
- Kanban board changes
- Chat messages
- Approval notifications

---

## Key Features by Page

### Agents Page (`/agents`)
- View all agents across all projects
- Real-time agent status monitoring
- Agent configuration management
- Environment settings

### Projects Page (`/projects`)
- Create and manage projects
- Configure project settings
- Assign agents to projects
- Environment management

### Workflows Page (`/` and `/workflows`)
- View execution plans/workflows
- Create new workflows
- Monitor workflow execution
- View workflow logs
- Import/export workflows

### Workflow Detail Page (`/plans/:id`)
- Detailed workflow information
- Step-by-step execution view
- Real-time status updates
- Execution logs

### Create Workflow Page (`/plans/new`)
- Create new workflow plans
- Configure workflow steps
- Set up dependencies
- Configure agents and environments

### Approvals Page (`/approvals`)
- View pending approvals
- Approve/deny requests
- Approval history
- Batch approval operations

### Kanban Board Page (`/kanban`)
- Visual task management
- Drag-and-drop task organization
- Auto-move feature toggle
- Task filtering by project

### Chat Page (`/chat`)
- Interactive chat with agents
- Chat history
- Real-time message updates
- Agent selection

### Skills Page (`/skills`)
- Browse native skills
- View skill documentation
- Install skills to projects
- Skill version management

### Marketplace Page (`/marketplace`)
- Browse agent marketplace
- Install pre-built agents
- Agent templates
- Community contributions

### Settings Page (`/settings`)
- Application settings
- User preferences
- API configuration
- Theme customization

---

## Development Guidelines

### Component Development

1. **Use Type-Safe Props**: Always define TypeScript interfaces for component props
2. **Follow Naming Conventions**: PascalCase for components, camelCase for utilities
3. **Import Order**: React, third-party, local components, styles, types
4. **Color Usage**: Always import from `@/lib/colors`, never hardcode
5. **Error Handling**: Always handle loading and error states in API calls

### Code Style

- Use functional components with hooks
- Prefer composition over inheritance
- Keep components focused and reusable
- Write tests for new components
- Add JSDoc comments for complex functions

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- Button.test.tsx

# Watch mode
npm test -- --watch

# Coverage report
npm run test:coverage

# UI mode
npm run test:ui
```

See [TESTING.md](./TESTING.md) for complete testing documentation.

---

## Configuration

### Environment Variables

Create a `.env` file in the dashboard root:

```bash
# API Configuration
VITE_API_URL=http://localhost:3000

# WebSocket Configuration (optional, defaults to API URL)
VITE_WS_URL=ws://localhost:3000
```

### Tailwind CSS Configuration

The dashboard uses Tailwind CSS with custom configuration in `tailwind.config.js`:

- Custom color palette
- Extended spacing scale
- Custom breakpoints
- Plugin configuration

### TypeScript Configuration

TypeScript is configured with strict mode enabled:

- `tsconfig.json` - Application configuration
- `tsconfig.app.json` - Source files
- `tsconfig.node.json` - Build scripts

---

## Performance Considerations

### Code Splitting

The dashboard uses lazy loading for routes to minimize initial bundle size:

```typescript
const AgentsPage = lazy(() => import('./pages/AgentsPage'))
```

### API Caching

TanStack Query automatically caches API responses:

- Stale time: 30 seconds
- Cache time: 5 minutes
- Automatic refetching on window focus

### Bundle Size

Current production bundle size: ~500KB (gzipped)
- React + React DOM: ~130KB
- TanStack Query: ~40KB
- Socket.IO Client: ~70KB
- Other dependencies: ~260KB

---

## Browser Compatibility

- **Chrome/Edge**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Mobile Safari**: 14+

**Required Features:**
- ES2020+ JavaScript support
- CSS Grid and Flexbox
- WebSocket support
- Local Storage support

---

## Accessibility

The dashboard follows WCAG 2.1 AA guidelines:

- Keyboard navigation support
- ARIA attributes for screen readers
- Focus indicators on interactive elements
- Color contrast ratios ≥ 4.5:1
- Semantic HTML structure

---

## Security

### Best Practices

1. **XSS Prevention**: React automatically escapes user input
2. **CSRF Protection**: API uses same-site cookie policy
3. **Authentication**: JWT tokens stored securely
4. **API Keys**: Never exposed in client-side code
5. **WebSocket**: Secure WebSocket (WSS) in production

### Content Security Policy

Configure CSP headers in production:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' ws://localhost:3000;
```

---

## Troubleshooting

### Common Issues

**Issue:** API calls failing
- Check that backend server is running
- Verify `VITE_API_URL` in `.env` file
- Check browser console for CORS errors

**Issue:** Real-time updates not working
- Verify WebSocket server is running
- Check firewall settings
- Ensure `VITE_WS_URL` is correct

**Issue:** Build failing
- Clear node_modules: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npx tsc --noEmit`
- Verify all imports are correct

**Issue:** Tests failing
- Update test snapshots: `npm test -- -u`
- Check test utilities: `@testing-library` versions
- Verify mock implementations

---

## Documentation

### General

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System architecture, data flow, and design patterns |
| [Implementation](./IMPLEMENTATION.md) | React patterns, hooks, and implementation details |
| [UI Components](./UI_COMPONENTS.md) | Component library, color system, and styling guide |
| [Testing](./TESTING.md) | Testing strategy, guides, and translation testing |
| [Build](./BUILD.md) | Build configuration and console removal notes |

### Features

| Document | Description |
|----------|-------------|
| [Dark Mode](./DARK_MODE.md) | Dark mode color system, component patterns, and theme toggle |
| [i18n Usage](./I18N_USAGE.md) | Internationalization setup, LanguageSelector, and troubleshooting |
| [i18n Fix Report](./i18n-fix-report.md) | Detailed report on i18n bug fixes and related translation reports |

### Component Docs

| Document | Description |
|----------|-------------|
| [LanguageSelector](./components/LANGUAGE_SELECTOR.md) | Language selector component API and usage |
| [ProjectSelectDropdown](./components/PROJECT_SELECT_DROPDOWN.md) | Project select dropdown component API and usage |

---

## Contributing

When contributing to the dashboard:

1. Follow existing code style and patterns
2. Write tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting
5. Use TypeScript strict mode
6. Follow accessibility best practices

---

## License

Copyright © 2026 Weave. All rights reserved.

---

## Support

For issues, questions, or contributions:
- Check existing documentation first
- Review test files for usage examples
- Consult API documentation
- Check component source files

---

**Last Updated:** 2026-03-26
**Maintained By:** Development Team
