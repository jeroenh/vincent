import React from 'react';
import { Modal, Row, Col, Alert, Button} from "react-bootstrap";
import { useState, useEffect } from 'react';
import StatusForm from './StatusForm';
import ComponentAPI from './ComponentAPI';

const componentapi = new ComponentAPI();

const EditStatusModal = ({showModal, hideModal, component,vuls, compstatus, user, submit, clone}) => {

    const [errorMessage, setErrorMessage] = useState("");
    const [changes, setChanges] = useState(false);
    
    const submitStatus = async (data) => {

	if (submit) {
	    submit(data);
	    hideModal();
	} else {
	    await componentapi.editStatus(compstatus.id, data).then((response) => {
		hideModal();
            }).catch(err => {
		setErrorMessage(`Error editing status: ${err.message}: ${err.response.data.detail}`);
		console.log(err);
            });
	}
    }


    const handleClose = () => {
        if (changes) {
            if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                setChanges(false);
                hideModal();
            }
        } else {
            hideModal();
        }
    };

    
    return (
	showModal ? 
            <Modal show={showModal} onHide={handleClose} size="fullscreen" centered backdrop="static">
		<Modal.Header closeButton className="border-bottom">
                    <Modal.Title>{component ?
				  <>
				      {clone ? 
				       `Clone Component Status` :
				       `Edit Component Status`
				      }
				  </>
				  :
				  `Add Component Status`}
		    </Modal.Title>
		</Modal.Header>
		<Modal.Body>
		    <StatusForm
			user={user}
			vuls={vuls || []}
			editVul={[compstatus?.id] || null}
			editStatus={component}
			submit={submitStatus}
			cancel={handleClose}
			changes={setChanges}
			clone={clone}
		    />
		</Modal.Body>
	    </Modal>
	:
	""
    )
}

export default EditStatusModal;

/*
*/
