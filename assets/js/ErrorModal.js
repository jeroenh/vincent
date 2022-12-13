import React from 'react'
import { useState, useEffect} from 'react';
import { Modal, Button } from "react-bootstrap";
import DRFErrorMessage from "./DRFErrorMessage";

const ErrorModal = ({ showModal, hideModal, message, drf }) => {

    return (
        <Modal show={showModal} onHide={hideModal} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Error</Modal.Title>
        </Modal.Header>
            <Modal.Body>
		{drf ?
                 <DRFErrorMessage
                     error={drf}
                 />
		 :
		 <div className="alert alert-danger">{message}</div>
		}
	    </Modal.Body>
		 
        <Modal.Footer>
	    <Button variant="primary" onClick={hideModal}>
		Ok
	    </Button>
        </Modal.Footer>
      </Modal>
    )
}
 
export default ErrorModal;
