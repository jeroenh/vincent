import React from 'react'
import { useState, useEffect} from 'react';
import { Modal, Button, Form } from "react-bootstrap";
import CaseThreadAPI from './ThreadAPI';

const threadapi = new CaseThreadAPI();

const UnassignModule = ({ showModal, hideModal, confirmModal, owners, type, caseInfo }) => {

    const [invalidSelection, setInvalidSelection] = useState(false);
    const [selectedOwner, setSelectedOwner] = useState([]);
    const [selections, setSelections] = useState([]);
    const [reason, setReason] = useState("");
    const [askReason, setAskReason] = useState(false);
    const [canUnassign, setCanUnassign] = useState(false);
    const [btnDisabled, setBtnDisabled] = useState(false);
    
    const fetchInitialData = async (users) => {

	if (caseInfo.status == "Active") {
	    await threadapi.getCaseParticipantSummary({'case':caseInfo.case_id}).then((response) => {
		if (response.data.notified_vendors > 0) {
		    setCanUnassign(false);
		    if (users.length == 1) {
			setBtnDisabled(true);
		    } else {
			setBtnDisabled(false);
		    }
		} else {
                    setCanUnassign(true);
		    setBtnDisabled(false);
		}
		
            });
	} else {
	    setCanUnassign(true);
	}
    } 
    
    function submitForm() {
	/* get form check */
	if (askReason && !reason) {
	    return;
	}

	if (selections.length == 1) {
	    let users = [];
	    if (type.includes('user')) {
                users = owners.filter(x => x.participant_type !== "group");
            } else if (type.includes("group")) {
                users = owners.filter(x => x.participant_type === "group");
	    }
	    confirmModal([users[0].uuid], reason);
	} else {
	    /* check to make sure selection was made */
	    if (selectedOwner.length > 0) {
		confirmModal(selectedOwner, reason)
	    } else {
		setInvalidSelection(true);
	    }
	}
    };

    useEffect(() => {
	setSelectedOwner([]);
	let users = [];
	if (showModal) {
	    if (type.includes('user')) {
		users = owners.filter(x => x.participant_type !== "group");
		setSelections(users);
	    } else if (type.includes("group")) {
		users = owners.filter(x => x.participant_type === "group");
		setSelections(users);
		setAskReason(true);
	    } else {
		users = owners;
		setSelections(owners);
	    }
	    fetchInitialData(users);

	}
	
    }, [showModal]);
    
    useEffect(() => {

	if (selectedOwner.length == selections.length && !canUnassign) {
	    setBtnDisabled(true);
	} else {
	    setBtnDisabled(false);
	}

    }, [selectedOwner]);

    const setOwners = (e, o) => {
	const { value, checked } = e.target;

	if (checked) {
	    setSelectedOwner(selectedOwner => [...selectedOwner, o]);
	} else {
	    /*remove */
	    setSelectedOwner((selectedOwner) => selectedOwner.filter((item) => item != o));
	}
    }


	
	

    
    return (
        <Modal show={showModal} onHide={hideModal} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Unassign Case</Modal.Title>
        </Modal.Header>
	    <Modal.Body>
		{selections.length > 1 ?
		 <>
		     <Form.Label>There are multiple assignees for this case. Who would you like to remove?</Form.Label>
		     {selections.map((r, index) => {
			 return (
			     <Form.Check
				 key={`owner-${r.uuid}`}
				 id={`owner-${r.uuid}`}
				 label={r.name}
				 onChange={(e)=>setOwners(e, r.uuid)}
			     />
			 )
		     })
		     }
		     {invalidSelection &&
		      <Form.Text className="error">
                          Please select at least one.
                      </Form.Text>
		     }
		 </>
		 :
		 <>
		     {canUnassign ?
		 
		      <div className="alert alert-danger">Are you sure you want to unassign this case?</div>

		      :
		      <div className="alert alert-danger">Unassignment not permitted.  Case is active and vendors have been notified. Please reassign before unassigning.
		      </div>
		     }
		 </>
		}

		{askReason &&
		 <Form.Group className="mb-3">                                                                                                             
		     <Form.Label>Transfer Reason <span className="required">*</span></Form.Label>                                                          
		     <Form.Control data-testid="transfer_reason_form" name="transfer_reason" as="textarea" rows={6} isInvalid={askReason && !reason} onChange={(e)=>setReason(e.target.value)}/>     
                 </Form.Group>
		}

		
		
	    </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={hideModal}>
		Cancel
            </Button>
            <Button disabled={btnDisabled} data-testid="submit-unassign" variant="primary" onClick={() => submitForm() }>
		Submit
            </Button>
        </Modal.Footer>
      </Modal>
    )
}

export default UnassignModule;
