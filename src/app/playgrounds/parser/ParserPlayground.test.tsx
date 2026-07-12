import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ParserPlayground from './ParserPlayground'

function profilesResponse(profileIds: string[]) {
  return {
    ok: true,
    json: async () => ({ profile_ids: profileIds, parser_version: 'v1' }),
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ParserPlayground', () => {
  it('loads the catalog once and does not refetch it after selecting a profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      profilesResponse(['humaneval-best-effort', 'strict']),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ParserPlayground />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Profile'), {
      target: { value: 'strict' },
    })

    await waitFor(() => expect(screen.getByLabelText('Profile')).toHaveValue('strict'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('corrects an invalid default profile after the catalog loads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(profilesResponse(['strict'])))

    render(<ParserPlayground />)

    await waitFor(() => expect(screen.getByLabelText('Profile')).toHaveValue('strict'))
  })
})
