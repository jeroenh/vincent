
import {
  Editor,
  Element as SlateElement,
} from 'slate'
import { Transforms } from "slate";


export const LIST_TYPES = ['numbered-list', 'bulleted-list']
export const TEXT_ALIGN_TYPES = ['left', 'center', 'right', 'justify']

export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac OS X/.test(navigator.userAgent)
export const IS_ANDROID =
  typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent)



export  const isBlockActive = (editor, format, blockType = 'type') => {
    const { selection } = editor
    if (!selection) return false
    const [match] = Array.from(
      Editor.nodes(editor, {
        at: Editor.unhangRange(editor, selection),
        match: n => {
          if (!Editor.isEditor(n) && SlateElement.isElement(n)) {
            if (blockType === 'align' && isAlignElement(n)) {
              return n.align === format
            }
            return n.type === format
          }
          return false
        },
      })
    )
    return !!match
  }


export const isMarkActive = (editor, format) => {
    const marks = Editor.marks(editor)
    return marks ? marks[format] === true : false
  }


export const toggleBlock = (editor, format) => {
    const isActive = isBlockActive(
      editor,
      format,
      isAlignType(format) ? 'align' : 'type'
    )
    const isList = isListType(format)
    Transforms.unwrapNodes(editor, {
      match: n =>
        !Editor.isEditor(n) &&
        SlateElement.isElement(n) &&
        isListType(n.type) &&
        !isAlignType(format),
      split: true,
    })
    let newProperties
    if (isAlignType(format)) {
      newProperties = {
        align: isActive ? undefined : format,
      }
    } else {
      newProperties = {
        type: isActive ? 'paragraph' : isList ? 'list-item' : format,
      }
    }
    Transforms.setNodes(editor, newProperties)
    if (!isActive && isList) {
      const block = { type: format, children: [] }
      Transforms.wrapNodes(editor, block)
    }
}

export const toggleMark = (editor, format) => {
    const isActive = isMarkActive(editor, format)
    if (isActive) {
      Editor.removeMark(editor, format)
    } else {
      Editor.addMark(editor, format, true)
    }
  }
  
export const isAlignType = format => {
    return TEXT_ALIGN_TYPES.includes(format)
}
export const isListType = format => {
    return LIST_TYPES.includes(format)
}
export const isAlignElement = element => {
    return 'align' in element
}
