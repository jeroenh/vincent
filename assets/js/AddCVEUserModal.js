import React from 'react'
import { useState, useEffect} from 'react';
import { Modal, Button, Form, Alert } from "react-bootstrap";

const AddCVEUserModal = ({ showModal, hideModal, confirmModal, editUser, api }) => {

    const [error, setError] = useState(null);
    const [showSubmitButton, setShowSubmitButton] = useState(true);
    const [invalidEmail, setInvalidEmail] = useState(false);
    const [invalidFirst, setInvalidFirst] = useState(false);
    const [invalidLast, setInvalidLast] = useState(false);
    const [email, setEmail] = useState("");
    const [first, setFirst] = useState("");
    const [last, setLast] = useState("");
    const [role, setRole] = useState("User");
    const [emailWarning, setEmailWarning] = useState(false);
    const [feedback, setFeedback] = useState(null);
    
    useEffect(() => {
	if (showModal) {
	    setFeedback(null);
	    if (editUser) {
		setFirst(editUser.name.first);
		setLast(editUser.name.last);
		setEmail(editUser.username);
		console.log(editUser);
		console.log(editUser.authority.active_roles.length)
		if (editUser.authority.active_roles.length > 0) {
		    setRole("Administrator");
		} else {
		    setRole("User");
		}
	    }
	} else {
	    setRole("User");
	    setFirst("");
	    setLast("");
	    setEmail("");
	    setEmailWarning(false);
	    setInvalidEmail(false);
	    setInvalidFirst(false);
	    setInvalidLast(false);
	}
    }, [showModal]);

    useEffect(()=> {
	if (editUser) {
	    if (editUser.username != email) {
		setEmailWarning(true);
	    } else {
		setEmailWarning(false);
	    }
	}
    }, [email]);

    function submitForm() {
        /* get form check */
	if (email == "") {
	    setInvalidEmail(true);
	    return;
	}
	if (first == "") {
	    setInvalidFirst(true);
	    return;
	}
	if (last == "") {
	    setInvalidLast(false);
	    return;
	}
        confirmModal(email, first, last, role)
    };

    const reactivate = () => {
        api.reactivateUser(editUser.username).then((response) => {
            setFeedback(<Alert variant="success">Done! User has been activated.</Alert>);
        }).catch(err => {
	    if (err?.response?.data) {
		setError(err.response.data?.message);
	    } else {
		setError("An error occurred");
	    }
	})
    }
    
    
    const deactivate = () => {
        api.deactivateUser(editUser.username).then((response) => {
            console.log(response);
            setFeedback(<Alert variant="warning">Done! User has been deactivated.</Alert>);
        }).catch(err => {
	    if (err?.response?.data) {
		setError(err.response.data?.message);
	    } else {
		setError("An error occurred");
	    }
	})
    }

    const resetKey = () => {
        console.log('reset');
        api.resetKey(editUser.username).then((response) => {
            console.log(response);
            setFeedback(<Alert variant="success">Done! Key has been reset to {response["API-secret"]}</Alert>);
        }).catch(err => {
	    if (err?.response?.data) {
		setError(err.response.data?.message);
	    } else {
		setError("An error occurred");
	    }
	})
    }
    
    
    const handleRoleSelect = (e) => {
	const { value, checked } = e.target;

	if (checked) {
	    setRole(value);
	}
    }

    return (
        <Modal show={showModal} onHide={hideModal}>
        <Modal.Header closeButton>
            <Modal.Title>{editUser ? ("Edit") : ("Add") } CVE User</Modal.Title>
        </Modal.Header>
            <Modal.Body>
		{error &&
		 <Alert variant="danger">{error}</Alert>
		}
		{editUser &&
		 <div className="d-flex justify-content-between">
		     <div className="mt-2"><label className="form-label">Active:</label> <b>{editUser.active.toString()}</b></div>
		     <Button variant="btn btn-outline-primary" size="sm" onClick={(e)=>resetKey()}>Reset Key</Button>
		 </div>
		}

		{feedback &&
                 <>                                                                                                                                  
                     {feedback}                                                                                                                      
                 </>
                }       
		
		<Form.Group className="mb-3">
		    {emailWarning &&
		     <Alert variant="warning">By editing the email address, you are modifying this user's login credentials. Be aware!</Alert>
		    }
		    <Form.Label>Email</Form.Label>
		    <Form.Control
			name="email"
			isInvalid={invalidEmail}
			value={email}
			onChange={(e)=>setEmail(e.target.value)}
		    />
		    {invalidEmail &&
                     <Form.Text className="error">
                         Field is required.
                     </Form.Text>
                     }
		</Form.Group>
		<Form.Group className="mb-3">
		    <Form.Label>First Name</Form.Label>
		    <Form.Control
			name="first"
			isInvalid={invalidFirst}
			value={first}
			onChange={(e)=>setFirst(e.target.value)}
		    />
		    {invalidFirst &&
                      <Form.Text className="error">
                          Field is required.
                      </Form.Text>
                     }
		</Form.Group>
		<Form.Group className="mb-3">
		    <Form.Label>Last Name</Form.Label>
		    <Form.Control
			name="last"
			isInvalid={invalidLast}
			value={last}
			onChange={(e)=>setLast(e.target.value)}
		    />
		    {invalidLast &&
                      <Form.Text className="error">
                          Last is required.
                      </Form.Text>
                     }
		</Form.Group>
		<Form.Label>
		    Choose role
		</Form.Label><br/>
		{['User', 'Administrator'].map((r, index) => {
		    return (
			    <Form.Check
				key={`role-${r}`}
				inline
                                type='radio'
				name="role"
                                id={`role-${r}`}
                                label={r}
				value={r}
				checked={role === r ? true : false}
                                onChange={handleRoleSelect}
                            />
		    )
		})
		}

	    </Modal.Body>
	    <Modal.Footer className="d-flex justify-content-between">
		<div>
		    {editUser &&

		     <>
			 {editUser.active ?
			  <Button variant="danger" onClick={(e)=>deactivate()}>Deactivate User</Button>
			  :
			  <Button variant="danger" onClick={(e)=>reactivate()}>Activate User</Button>
			 }
		     </>
		    }
		</div>
		<div className="d-flex align-items-center gap-2">
		    <Button variant="secondary" onClick={hideModal}>
			Cancel
		    </Button>
		    {showSubmitButton ?
		     <Button variant="primary" onClick={() => submitForm() }>
			 Submit
		     </Button>
		     :
		     <Button variant="primary" onClick={hideModal}>
			 Ok
		     </Button>
		    }
		</div>
	    </Modal.Footer>
	</Modal>
     )
}

export default AddCVEUserModal;
