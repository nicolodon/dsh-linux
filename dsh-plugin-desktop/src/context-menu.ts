/** Localized context menu for text editing, selection, and link actions. */

import {
  clipboard,
  Menu,
  type BrowserWindow,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
} from 'electron'
import { LABELS, type NativeMenuLocale } from './native-menu.ts'

export function buildContextMenuTemplate(
  params: ContextMenuParams,
  locale: NativeMenuLocale = 'en',
): MenuItemConstructorOptions[] {
  const label = LABELS[locale]
  const items: MenuItemConstructorOptions[] = []

  if (params.linkURL && params.linkURL.trim().length > 0) {
    items.push({
      label: locale === 'zh-CN' ? '复制链接地址' : 'Copy Link Address',
      click: () => {
        clipboard.writeText(params.linkURL)
      },
    })
  }

  if (params.isEditable) {
    if (items.length > 0) items.push({ type: 'separator' })
    items.push(
      { label: label.undo, role: 'undo', enabled: params.editFlags.canUndo },
      { label: label.redo, role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { label: label.cut, role: 'cut', enabled: params.editFlags.canCut },
      { label: label.copy, role: 'copy', enabled: params.editFlags.canCopy },
      { label: label.paste, role: 'paste', enabled: params.editFlags.canPaste },
      { label: label.pasteAndMatchStyle, role: 'pasteAndMatchStyle', enabled: params.editFlags.canPaste },
      { label: label.delete, role: 'delete', enabled: params.editFlags.canDelete },
      { type: 'separator' },
      { label: label.selectAll, role: 'selectAll', enabled: params.editFlags.canSelectAll },
    )
  } else if (params.selectionText && params.selectionText.trim().length > 0) {
    if (items.length > 0) items.push({ type: 'separator' })
    items.push(
      { label: label.copy, role: 'copy', enabled: params.editFlags.canCopy },
      { type: 'separator' },
      { label: label.selectAll, role: 'selectAll', enabled: params.editFlags.canSelectAll },
    )
  }

  return cleanMenuSeparators(items)
}

function cleanMenuSeparators(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  const result: MenuItemConstructorOptions[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (item.type === 'separator') {
      if (result.length === 0 || result[result.length - 1]?.type === 'separator') {
        continue
      }
    }
    result.push(item)
  }
  if (result.length > 0 && result[result.length - 1]?.type === 'separator') {
    result.pop()
  }
  return result
}

export function installContextMenu(
  window: BrowserWindow,
  resolveLocale: () => NativeMenuLocale = () => 'en',
): () => void {
  const handleContextMenu = (
    _event: Electron.Event,
    params: ContextMenuParams,
  ): void => {
    if (window.isDestroyed()) return
    const template = buildContextMenuTemplate(params, resolveLocale())
    if (template.length === 0) return
    const menu = Menu.buildFromTemplate(template)
    menu.popup({ window })
  }

  window.webContents.on('context-menu', handleContextMenu)
  return () => {
    if (!window.isDestroyed()) {
      window.webContents.off('context-menu', handleContextMenu)
    }
  }
}
