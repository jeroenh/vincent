import React, {useState, useEffect } from 'react';
import { Modal, Alert, Form, Button } from "react-bootstrap";
import {useSlate} from 'slate-react';
import {Editor} from 'slate';

const InsertLinkDialog = ({showModal, hideModal, insertLink}) => {

    const editor = useSlate()
    const [text, setText] = useState("");
    const [isInvalid, setIsInvalid] = useState(false);
    const [url, setUrl] = useState("");

    useEffect(() => {

	if (editor.selection) {
	    const selectedText = Editor.string(editor, editor.selection);
	    setText(selectedText);
	} else {
	    setText("");
	}
	setUrl("");

    }, [showModal]);

    const validate = () => {
	try {
	    if (Boolean(new URL(url))) {
		setIsInvalid(false);
		return insertLink(text, url);
	    } else {
		setIsInvalid(true);
	    }
	} catch (e) {
	    setIsInvalid(true);
	}
    }
    
    
    return (
	
	<Modal show={showModal} onHide={hideModal} size="sm" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">                
		<Modal.Title>Add Link</Modal.Title>              
            </Modal.Header>                                                     
            <Modal.Body>
		<Form.Group className="mb-3">
		    <Form.Label>Text</Form.Label>
		    <Form.Control name="text" value={text} onChange={(e)=>setText(e.target.value)} />
		</Form.Group>
		<Form.Group>
		    <Form.Label>URL <span className="required">*</span></Form.Label>
		    <Form.Control name="url" isInvalid={isInvalid} value={url} onChange={(e)=>setUrl(e.target.value)} />
		    {isInvalid &&
		     <Form.Text>URL should start with "http(s)://"</Form.Text>
		    }

		</Form.Group>
	    </Modal.Body>                                                       
            <Modal.Footer>                                                      
		<Button variant="outline-secondary" data-testid="cancel-insertlink" type="cancel" onClick={(e)=>(e.preventDefault(), hideModal())}>Cancel</Button>                                                                    
		<Button type="submit" onClick={(e)=>validate()} variant="primary">Add Link</Button>                                    
            </Modal.Footer>                                                 
        </Modal>
    )

}


	    
export default InsertLinkDialog;
