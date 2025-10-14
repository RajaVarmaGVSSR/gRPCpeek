type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[]
  | Record<string, boolean | undefined | null>

function pushToken(target: string[], value: ClassValue) {
  if (!value && value !== 0) {
    return
  }

  if (typeof value === 'string' || typeof value === 'number') {
    target.push(String(value))
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      pushToken(target, item)
    }
    return
  }

  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (value[key]) {
        target.push(key)
      }
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const tokens: string[] = []
  for (const input of inputs) {
    pushToken(tokens, input)
  }
  return tokens.join(' ')
}
