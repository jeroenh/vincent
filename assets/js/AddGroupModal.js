import React from 'react';
import { Modal, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import { useState, useEffect } from 'react';
import ContactAPI from './ContactAPI.js'

const contactapi = new ContactAPI();

const AddGroupModal = ({showModal, hideModal, addNewGroup}) => {

    const [error, setError] = useState("");
    const [formContent, setFormContent] = useState(null);
    const [invalidGroup, setInvalidGroup] = useState(false);
    const [groupName, setGroupName] = useState("");
    
    useEffect(() => {
	setError("");
    }, [showModal]);


    const handleSubmit = async(event) => {
	event.preventDefault();
	const formData = new FormData(event.target),
              formDataObj = Object.fromEntries(formData.entries());
	console.log(formDataObj);

	if (groupName == "" || groupName.length == 0) {
            setInvalidGroup(true);
            return;
	}

	formDataObj["name"] = groupName;
	
	await contactapi.addGroup(formDataObj).then(response => {
	    let data = response.data;
	    addNewGroup(data);
	}).catch(err =>  {
	    console.log(err);
	    setError(`Error adding group: ${err.response.data.message}`);
	});
    }


    return (

	<Modal show={showModal} onHide={hideModal} size="lg" centered>
            <Modal.Header closeButton className="border-bottom">
                <Modal.Title>Add New Group</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error ?
                 <div className="alert alert-danger">{error}</div>
                 : ""}
		 <form onSubmit={(e)=>handleSubmit(e)}>
		     <Form.Group className="mb-3" controlId="groupName">
                         <Form.Label className="mb-0">
                             Group Name
			     <span className="required">
                                 *
                             </span>
                         </Form.Label>
			 <Form.Control
                             name="name"
                             isInvalid={invalidGroup}
                             value={groupName}
                             onChange={(e) =>
                                 setGroupName(
                                     e.target.value
                                 )
                             }
                         />     
			 {invalidGroup && (
                             <Form.Text className="error">
                                 A group name is required.
                             </Form.Text>
                         )}
                     </Form.Group>

		     <div className="d-flex justify-content-end gap-2">
			 <Button variant="secondary" onClick={(e)=>hideModal()}>
			 Cancel</Button>
			 <Button variant="primary" type="submit">
			 Submit</Button>
		     </div>
		 </form>
	    </Modal.Body>
	</Modal>
    )

};

export default AddGroupModal;
