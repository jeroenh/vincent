import React from 'react';
import { Modal, Alert, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import { useState, useEffect } from 'react';
import ContactAPI from './ContactAPI';
import validator from "validator";
import DRFErrorMessage from './DRFErrorMessage';

const contactapi = new ContactAPI();

const AddContactModal = ({showModal, hideModal, title, edit, group}) => {

    const [error, setError] = useState(null);
    const [formContent, setFormContent] = useState(null);
    const [groupName, setGroupName] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [invalidEmail, setInvalidEmail] = useState(false);
    const [invalidPhone, setInvalidPhone] = useState(false);
    const [drfError, setDRFError] = useState(null);

    
    function clear_data() {
	setName("");
	setEmail("");
	setPhone("");
	setError(null);
	setDRFError(null);
	setInvalidEmail("");
	setInvalidPhone("");
    }
   
    
    const handleSubmit = async (event) => {

	if (event) event.preventDefault();
	    
	const formData = new FormData(event.target),
              formDataObj = Object.fromEntries(formData.entries());

	if (!email) {
	    setInvalidEmail(true);
	    return;
	}

	if (invalidPhone || invalidEmail) {
	    return;
	}
	if (group) {
	    formDataObj['group'] = group.uuid;
	}
	
	console.log(formDataObj);
	if (edit) {
	    await contactapi.updateContact(edit.contact.uuid, formDataObj).then(response=> {
		/* wait for response, then exit */
		clear_data();
		hideModal();
	    })
		.catch(err => {
		    if (err.response?.data) {
			setDRFError(err.response.data);
		    } else {
			setError(`Error updating user: ${err.message}`);
		    }
		    console.log(err);
		});
	} else if (group) {
	    await contactapi.addGroupContact(group.uuid, formDataObj).then(response => {
		clear_data();
		hideModal();
	    })
		.catch(err => {
		    if (err.response?.data) {
			setDRFError(err.response.data);
		    } else {
			setError(`Error updating user: ${err.message}`);
		    }

		    console.log(err);
		})
	} else {
	    await contactapi.addContact(formDataObj).then(response => {
		clear_data();
		hideModal(response["new"]);
	    }).catch(err => {
		   if (err.response?.data) {
                        setDRFError(err.response.data);
                    } else {
                        setError(`Error updating user: ${err.message}`);
                    }

                    console.log(err);
            })
	}
    }

    useEffect(()=> {
	if (edit) {
	    setName(edit.contact.name || "");
	    setEmail(edit.contact.email || "");
	    setPhone(edit.contact.phone || "");
	} else {
	    clear_data();
	}
    }, [showModal, edit]);

    useEffect(() => {
	if (hideModal) {
	    setDRFError(null);
	    setError(null);
	
	}
    }, [hideModal]);
	
    
    useEffect(() => {

	if (email) {
	    if (validator.isEmail(email)) {
		setInvalidEmail(false);
	    } else {
		setInvalidEmail(true);
	    }
	}

    }, [email]);


    useEffect(() => {

        if (phone) {
            if (validator.isMobilePhone(phone)) {
                setInvalidPhone(false);
	    } else {
                setInvalidPhone(true);
	    }
	} else {
	    setInvalidPhone(false);
	}

    }, [phone]);

    return (

	<Modal show={showModal} onHide={hideModal} size="lg" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
                <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
		{error ?
                 <div className="alert alert-danger">{error}</div>
                 : ""}
		{drfError &&
                 <DRFErrorMessage
                     error={drfError}
                 />
                }   

		<Form onSubmit={handleSubmit}>
		    <Form.Group className="mb-3" controlId="emailInput">
			<Form.Label>Email <span className="required">*</span></Form.Label>
			<Form.Control name="email"
				      value={email}
				      isInvalid={invalidEmail}
				      onChange={(e)=>setEmail(e.target.value)} />
			{invalidEmail &&
                         <Form.Text className="error">
                             A valid email is required.
                         </Form.Text>
                        }
		    </Form.Group>
		    <Form.Group className="mb-3" controlId="nameInput">
                     <Form.Label>Name</Form.Label>
			<Form.Control name="name" value={name} onChange={(e)=>setName(e.target.value)} />
		    </Form.Group>
		    <Form.Group className="mb-3" controlId="phoneInput">
		     <Form.Label>Phone Number</Form.Label>
			<Form.Control name="phone" value={phone} isInvalid={invalidPhone} onChange={(e)=>setPhone(e.target.value)} />
			{invalidPhone &&
                         <Form.Text className="error">
                             Please enter a valid phone number.
                         </Form.Text>
                        }
		    </Form.Group>
		    <div className="d-flex justify-content-end gap-2 mt-3">
			<Button variant="secondary" onClick={(e)=>hideModal()}>
                        Cancel</Button>     
			 <Button
			     variant="primary"
			     type="submit"
			 >
			     Submit
			 </Button>
		     </div>
		 </Form>

	    </Modal.Body>
	</Modal>
    )

};

export default AddContactModal;
