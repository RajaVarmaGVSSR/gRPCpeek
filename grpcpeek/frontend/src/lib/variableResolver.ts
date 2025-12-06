// Variable Resolution Engine
// Resolves {{env.key}} and {{global.key}} syntax in request bodies and metadata

import type { VariableContext, VariableResolutionResult, UnresolvedVariable } from '../types/workspace'

// Regex to match {{env.key}} or {{global.key}}
const VARIABLE_PATTERN = /\{\{(env|global)\.([a-zA-Z0-9_]+)\}\}/g

/**
 * Resolves all variables in a string
 * @param text - String potentially containing {{env.key}} or {{global.key}}
 * @param context - Variable context (environment + global variables)
 * @returns Resolution result with resolved string and list of unresolved vars
 */
export function resolveVariables(
  text: string,
  context: VariableContext
): VariableResolutionResult {
  const unresolvedVars: UnresolvedVariable[] = []
  let resolved = text

  // Find all variable placeholders
  const matches = text.matchAll(VARIABLE_PATTERN)

  for (const match of matches) {
    const [placeholder, namespace, key] = match
    const isEnv = namespace === 'env'
    const isGlobal = namespace === 'global'

    // Look up variable value
    let value: string | undefined

    if (isEnv) {
      const envVar = context.environmentVariables.find(
        (v) => v.key === key && v.enabled
      )
      value = envVar?.value
    } else if (isGlobal) {
      const globalVar = context.globalVariables.find(
        (v) => v.key === key && v.enabled
      )
      value = globalVar?.value
    }

    if (value !== undefined) {
      // Replace this occurrence
      resolved = resolved.replace(placeholder, value)
    } else {
      // Track unresolved variable
      if (!unresolvedVars.some((v) => v.placeholder === placeholder)) {
        unresolvedVars.push({
          placeholder,
          key,
          namespace: namespace as 'env' | 'global',
        })
      }
    }
  }

  return {
    resolved,
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
