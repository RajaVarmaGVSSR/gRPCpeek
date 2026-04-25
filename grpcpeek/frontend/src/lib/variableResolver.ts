// Variable Resolution Engine
// Resolves {{env.key}} and {{global.key}} syntax in request bodies and metadata

import type { VariableContext, VariableResolutionResult, UnresolvedVariable } from '../types/workspace'

// Regex to match {{env.key}} or {{global.key}}
const VARIABLE_PATTERN = /\{\{(env|global)\.([a-zA-Z0-9_]+)\}\}/g

function lookupVariable(
  namespace: string,
  key: string,
  context: VariableContext
): string | undefined {
  if (namespace === 'env') {
    return context.environmentVariables.find((v) => v.key === key && v.enabled)?.value
  }
  if (namespace === 'global') {
    return context.globalVariables.find((v) => v.key === key && v.enabled)?.value
  }
  return undefined
}

/**
 * Resolves variables within a plain string (no JSON awareness).
 * Used for metadata values and non-JSON contexts.
 */
function resolveInString(
  text: string,
  context: VariableContext,
  unresolvedVars: UnresolvedVariable[]
): string {
  return text.replace(VARIABLE_PATTERN, (placeholder, namespace, key) => {
    const value = lookupVariable(namespace, key, context)
    if (value !== undefined) {
      return value
    }
    if (!unresolvedVars.some((v) => v.placeholder === placeholder)) {
      unresolvedVars.push({ placeholder, key, namespace: namespace as 'env' | 'global' })
    }
    return placeholder
  })
}

/**
 * Recursively substitutes variables inside a parsed JSON value.
 * String values get variable substitution; the result is left as a plain
 * string value, so special characters in variable values are safe —
 * they will be re-encoded by JSON.stringify rather than breaking the structure.
 */
function resolveInJsonValue(
  value: unknown,
  context: VariableContext,
  unresolvedVars: UnresolvedVariable[]
): unknown {
  if (typeof value === 'string') {
    return resolveInString(value, context, unresolvedVars)
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveInJsonValue(item, context, unresolvedVars))
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveInJsonValue(v, context, unresolvedVars)
    }
    return out
  }
  return value
}

/**
 * Resolves all variables in a string.
 *
 * When the input is valid JSON, substitution happens at the value level so
 * special characters in variable values (quotes, backslashes, etc.) cannot
 * corrupt the JSON structure. For non-JSON input, plain string replacement
 * is used as a fallback.
 */
export function resolveVariables(
  text: string,
  context: VariableContext
): VariableResolutionResult {
  const unresolvedVars: UnresolvedVariable[] = []

  // JSON-aware path: parse → substitute in values → re-serialize.
  // This prevents variable values that contain " or \ from breaking JSON.
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'object' && parsed !== null) {
      const resolved = resolveInJsonValue(parsed, context, unresolvedVars)
      return {
        resolved: JSON.stringify(resolved, null, 2),
        unresolvedVars,
      }
    }
  } catch {
    // Not valid JSON — fall through to plain string substitution.
  }

  return {
    resolved: resolveInString(text, context, unresolvedVars),
    unresolvedVars,
  }
}

/**
 * Resolves variables in request metadata (key-value pairs)
 * @param metadata - Metadata object with possible variable placeholders
 * @param context - Variable context
 * @returns Resolved metadata and list of unresolved variables
 */
export function resolveMetadataVariables(
  metadata: Record<string, string>,
  context: VariableContext
): { resolved: Record<string, string>; unresolved: UnresolvedVariable[] } {
  const resolved: Record<string, string> = {}
  const allUnresolved: UnresolvedVariable[] = []

  for (const [key, value] of Object.entries(metadata)) {
    const result = resolveVariables(value, context)
    resolved[key] = result.resolved
    allUnresolved.push(...result.unresolvedVars)
  }

  // Deduplicate unresolved variables
  const unresolved = allUnresolved.filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.placeholder === item.placeholder)
  )

  return { resolved, unresolved }
}

/**
 * Finds all variable placeholders in a string (without resolving)
 * Useful for autocomplete/validation
 */
export function findVariablePlaceholders(text: string): string[] {
  const matches = text.matchAll(VARIABLE_PATTERN)
  const placeholders: string[] = []

  for (const match of matches) {
    placeholders.push(match[0])
  }

  return [...new Set(placeholders)] // Deduplicate
}

/**
 * Checks if a string contains any variable placeholders
 */
export function hasVariables(text: string): boolean {
  return VARIABLE_PATTERN.test(text)
}

/**
 * Gets a list of all available variables for autocomplete
 */
export function getAvailableVariables(context: VariableContext): Array<{
  key: string
  value: string
  namespace: 'env' | 'global'
  placeholder: string
}> {
  const available: Array<{
    key: string
    value: string
    namespace: 'env' | 'global'
    placeholder: string
  }> = []

  // Add environment variables
  for (const envVar of context.environmentVariables) {
    if (envVar.enabled) {
      available.push({
        key: envVar.key,
        value: envVar.secret ? '••••••' : envVar.value,
        namespace: 'env',
        placeholder: `{{env.${envVar.key}}}`,
      })
    }
  }

  // Add global variables
  for (const globalVar of context.globalVariables) {
    if (globalVar.enabled) {
      available.push({
        key: globalVar.key,
        value: globalVar.secret ? '••••••' : globalVar.value,
        namespace: 'global',
        placeholder: `{{global.${globalVar.key}}}`,
      })
    }
  }

  return available
}

/**
 * Validates variable syntax (for input validation)
 */
export function isValidVariableSyntax(placeholder: string): boolean {
  return /^\{\{(env|global)\.[a-zA-Z0-9_]+\}\}$/.test(placeholder)
}

/**
 * Creates a variable placeholder string
 */
export function createVariablePlaceholder(
  namespace: 'env' | 'global',
  key: string
): string {
  return `{{${namespace}.${key}}}`
}
