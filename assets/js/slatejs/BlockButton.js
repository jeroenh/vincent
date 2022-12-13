import {useSlate} from 'slate-react';
import React, { Fragment}  from 'react';
import { Button, Icon, Toolbar, Portal } from './components'
import {isBlockActive, isAlignType, toggleBlock} from './utils/environment.js'


const BlockButton = ({ format, icon }) => {
    const editor = useSlate()
    return (
      <Button
        active={isBlockActive(
          editor,
          format,
          isAlignType(format) ? 'align' : 'type'
        )}
        onMouseDown={event => {
          event.preventDefault()
          toggleBlock(editor, format)
        }}
      >
        <Icon>{icon}</Icon>
      </Button>
    )
}
export default BlockButton;
