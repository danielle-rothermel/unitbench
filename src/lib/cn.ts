import clsx from 'clsx'

export function cn(...values: Parameters<typeof clsx>): string {
  return clsx(...values)
}
