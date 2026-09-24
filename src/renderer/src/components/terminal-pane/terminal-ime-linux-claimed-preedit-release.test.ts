// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { installTerminalImeLinuxCandidateState } from './terminal-ime-linux-candidate-state'
import type { XtermBypassEvent } from './xterm-bypass-policy'

/**
 * The sibling selector suite drives the state object directly, so it cannot see a
 * missing listener. These drive the installed DOM wiring.
 *
 * `compositionend` matters on its own: an engine that DOES run a composition
 * session still emits the claimed `keyCode 229` keydowns that arm this window,
 * and both its commit and its cancel travel as `insertCompositionText`, which the
 * commit release deliberately ignores. Without a release at the session's end the
 * window outlived a cancelled preedit and swallowed the next literal Space.
 */
function event(overrides: Partial<XtermBypassEvent>): XtermBypassEvent {
  return {
    type: 'keydown',
    key: '',
    code: '',
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides
  }
}

function installOnElement(): {
  element: HTMLElement
  state: ReturnType<typeof installTerminalImeLinuxCandidateState>
  advance: (ms: number) => void
} {
  const element = document.createElement('div')
  let time = 1_000
  const state = installTerminalImeLinuxCandidateState(element, () => time, element)
  return { element, state, advance: (ms) => void (time += ms) }
}

function armWithClaimedLetter(
  state: ReturnType<typeof installTerminalImeLinuxCandidateState>
): void {
  const keydown = event({ key: 'Process', code: 'KeyN', keyCode: 229 })
  state.observeKeyboardEvent(keydown, state.classifyKeyboardEvent(keydown))
}

function claimsSpace(state: ReturnType<typeof installTerminalImeLinuxCandidateState>): boolean {
  return state.classifyKeyboardEvent(event({ key: ' ', code: 'Space', keyCode: 32 }))
    .imeOwnedPreeditGuardActive
}

describe('claimed-preedit window release wiring', () => {
  it.each(['compositionstart', 'compositionend'])('releases the window on %s', (eventType) => {
    const { element, state, advance } = installOnElement()
    armWithClaimedLetter(state)
    advance(40)
    expect(claimsSpace(state)).toBe(true)
    element.dispatchEvent(new CompositionEvent(eventType, { data: '你' }))
    expect(claimsSpace(state)).toBe(false)
    state.dispose()
  })

  it('releases the window on a commit that is not preedit text', () => {
    const { element, state, advance } = installOnElement()
    armWithClaimedLetter(state)
    advance(40)
    element.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: '你' }))
    expect(claimsSpace(state)).toBe(false)
    state.dispose()
  })

  it('keeps the window across a preedit-text input event', () => {
    const { element, state, advance } = installOnElement()
    armWithClaimedLetter(state)
    advance(40)
    element.dispatchEvent(
      new InputEvent('input', { inputType: 'insertCompositionText', data: 'ni' })
    )
    expect(claimsSpace(state)).toBe(true)
    state.dispose()
  })

  it('stops listening once disposed', () => {
    const { element, state, advance } = installOnElement()
    state.dispose()
    armWithClaimedLetter(state)
    advance(40)
    element.dispatchEvent(new CompositionEvent('compositionend', { data: '你' }))
    expect(claimsSpace(state)).toBe(true)
  })
})
