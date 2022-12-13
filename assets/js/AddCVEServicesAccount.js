import React from 'react'
import { useState, useEffect} from 'react';
import { Modal, Button, Form, Alert } from "react-bootstrap";


const AddCVEServicesAccount = ({ showModal, hideModal, confirmModal, cveServerTypes}) => {

    const [disabledButton, setDisabledButton] = useState(true);
    const [invalidEmail, setInvalidEmail] = useState(false);
    const [invalidOrg, setInvalidOrg] = useState(false);
    const [invalidApi, setInvalidApi] = useState(false);
    const [email, setEmail] = useState("");
    const [api, setApi] = useState("");
    const [org, setOrg] = useState("");
    const [server, setServer] = useState("Production");
    const [emailWarning, setEmailWarning] = useState(false);
    
    useEffect(() => {
	if (showModal) {
	    setServer("Production");
	    setApi("");
	    setOrg("");
	    setEmail("");
	    setEmailWarning(false);
	    setInvalidEmail(false);
	    setInvalidOrg(false);
	    setInvalidApi(false);
	    setDisabledButton(true);
	}	    
    }, [showModal]);


    useEffect(() => {

	if (email && api && org) {
	    setDisabledButton(false);
	}

    }, [email, api, org]);

    const submitForm = () => {
	confirmModal(email, api, org, server);
    }

    
    return (
        <Modal show={showModal} onHide={hideModal} centered backdrop="static">
        <Modal.Header closeButton>
            <Modal.Title>Add CVE Account</Modal.Title>
        </Modal.Header>
	    <Modal.Body>
		<Form.Group className="mb-3">
		    <Form.Label>Organization Name<span className="required">*</span></Form.Label>
		    <Form.Control
			name="org_name"
			isInvalid={invalidOrg}
			value={org}
			onChange={(e)=>setOrg(e.target.value)}
		    />
		    {invalidOrg &&
                     <Form.Text className="error">
                         Field is required.
                     </Form.Text>
                     }
		</Form.Group>
		<Form.Group className="mb-3">
		    <Form.Label>API Key<span className="required">*</span></Form.Label>
		    <Form.Control
			name="api"
			isInvalid={invalidApi}
			value={api}
			onChange={(e)=>setApi(e.target.value)}
		    />
		    {invalidApi &&
                      <Form.Text className="error">
                          Field is required.
                      </Form.Text>
                     }
		</Form.Group>
		<Form.Group className="mb-3">
		    <Form.Label>Email<span className="required">*</span></Form.Label>
		    <Form.Control
			name="email"
			isInvalid={invalidEmail}
			value={email}
			onChange={(e)=>setEmail(e.target.value)}
		    />
		    {invalidEmail &&
                      <Form.Text className="error">
                          Last is required.
                      </Form.Text>
                     }
		</Form.Group>
		<Form.Group>
		    <Form.Label>
			Server Type<span className="required">*</span>
		    </Form.Label><br/>
		    <Form.Select name="server_type" value={server} onChange={(e)=>setServer(e.target.value)}>
			{cveServerTypes.map((item, index) => {
                            return (
				<option key={`st-${index}`} value={item.display_name}>{item.display_name}</option>
                            )
			})}                                                   
                    </Form.Select>
		</Form.Group>
	    </Modal.Body>
	    <Modal.Footer>
		<Button variant="secondary" onClick={hideModal}>
		    Cancel
		</Button>
		<Button disabled={disabledButton} variant="primary" onClick={(e)=>submitForm()}>
		     Submit
		 </Button>
	    </Modal.Footer>
	</Modal>
     )
}

export default AddCVEServicesAccount;
