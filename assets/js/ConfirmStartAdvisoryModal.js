import React from 'react'
import { useState, useEffect} from 'react';
import { Modal, Button } from "react-bootstrap";
 
const ConfirmStartAdvisoryModal = (props) => {

    return (
        <Modal show={true} onHide={props.hideModal} centered>
            <Modal.Header closeButton>
		<Modal.Title>Confirm this action</Modal.Title>
            </Modal.Header>
            <Modal.Body>
		Are you sure you want to start the advisory for this case?
		
	    </Modal.Body>
            <Modal.Footer>
		<Button data-testid="cancel-confirm" variant="secondary" onClick={props.hideModal}>
		    Cancel
		</Button>
		<Button variant="primary" onClick={props.doAction}>
		    Yes
		</Button>
		
            </Modal.Footer>
	</Modal>
    )
}
 
export default ConfirmStartAdvisoryModal;
