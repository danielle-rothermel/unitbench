import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CodePane } from '@/components/code/CodePane'

describe('CodePane', () => {
  it('keeps legacy Highlight.js token colors available', () => {
    const { container } = render(
      <CodePane label="Code" value="def add(a, b): return a + b" language="python" />,
    )

    expect(container.querySelector('.hljs-keyword')).not.toBeNull()

    const stylesheet = readFileSync(resolve('src/app/globals.css'), 'utf8')
    expect(stylesheet).toMatch(
      /\.hljs-keyword,[\s\S]*?color: var\(--syntax-keyword\);/,
    )
  })
})
