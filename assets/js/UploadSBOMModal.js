import React from 'react'
import { useState, useEffect} from 'react';
import { Modal, Button, Form } from "react-bootstrap";

const UploadSBOMModal = ({ showModal, hideModal, confirmModal, user}) => {

    const [invalidSelection, setInvalidSelection] = useState(false);
    const [buttonDisabled, setButtonDisabled] = useState(false);
    
    function submitForm(e) {
	/* get form check */
	e.preventDefault();
	if (buttonDisabled) {
            return;
        }
	const formData = new FormData(e.target),
              formDataObj = Object.fromEntries(formData.entries());
        console.log(formDataObj);
	console.log(e);
	if (formDataObj.file.size > 0) {
            setButtonDisabled(true);	
	    confirmModal(formDataObj);
	} else {
	    setInvalidSelection(true);
	}
    };

    useEffect(() => {
	setButtonDisabled(false);
    }, [showModal]);
    
    return (
        <Modal show={showModal} onHide={hideModal} centered backdrop="static">
	    <Form onSubmit={(e) => submitForm(e) }>
		<Modal.Header closeButton className="mb-0">
		    <Modal.Title>Upload SBOM file (SPDX format) to load components</Modal.Title>
		</Modal.Header>
		<Modal.Body>
		    
		    <small className="form-text text-muted">
			All packages and package dependencies will be uploaded.
		    </small>
		    {user.roles.length == 0 && user.groups.length > 0 &&
		     <Form.Group controlId="group" className="mb-3">
			 <Form.Label>Choose Group to claim ownership of primary component</Form.Label>
			 <Form.Select name="group" aria-label="Select Group">  
			     {user.groups.map((g, index) => (
			     <option key={g.uuid} value={g.uuid}>{g.name}</option>
			     ))}
			 </Form.Select>
		     </Form.Group>
		    }
		    <Form.Group controlId="formFile" className="mb-3">
			<Form.Label>File</Form.Label>
			<Form.Control name="file" type="file" />
		    </Form.Group>
		    {invalidSelection &&
		     <Form.Text className="error">
			 File is required.
		     </Form.Text>
		    }

		</Modal.Body>
		<Modal.Footer>
		    <Button variant="secondary" onClick={hideModal}>
			Cancel
		    </Button>
		    <Button variant="primary" type="submit" disabled={buttonDisabled}>
			Submit
		    </Button>
		</Modal.Footer>
	    </Form>
      </Modal>
    )
}

export default UploadSBOMModal;
