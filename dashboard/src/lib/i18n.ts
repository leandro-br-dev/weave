import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enUSCommon from '../locales/en-US/common.json';
import enUSWorkflows from '../locales/en-US/workflows.json';
import enUSProjects from '../locales/en-US/projects.json';
import enUSAgents from '../locales/en-US/agents.json';
import enUSSettings from '../locales/en-US/settings.json';
import enUSChat from '../locales/en-US/chat.json';
import enUSApprovals from '../locales/en-US/approvals.json';
import enUSUserInputs from '../locales/en-US/userInputs.json';
import enUSMarketplace from '../locales/en-US/marketplace.json';
import enUSKanban from '../locales/en-US/kanban.json';
import enUSDashboard from '../locales/en-US/dashboard.json';
import enUSComponents from '../locales/en-US/components.json';
import enUSColors from '../locales/en-US/colors.json';
import enUSStatus from '../locales/en-US/status.json';
import enUSCreatePlan from '../locales/en-US/createPlan.json';
import enUSPlanDetail from '../locales/en-US/planDetail.json';
import enUSProjectSelectDemo from '../locales/en-US/projectSelectDemo.json';
import enUSAuth from '../locales/en-US/auth.json';

import ptBRCommon from '../locales/pt-BR/common.json';
import ptBRWorkflows from '../locales/pt-BR/workflows.json';
import ptBRProjects from '../locales/pt-BR/projects.json';
import ptBRAgents from '../locales/pt-BR/agents.json';
import ptBRSettings from '../locales/pt-BR/settings.json';
import ptBRChat from '../locales/pt-BR/chat.json';
import ptBRApprovals from '../locales/pt-BR/approvals.json';
import ptBRUserInputs from '../locales/pt-BR/userInputs.json';
import ptBRMarketplace from '../locales/pt-BR/marketplace.json';
import ptBRKanban from '../locales/pt-BR/kanban.json';
import ptBRDashboard from '../locales/pt-BR/dashboard.json';
import ptBRComponents from '../locales/pt-BR/components.json';
import ptBRColors from '../locales/pt-BR/colors.json';
import ptBRStatus from '../locales/pt-BR/status.json';
import ptBRCreatePlan from '../locales/pt-BR/createPlan.json';
import ptBRPlanDetail from '../locales/pt-BR/planDetail.json';
import ptBRProjectSelectDemo from '../locales/pt-BR/projectSelectDemo.json';
import ptBRAuth from '../locales/pt-BR/auth.json';

// Combine all translation files for each language
const enUS = {
  common: enUSCommon,
  pages: {
    dashboard: enUSDashboard,
    workflows: enUSWorkflows,
    projects: enUSProjects,
    agents: enUSAgents,
    settings: enUSSettings,
    chat: enUSChat,
    approvals: enUSApprovals,
    userInputs: enUSUserInputs,
    marketplace: enUSMarketplace,
    kanban: enUSKanban,
  },
  components: enUSComponents,
  colors: enUSColors,
  status: enUSStatus,
  createPlan: enUSCreatePlan,
  planDetail: enUSPlanDetail,
  projectSelectDemo: enUSProjectSelectDemo,
  auth: enUSAuth,
};

const ptBR = {
  common: ptBRCommon,
  pages: {
    dashboard: ptBRDashboard,
    workflows: ptBRWorkflows,
    projects: ptBRProjects,
    agents: ptBRAgents,
    settings: ptBRSettings,
    chat: ptBRChat,
    approvals: ptBRApprovals,
    userInputs: ptBRUserInputs,
    marketplace: ptBRMarketplace,
    kanban: ptBRKanban,
  },
  components: ptBRComponents,
  colors: ptBRColors,
  status: ptBRStatus,
  createPlan: ptBRCreatePlan,
  planDetail: ptBRPlanDetail,
  projectSelectDemo: ptBRProjectSelectDemo,
  auth: ptBRAuth,
};

// Configure i18next instance
i18n
  // Detect language from localStorage, html tag, and navigator
  .use(LanguageDetector)
  // Pass i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    // Language detection options
    detection: {
      // Order of language detection (from highest to lowest priority)
      order: ['localStorage', 'htmlTag', 'navigator'],
      // Keys to look for in localStorage
      lookupLocalStorage: 'i18nextLng',
      // Cache user language
      caches: ['localStorage'],
    },

    // Fallback language
    fallbackLng: 'en-US',

    // Supported languages (including 'pt' as alias for 'pt-BR', 'en' as alias for 'en-US')
    supportedLngs: ['en-US', 'en', 'pt-BR', 'pt'],

    // Debug mode in development
    debug: import.meta.env.DEV,

    // React options
    react: {
      // Use Suspense to wait for translations to load
      useSuspense: true,
    },

    // Default namespace
    defaultNS: 'translation',

    // Namespaces to load
    ns: ['translation'],

    // Resources with all translation files
    resources: {
      'en-US': {
        translation: enUS,
      },
      'pt-BR': {
        translation: ptBR,
      },
    },

    // Interpolation configuration
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

// Keep the HTML lang attribute in sync with the selected language
// so the browser applies correct spell-checking, hyphenation, and accessibility features
const syncHtmlLang = (lng: string) => {
  const normalized = lng.startsWith('pt') ? 'pt-BR' : 'en-US';
  document.documentElement.lang = normalized;
};

// Sync on initial detection
syncHtmlLang(i18n.language);

// Sync on every language change (user switches via selector)
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
