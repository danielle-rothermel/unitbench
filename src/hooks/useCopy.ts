'use client'

import { useState } from 'react'

export function useCopy(): [
  copied: string | null,
  copy: (value: string | null | undefined) => void,
] {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (value: string | null | undefined) => {
    if (!value) return
    void navigator.clipboard?.writeText(value)
    setCopied(value)
    window.setTimeout(() => setCopied(null), 1500)
  }

  return [copied, copy]
}
