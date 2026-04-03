import { useGetEnvironmentVariablesDefaults } from '@/api/environmentVariables';
import { useState, useEffect } from 'react';
import { Card, Input } from '@/components';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import {
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  infoColors,
  darkModeInfoColors,
  errorColors,
  darkModeErrorColors,
  withDarkMode,
} from '@/lib/colors';

export interface EnvironmentVariableValue {
  key: string;
  value: string;
  description?: string;
  isDefault?: boolean;
}

interface EnvironmentVariablesFormProps {
  values: EnvironmentVariableValue[];
  onChange: (values: EnvironmentVariableValue[]) => void;
  title?: string;
  description?: string;
}

export function EnvironmentVariablesForm({
  values,
  onChange,
  title = 'Environment Variables',
  description = 'Configure environment variables for this agent. These will be used as default values.'
}: EnvironmentVariablesFormProps) {
  const { data: envDefaults } = useGetEnvironmentVariablesDefaults();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [showAllDefaults, setShowAllDefaults] = useState(false);

  // Initialize with defaults when component mounts or defaults change
  useEffect(() => {
    if (envDefaults?.flat && values.length === 0) {
      const defaultVars: EnvironmentVariableValue[] = Object.entries(envDefaults.flat).map(
        ([key, value]) => ({
          key,
          value,
          isDefault: true,
        })
      );
      onChange(defaultVars);
    }
  }, [envDefaults, values.length, onChange]);

  const toggleSecretVisibility = (index: number) => {
    setShowSecrets(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const isSecretVisible = (index: number) => showSecrets[index] || false;

  const updateValue = (index: number, field: keyof EnvironmentVariableValue, newValue: string) => {
    const updated = values.map((v, i) =>
      i === index ? { ...v, [field]: newValue, isDefault: false } : v
    );
    onChange(updated);
  };

  const addVariable = () => {
    onChange([
      ...values,
      { key: '', value: '', description: '', isDefault: false }
    ]);
  };

  const removeVariable = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const addDefaultVariable = (key: string, value: string) => {
    if (!values.find(v => v.key === key)) {
      onChange([
        ...values,
        { key, value, isDefault: true }
      ]);
    }
  };

  const isSecret = (key: string) => {
    return key.toLowerCase().includes('secret') ||
           key.toLowerCase().includes('key') ||
           key.toLowerCase().includes('password') ||
           key.toLowerCase().includes('token');
  };

  const availableDefaults = envDefaults?.flat
    ? Object.entries(envDefaults.flat).filter(([key]) => !values.find(v => v.key === key))
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className={`text-sm font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} mb-1`}>{title}</h3>
        {description && <p className={`text-xs ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mb-3`}>{description}</p>}

        {/* Available Defaults */}
        {availableDefaults.length > 0 && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowAllDefaults(!showAllDefaults)}
              className={`text-xs ${withDarkMode('text-orange-600', 'dark:text-orange-400')} ${withDarkMode('hover:text-orange-800', 'dark:hover:text-orange-300')} mb-2`}
            >
              {showAllDefaults ? 'Hide' : 'Show'} available defaults ({availableDefaults.length})
            </button>
            {showAllDefaults && (
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 p-3 ${withDarkMode(infoColors.bg, darkModeInfoColors.bg)} border ${withDarkMode(infoColors.border, darkModeInfoColors.border)} rounded`}>
                {availableDefaults.map(([key, value]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => addDefaultVariable(key, value)}
                    className={`text-left p-2 ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} rounded border ${withDarkMode('border-orange-300', 'dark:border-orange-700')} ${withDarkMode('hover:bg-orange-100', 'dark:hover:bg-orange-950')} transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-mono font-semibold">{key}</code>
                      <Plus className={`w-3 h-3 ${withDarkMode('text-orange-600', 'dark:text-orange-400')}`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Variables List */}
      <div className="space-y-2">
        {values.map((envVar, index) => (
          <Card key={index} className={`${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    value={envVar.key}
                    onChange={(e) => updateValue(index, 'key', e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    placeholder="VARIABLE_NAME"
                    className="text-sm font-mono"
                  />
                </div>
                {values.length > 0 && (
                  <button
                    type="button"
                    onClick={() => removeVariable(index)}
                    className={`p-2 ${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${errorColors.text} ${darkModeErrorColors.text} ${withDarkMode(errorColors.bg, darkModeErrorColors.bg)} rounded transition-colors`}
                    title="Remove variable"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type={isSecret(envVar.key) && !isSecretVisible(index) ? 'password' : 'text'}
                  value={envVar.value}
                  onChange={(e) => updateValue(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="text-sm"
                />
                {isSecret(envVar.key) && (
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility(index)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} ${withDarkMode('hover:text-gray-700', 'dark:hover:text-gray-200')}`}
                  >
                    {isSecretVisible(index) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {envVar.isDefault && (
                <span className={`text-xs ${infoColors.text} ${darkModeInfoColors.text} ${infoColors.bg} ${darkModeInfoColors.bg} px-2 py-1 rounded inline-block`}>
                  Default value
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>

      <button
        type="button"
        onClick={addVariable}
        className={`w-full py-2 px-4 border-2 border-dashed ${withDarkMode(borderColors.thick, darkModeBorderColors.thick)} rounded text-sm ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} ${withDarkMode('hover:border-orange-400 hover:text-orange-600', 'dark:hover:border-orange-500 dark:hover:text-orange-400')} transition-colors flex items-center justify-center gap-2`}
      >
        <Plus className="w-4 h-4" />
        Add Variable
      </button>
    </div>
  );
}
