import React, {useState} from 'react';
import { Modal, Alert, Form, Button } from "react-bootstrap";


const InsertImageDialog = ({showModal, hideModal, insertImage, error}) => {

    
    function submitForm(e) {
	e.preventDefault();
	const formData = new FormData(e.target),
              formDataObj = Object.fromEntries(formData.entries());
        if (formDataObj.image.size > 0) {
	    insertImage(formDataObj, formDataObj.image.name);
	}
    }

    
    return (
	
	<Modal show={showModal} onHide={hideModal} size="sm" centered backdrop="static">
	    <Form onSubmit={(e) => submitForm(e) }>
            <Modal.Header closeButton className="border-bottom">                
		<Modal.Title>Insert File</Modal.Title>              
            </Modal.Header>                                                     
		<Modal.Body>
		    {error &&
		     <Alert variant="danger">{error}</Alert>
		    }
		<Form.Group controlId="formFile" className="mb-3">          
                    <Form.Label>File</Form.Label>                           
                    <Form.Control name="image" type="file" />                
                </Form.Group>    
	    </Modal.Body>                                                       
            <Modal.Footer>                                                      
		<Button variant="outline-secondary" data-testid="cancel-insertimage" type="cancel" onClick={(e)=>(e.preventDefault(), hideModal())}>Cancel</Button>                                                                    
		<Button type="submit" variant="primary">Add File</Button>                                    
            </Modal.Footer>
            </Form>
        </Modal>
    )

}


	    
export default InsertImageDialog;
