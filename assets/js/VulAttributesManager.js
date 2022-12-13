import React from 'react';
import { Modal, Row, Col, Table, Tabs, Alert, Badge, Button, Form, Tab, Card } from "react-bootstrap";
import { useState, useEffect } from 'react';
import AdminAPI from './AdminAPI';
import DeleteConfirmation from './DeleteConfirmation';
import ErrorModal from "./ErrorModal";

const adminapi = new AdminAPI();

const VulAttributesManager = () => {

    const [attributes, setAttributes] = useState([]);
    const [attribute, setAttribute] = useState("");
    const [description, setDescription] = useState("");
    const [invalidAttribute, setInvalidAttribute] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [successMsg, setSuccessMsg] = useState(null);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [displayErrorModal, setDisplayErrorModal] = useState(false);
    const [removeId, setRemoveId] = useState(null);

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    }


    const hideErrorModal = () => {
        setDisplayErrorModal(false);
    }
    
    const fetchInitialData = async () => {

        adminapi.getVulAttributes().then((response) => {
	    setAttributes(response);

        }).catch(err => {
	    setApiError(err);
	    setDisplayErrorModal(true);
	    
	});
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    

    const submitAttribute = async () => {
	const formData = {}
	
	if (attribute == "") {
	    setInvalidAttribute(true);
	    return;
	}

	formData['attribute'] = attribute;
	formData['description'] = description;

	adminapi.addVulAttribute(formData).then((response) => {
	    fetchInitialData();
	    setSuccessMsg(response['detail'])
	    setInvalidAttribute(false);
	    setAttribute("");
	    setDescription("");
	    setShowForm(false);
	}).catch(err => {
	    setApiError(err.response.data);
	    setDisplayErrorModal(true);
	});
    };

    const removeAttribute = async () => {

	hideConfirmationModal();
	
	adminapi.removeVulAttribute(removeId).then((response) => {
	    setRemoveId(null);
	    fetchInitialData();
	}).catch(err => {
	    setApiError(err.response.data);
	    setDisplayErrorModal(true);
	});
    }
    
    return (
	<>
	    {successMsg &&
	     <Alert variant="success">{successMsg}</Alert>
	    }
	    
	    <Card className="mb-4">
		<Card.Header className="d-flex justify-content-between" as="h5">
		    <Card.Title>Manage Vulnerability Attributes
		    </Card.Title>
		    <Button size="sm" variant="primary" onClick={() => setShowForm(true)}>Add Attribute</Button>
		</Card.Header>
		<Card.Body>
		    {showForm &&
		     <div className="border border-success">
		     <div className="m-2">
			 <Form.Label>Attribute</Form.Label>
			 <Form.Control type="text" isInvalid={invalidAttribute} onChange={(e)=>setAttribute(e.target.value)} value={attribute} />
			 {invalidAttribute &&
			  <Form.Text className="text-danger">
			      This field is required.
			  </Form.Text>
			 }
			 <Form.Label>Description</Form.Label>
			 
			 <Form.Control type="text" onChange={(e)=>setDescription(e.target.value)} value={description} />
		     </div>
		     <div className="d-flex gap-2 justify-content-end m-2">
			 <Button variant="secondary" size="sm" onClick={(e)=>{setAttribute(""), setDescription(""), setInvalidAttribute(false), setShowForm(false)}}>
			     <i className="fas fa-times" title="Cancel Add Attribute"></i> Cancel
			 </Button>

			 <Button variant="btn btn-outline-primary" size="sm" onClick={(e)=>submitAttribute()}>
                             <i className="fas fa-plus" title="Add Attribute"></i> Add
			 </Button>
		     </div>
			 </div>
		    }
		    <Table>
			<thead>
			    <tr>
				<th>Attribute</th>
				<th>Description</th>
				<th>Created by</th>
				<th>Remove</th>
			    </tr>
			</thead>
			<tbody>
			    
			    {attributes.map((t, index) => {
				return (
				    <tr key={`attr-${index}`}>
					<td>{t.attribute}</td>
					<td>{t.description}</td>
					<td>{t.user?.name}</td>
					<td><Button variant="btn btn-icon" onClick={(e)=>{setRemoveId(t.id), setDisplayConfirmationModal(true)}}><i className="fas fa-trash" title="Remove Attribute"></i></Button></td>
				    </tr>
				)})}
			    {attributes.length == 0 &&
			     <tr>
				 <td colSpan="4" className="text-center">
				     No custom attributes defined.
				 </td>
			     </tr>
			    }
			</tbody>
		    </Table>
		</Card.Body>
	    </Card>

            <ErrorModal
                showModal = {displayErrorModal}
                hideModal = {hideErrorModal}
                drf = {apiError}
            /> 
	    
	    <DeleteConfirmation
                showModal={displayConfirmationModal}
                confirmModal={removeAttribute}
                hideModal={hideConfirmationModal}
                id={removeId}
                message="Are you sure you want to remove this attribute?  This will not remove the attribute from any vulnerabilities, but you will not be able to add/edit the attribute to any vulnerability."
	    />   
	    
	    
	</>

    )

}

export default VulAttributesManager;
