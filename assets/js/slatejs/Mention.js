
import { useSlateStatic,  useFocused, useSelected } from 'slate-react'
import React, { Fragment}  from 'react';
import { Button, Icon, Toolbar, Portal } from './components'

import { IS_MAC } from './utils/environment.js';

const Mention = ({ attributes, children, element }) => {
    const selected = useSelected()
    const focused = useFocused()
    const style = {
	padding: '3px 3px 2px',
	margin: '0 1px',
	verticalAlign: 'baseline',
	display: 'inline-block',
	    borderRadius: '4px',
	backgroundColor: '#eee',
	fontSize: '0.9em',
	boxShadow: selected && focused ? '0 0 0 2px #B4D5FF' : 'none',
    }
    // See if our empty text child has any styling marks applied and apply those
    if (element.children[0].bold) {
	style.fontWeight = 'bold'
    }
    if (element.children[0].italic) {
	style.fontStyle = 'italic'
    }



    return (
	<span
	    {...attributes}
	    contentEditable={false}
	    data-cy={`mention-${element.character.replace(' ', '-')}`}
	    style={style}
	>
	    {/* Prevent Chromium from interrupting IME when moving the cursor */}
	    {/* 1. span + inline-block 2. div + contenteditable=false */}
	    <div contentEditable={false}>
	        {IS_MAC ? (
	            // Mac OS IME https://github.com/ianstormtaylor/slate/issues/3490
	            <Fragment>
			{children}@{element.character}
	            </Fragment>
	        ) : (
	            // Others like Android https://github.com/ianstormtaylor/slate/pull/5360
	            <Fragment>
			@{element.character}
			{children}
	            </Fragment>
	        )}
	    </div>
	</span>
    )
}


export default Mention;
