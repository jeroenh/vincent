import isHotkey from 'is-hotkey'
import { css } from '@emotion/css'
import React, { useEffect, useCallback, useRef, useState, useMemo, forwardRef } from 'react'
import {
  Editor,
  Element as SlateElement,
    Transforms,
    Range,
  createEditor,
} from 'slate'
import { withHistory } from 'slate-history'
import { Editable, useSlateStatic, ReactEditor, Slate, useSlate, withReact, useFocused, useSelected } from 'slate-react'
import { Button, Icon, Toolbar, Portal } from './components'
import Mention from './Mention.js'
import MarkButton from './MarkButton.js'
import { isImageUrl, insertImage } from './utils/image.js';
import Image from './Image.js'
import FileIcon from './FileIcon.js';
import Link from './Link.js'
import InsertLinkButton from './InsertLinkButton'
import BlockButton from './BlockButton'
import InsertImageButton from './InsertImageButton'
import {isAlignElement, isAlignType, toggleMark } from './utils/environment';


const HOTKEYS = {
  'mod+b': 'bold',
  'mod+i': 'italic',
  'mod+u': 'underline',
  'mod+`': 'code',
}


const RichTextEditor = forwardRef((props, ref) => {


    const renderElement = useCallback(props => <Element {...props} />, [])
    const renderLeaf = useCallback(props => <Leaf {...props} />, [])
    const [search, setSearch] = useState('')
    const [index, setIndex] = useState(0);
    const [initialValue, setInitialValue] = useState(initialText);
    const [target, setTarget] = useState(null)

    const editorRef = useRef();
    if (!editorRef.current) {
	editorRef.current = withImages(withMentions(withHistory(withLinks(withReact(createEditor())))))
    }
    const editor = editorRef.current;
    
    //const [editor] = useState(() => withImages(withMentions(withHistory(withLinks(withReact(createEditor()))))))

    const chars = props.people?.filter(c => 
	c.participant.name.toLowerCase().startsWith(search.toLowerCase())
    ).slice(0, 10)

    const onKeyDown = useCallback(
	event => {

	    for (const hotkey in HOTKEYS) {
		if (isHotkey(hotkey, event)) {
		    event.preventDefault()
		    const mark = HOTKEYS[hotkey]
		    toggleMark(editor, mark)
		}
	    }
	    if (target && chars.length > 0) {
		switch (event.key) {
		case 'ArrowDown':
		    event.preventDefault()
		    const prevIndex = index >= chars.length - 1 ? 0 : index + 1
		    setIndex(prevIndex)
		    break;
		case 'ArrowUp':
		    event.preventDefault()
		    const nextIndex = index <= 0 ? chars.length - 1 : index - 1
		    setIndex(nextIndex)
		    break
		case 'Tab':
		case 'Enter':
		    event.preventDefault()
		    Transforms.select(editor, target)
		    insertMention(editor, chars[index].participant.name, chars[index].participant.id)
		    setTarget(null)
		    
		    break
		case 'Escape':
		    event.preventDefault()
		    setTarget(null)
		    break
		}
	    } 
	},
	[chars, editor, index, target]
    )

    useEffect(() => {
	if (target && chars.length > 0 && ref.current) {
	    const el = ref.current
	    const domRange = ReactEditor.toDOMRange(editor, target)
	    const rect = domRange.getBoundingClientRect()
	    el.style.top = `${rect.top + window.pageYOffset + 24}px`
	    el.style.left = `${rect.left + window.pageXOffset}px`
	}
    }, [chars.length, editor, index, search, target])


    const resetEditor = (editor, nodes) => {

	const { selection } = editor;

	editor.removeNodes({ at: { anchor: editor.start([]), focus: editor.end([]) }});
	if (nodes) {
	    editor.insertNodes(nodes);
	}
	const point = { path: [0, 0], offset: 0 }
	/* reset selection and history */
	editor.selection = { anchor: point, focus: point };
	editor.history = { redos: [], undos: [] }; 
	//editor.select(selection ?? editor.end([]));
    }
	

    
    useEffect(() => {
	if (props.initialValue) {
	    resetEditor(editor, props.initialValue);
	}

    }, [props.initialValue]);

    
    const onEditorChange = (value) => {
	
	const { selection } = editor
	const isAstChange = editor.operations.some(
	    op => 'set_selection' !== op.type
	)

	if (isAstChange) {
	    // Save the value to Local Storage.
	    //const content = JSON.stringify(value)
	    props.setValue(value);
	}
	
	if (selection && Range.isCollapsed(selection)) {
	    const [start] = Range.edges(selection)
	    const wordBefore = Editor.before(editor, start, { unit: 'word' })
	    const before = wordBefore && Editor.before(editor, wordBefore)
	    const beforeRange = before && Editor.range(editor, before, start)
	    const beforeText = beforeRange && Editor.string(editor, beforeRange)
	    const beforeMatch = beforeText && beforeText.match(/^@(\w+)$/)
	    const after = Editor.after(editor, start)
	    const afterRange = Editor.range(editor, start, after)
	    const afterText = Editor.string(editor, afterRange)
	    const afterMatch = afterText.match(/^(\s|$)/)
	    if (beforeMatch && afterMatch) {
		setTarget(beforeRange)
		setSearch(beforeMatch[1])
		setIndex(0)
		return
	    }
	}
	setTarget(null)
    }
				   

    
    return (

	<Slate
	    editor={editor}
	    initialValue={props.value}
	    onChange={(value) => onEditorChange(value)}
	>

	    <Toolbar>
		<MarkButton format="bold" icon="format_bold" />
		<MarkButton format="italic" icon="format_italic" />
		<MarkButton format="underline" icon="format_underlined" />
		<MarkButton format="code" icon="code" />
		<InsertLinkButton />
		<BlockButton format="heading-one" icon="looks_one" />
		<BlockButton format="heading-two" icon="looks_two" />
		<BlockButton format="block-quote" icon="format_quote" />
		<BlockButton format="numbered-list" icon="format_list_numbered" />
		<BlockButton format="bulleted-list" icon="format_list_bulleted" />
		<BlockButton format="left" icon="format_align_left" />
		<BlockButton format="center" icon="format_align_center" />
		<BlockButton format="right" icon="format_align_right" />
		<BlockButton format="justify" icon="format_align_justify" />
		<InsertImageButton uploadFiles={props.uploadFiles}/>

	    </Toolbar>
	    <Editable
		className={props.className || "note_input"}
		disableDefaultStyles
		id="note_input"
		renderElement={renderElement}
		renderLeaf={renderLeaf}
		spellCheck
		ref={ref}
		onKeyDown={onKeyDown}
		placeholder={props.placeholder || "Post a message or @ to tag someone"}
		renderPlaceholder={({ children, attributes }) => (
		    <span {...attributes}>
			{children}
		    </span>
		)}
	    />


	{target && chars.length > 0 && (
        <Portal>
          <div
            ref={ref}
            style={{
              top: '-9999px',
              left: '-9999px',
              position: 'absolute',
              zIndex: 1,
              padding: '8px',
              background: 'white',
              borderRadius: '4px',
              boxShadow: '0 1px 5px rgba(0,0,0,.2)',
            }}
            data-cy="mentions-portal"
          >
              {chars.map((char, i) => (
              <div
                key={char.participant.id}
                onClick={e => {
                  Transforms.select(editor, target)
                      insertMention(editor, char.participant.name, char.participant.id)
                      setTarget(null)
                  }}
                  style={{
                      padding: '2px 5px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      background: i === index ? '#B4D5FF' : 'transparent',
                  }}
              >
                  {char.participant.name} {char.participant.group && `${char.participant.group}`}
              </div>
            ))}
          </div>
        </Portal>
      )}

    </Slate>
  )
})




const Element = (props) => {

    const { attributes, children, element } = props

    const style = {}

    if (isAlignElement(element)) {
        style.textAlign = element.align
    }


    switch (element.type) {
    case 'block-quote':
      return (
        <blockquote style={style} {...attributes}>
          {children}
        </blockquote>
      )
    case 'bulleted-list':
      return (
        <ul style={style} {...attributes}>
          {children}
        </ul>
      )
    case 'heading-one':
      return (
        <h1 style={style} {...attributes}>
          {children}
        </h1>
      )
    case 'heading-two':
      return (
        <h2 style={style} {...attributes}>
          {children}
        </h2>
      )
    case 'list-item':
      return (
        <li style={style} {...attributes}>
          {children}
        </li>
      )
  case 'numbered-list':
      return (
          <ol style={style} {...attributes}>
              {children}
          </ol>
      )
    case 'mention':
      return <Mention {...props} />
    case 'image':
	return <Image {...props} />
    case 'file':
	return <FileIcon {...props} />
    case 'link':
	return <Link {...props} />
    default:
      return (
          <div style={style} {...attributes}>
              {children}
          </div>
      )
  }
}
const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>
  }
  if (leaf.code) {
    children = <code>{children}</code>
  }
  if (leaf.italic) {
    children = <em>{children}</em>
  }
  if (leaf.underline) {
    children = <u>{children}</u>
  }
  return <span {...attributes}>{children}</span>
}

const withMentions = editor => {
  const { isInline, isVoid, markableVoid } = editor
  editor.isInline = element => {
    return element.type === 'mention' ? true : isInline(element)
  }
  editor.isVoid = element => {
    return element.type === 'mention' ? true : isVoid(element)
  }
  editor.markableVoid = element => {
    return element.type === 'mention' || markableVoid(element)
  }
  return editor
}

const insertMention = (editor, character, part_id) => {
  const mention = {
      type: 'mention',
      character,
      participant: part_id,
      children: [{ text: '' }],
  }
  Transforms.insertNodes(editor, mention)
  Transforms.move(editor)
}




const withImages = editor => {
    const { insertData, isVoid } = editor

    editor.isVoid = element => {
	return element.type === 'image' ? true : isVoid(element)
	//return ['image', 'file'].includes(element.type) ? true : isVoid(element)
    }

    editor.insertData = data => {
	const text = data.getData('text/plain')
	const { files } = data

	
	if (files && files.length > 0) {
	    Array.from(files).forEach(file => {
		const reader = new FileReader()
		const [mime] = file.type.split('/')
		if (mime === 'image') {
		    reader.addEventListener('load', () => {
			const url = reader.result
			insertImage(editor, url)
		    })
		    reader.readAsDataURL(file)
		}
	    })
	} else if (isImageUrl(text)) {
	    insertImage(editor, text)
	} else {
	    insertData(data)
	}
    }
    
    return editor
}



const withLinks = (editor) => {
    const { isInline } = editor;

    editor.isInline = (element) =>
    element.type === "link" ? true : isInline(element);
    
    return editor;
};


const initialText = [
    {
	type: 'paragraph',
	children: [{ text: '' }],
    },
]

export default RichTextEditor;
