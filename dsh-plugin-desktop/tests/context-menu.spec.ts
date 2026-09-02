import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow, ContextMenuParams } from 'electron'
import { buildContextMenuTemplate, installContextMenu } from '../src/context-menu.ts'

const mockClipboard = {
  writeText: vi.fn(),
}

const mockMenu = {
  buildFromTemplate: vi.fn((template: unknown) => ({
    popup: vi.fn(),
    template,
  })),
}

vi.mock('electron', () => ({
  clipboard: {
    writeText: (text: string) => mockClipboard.writeText(text),
  },
  Menu: {
    buildFromTemplate: (template: unknown) => mockMenu.buildFromTemplate(template),
  },
}))

function createParams(overrides: Record<string, unknown> = {}): ContextMenuParams {
  return {
    x: 10,
    y: 10,
    linkURL: '',
    linkText: '',
    pageURL: 'http://localhost/',
    frameURL: 'http://localhost/',
    srcURL: '',
    mediaType: 'none',
    hasImageContents: false,
    isEditable: false,
    selectionText: '',
    titleText: '',
    misspelledWord: '',
    dictionarySuggestions: [],
    frameCharset: 'utf-8',
    menuSourceType: 'mouse',
    mediaFlags: {
      inError: false,
      isPaused: false,
      isMuted: false,
      hasAudio: false,
      isLooping: false,
      isControlsVisible: false,
      canToggleControls: false,
      canRotate: false,
      canPrint: false,
      canSave: false,
      canShowPictureInPicture: false,
      isShowingPictureInPicture: false,
      canLoop: false,
    },
    editFlags: {
      canUndo: false,
      canRedo: false,
      canCut: false,
      canCopy: false,
      canPaste: false,
      canDelete: false,
      canSelectAll: false,
      canEditRichly: false,
    },
    ...overrides,
  } as unknown as ContextMenuParams
}

describe('context-menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds full editing menu when right-clicking an editable field', () => {
    const params = createParams({
      isEditable: true,
      editFlags: {
        canUndo: true,
        canRedo: false,
        canCut: true,
        canCopy: true,
        canPaste: true,
        canDelete: true,
        canSelectAll: true,
        canEditRichly: false,
      },
    })

    const template = buildContextMenuTemplate(params, 'en')
    expect(template).toEqual([
      { label: 'Undo', role: 'undo', enabled: true },
      { label: 'Redo', role: 'redo', enabled: false },
      { type: 'separator' },
      { label: 'Cut', role: 'cut', enabled: true },
      { label: 'Copy', role: 'copy', enabled: true },
      { label: 'Paste', role: 'paste', enabled: true },
      { label: 'Paste and Match Style', role: 'pasteAndMatchStyle', enabled: true },
      { label: 'Delete', role: 'delete', enabled: true },
      { type: 'separator' },
      { label: 'Select All', role: 'selectAll', enabled: true },
    ])
  })

  it('builds copy/selectAll menu for selected text in read-only area', () => {
    const params = createParams({
      selectionText: 'Selected Text to Copy',
      editFlags: {
        canUndo: false,
        canRedo: false,
        canCut: false,
        canCopy: true,
        canPaste: false,
        canDelete: false,
        canSelectAll: true,
        canEditRichly: false,
      },
    })

    const template = buildContextMenuTemplate(params, 'en')
    expect(template).toEqual([
      { label: 'Copy', role: 'copy', enabled: true },
      { type: 'separator' },
      { label: 'Select All', role: 'selectAll', enabled: true },
    ])
  })

  it('builds link menu when right-clicking a hyperlink', () => {
    const params = createParams({
      linkURL: 'https://example.com/docs',
      linkText: 'Docs',
    })

    const template = buildContextMenuTemplate(params, 'en')
    expect(template).toHaveLength(1)
    expect(template[0]?.label).toBe('Copy Link Address')

    template[0]?.click?.(undefined as never, undefined as never, undefined as never)
    expect(mockClipboard.writeText).toHaveBeenCalledWith('https://example.com/docs')
  })

  it('localizes menu items in Chinese (zh-CN)', () => {
    const params = createParams({
      linkURL: 'https://example.com',
      isEditable: true,
      editFlags: {
        canUndo: true,
        canRedo: true,
        canCut: true,
        canCopy: true,
        canPaste: true,
        canDelete: true,
        canSelectAll: true,
        canEditRichly: false,
      },
    })

    const template = buildContextMenuTemplate(params, 'zh-CN')
    expect(template[0]?.label).toBe('复制链接地址')
    expect(template.some(item => item.label === '撤销')).toBe(true)
    expect(template.some(item => item.label === '拷贝')).toBe(true)
    expect(template.some(item => item.label === '粘贴')).toBe(true)
    expect(template.some(item => item.label === '全选')).toBe(true)
  })

  it('returns empty template for blank clicks without selection or editable context', () => {
    const params = createParams()
    const template = buildContextMenuTemplate(params, 'en')
    expect(template).toEqual([])
  })

  it('installs context-menu event listener on BrowserWindow webContents and pops up menu', () => {
    const listeners: Record<string, (event: unknown, params: unknown) => void> = {}
    const webContents = {
      on: vi.fn((event: string, listener: (e: unknown, p: unknown) => void) => {
        listeners[event] = listener
      }),
      off: vi.fn((event: string, listener: (e: unknown, p: unknown) => void) => {
        if (listeners[event] === listener) delete listeners[event]
      }),
    }
    const mockWindow = {
      isDestroyed: vi.fn(() => false),
      webContents,
    } as unknown as BrowserWindow

    const uninstall = installContextMenu(mockWindow, () => 'en')
    expect(webContents.on).toHaveBeenCalledWith('context-menu', expect.any(Function))

    const params = createParams({
      isEditable: true,
      editFlags: {
        canUndo: true,
        canRedo: false,
        canCut: true,
        canCopy: true,
        canPaste: true,
        canDelete: true,
        canSelectAll: true,
        canEditRichly: false,
      },
    })

    listeners['context-menu']?.({}, params)
    expect(mockMenu.buildFromTemplate).toHaveBeenCalledOnce()

    uninstall()
    expect(webContents.off).toHaveBeenCalledWith('context-menu', expect.any(Function))
  })
})
