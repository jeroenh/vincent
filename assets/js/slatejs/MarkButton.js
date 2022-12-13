
import React, { Fragment}  from 'react';
import { Button, Icon, Toolbar, Portal } from './components'
import {useSlate} from 'slate-react';
import {isMarkActive, toggleMark} from './utils/environment.js'

const MarkButton = ({ format, icon }) => {
    const editor = useSlate()
    return (
      <Button
        active={isMarkActive(editor, format)}
        onMouseDown={event => {
          event.preventDefault()
          toggleMark(editor, format)
        }}
      >
        <Icon>{icon}</Icon>
      </Button>
    )
}

export default MarkButton;
