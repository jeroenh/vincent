
import React, {useState} from 'react';
import { Button, Icon } from './components'
import {useSlateStatic} from 'slate-react';
import {insertLink} from './utils/link.js'
import InsertLinkDialog from './InsertLinkDialog';

const InsertLinkButton = () => {
    const editor = useSlateStatic();

    const [show, setShow] = useState(false);

    const doInsert = (text, link) => {
	insertLink(editor, text, link);
	hide();
    }
    
    const hide = () => {
	setShow(false);
    }

    return (
	<>
	<Button
	    onMouseDown = {event => {
		event.preventDefault();
		setShow(true);
	    }}>
	    <Icon>link</Icon>
	</Button>
	    <InsertLinkDialog
		showModal={show}
		hideModal={hide}
		insertLink={doInsert}
	    />
	</>
    )
}
export default InsertLinkButton;
