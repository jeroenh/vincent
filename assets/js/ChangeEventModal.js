import React from 'react'
import { useState, useEffect} from 'react';
import { Modal, Button, Form } from "react-bootstrap";

const ChangeEventModal = ({ showModal, hideModal, confirmModal, users, event}) => {

    const [invalidSelection, setInvalidSelection] = useState(false);
    const [buttonDisabled, setButtonDisabled] = useState(false);
    const [user, setUser] = useState("");
    const [newEvent, setNewEvent] = useState(false);
    
    function submitForm(e) {
	/* get form check */
	e.preventDefault();
	const formData = new FormData(e.target),
              formDataObj = Object.fromEntries(formData.entries());
	formDataObj['newevent'] = newEvent;
	formDataObj['date'] = event.startStr.slice(0, 10);
	console.log(formDataObj);
	confirmModal(formDataObj, event);
	hideModal();
    };


    const removeEvent = (e) => {
	confirmModal({'remove': event.id});
	hideModal();

    }

    useEffect(() => {

	if (event?.extendedProps?.user) {
	    let def = users.find(x => x.name === event.extendedProps.user);
	    setUser(def.id);
	    setNewEvent(false);
	} else {
	    setNewEvent(true);
	}
	
	setButtonDisabled(false);
    }, [showModal]);
    
    return (
        <Modal show={showModal} onHide={hideModal} centered backdrop="static">
	    <Form onSubmit={(e) => submitForm(e) }>
		<Modal.Header closeButton className="mb-0">
		    <Modal.Title>Modify Event</Modal.Title>
		</Modal.Header>
		<Modal.Body>
		    <Form.Group controlId="event type" className="mb-3">
			<Form.Label>Event Type</Form.Label>
			<Form.Select name="event_id" defaultValue={event?.extendedProps?.event_id} aria-label="Set event type">
			    <option key="triage" value="1">Triage</option>
			    <option key="oof" value="2">Out of Office</option>
			</Form.Select>
		    </Form.Group>
		    
		    <Form.Group controlId="formFile" className="mb-3">
			<Form.Label>User</Form.Label>
			<Form.Select name="assign_user" value={user} onChange={(e)=>setUser(e.target.value)}aria-label="select user">              
                            {users.map((choice) => (
                                <option key={choice.id} value={choice.id}>{choice.name}</option>
                            ))}                                                                                
                        </Form.Select> 
		    </Form.Group>
		    
		</Modal.Body>
		<Modal.Footer className="d-flex justify-content-between">
		    <Button variant="danger" onClick={removeEvent}>
			Remove Event
		    </Button>

		    <div className="d-flex gap-2">
			<Button variant="secondary" onClick={hideModal}>
			    Cancel
			</Button>
			<Button variant="primary" type="submit" disabled={buttonDisabled}>
			    Submit
			</Button>
		    </div>
		</Modal.Footer>
	    </Form>
      </Modal>
    )
}

export default ChangeEventModal;
