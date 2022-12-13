import React, { useState, useEffect } from 'react';
import {Nav, Table, Modal, Button, Tab, Tabs, Row, Form, Card, Col} from 'react-bootstrap';

const AddResolutionModal = (props) => {

    

    
    return (	
	<Modal show={props.showModal} onHide={props.hideModal} size="lg" centered>
	    <Modal.Header closeButton className="border-bottom">
		<Modal.Title>{props.edit ? "Edit" : "Add New"} Case Resolution</Modal.Title>
	    </Modal.Header>
	    <Modal.Body>
		<Form.Group className="mb-3" controlId="resolutionInput">
		    
		    <Form.Label>Resolution<span className="required">*</span></Form.Label>                                                      
		    <Form.Control placeholder="Add resolution" title="Add resolution" value={props.resolution} onChange={(e)=>props.setResolution(e.target.value)}/>
		    
		</Form.Group>
		<Form.Group>
		    <Form.Label>Email Template</Form.Label>  
		    <Form.Text>Select template to send to reporter if declining a case.</Form.Text>
		    <Form.Select name="email_template" title="Select email template" value={props.selTemplate} className="select form-select" onChange={(e)=>props.setSelTemplate(e.target.value)}>    
			<option value={""} key={""}></option>
			{props.templates.map((email, index) => {
			    return (
				<option value={email.id} key={email.id}>{email.template_name}</option>
			    )
			})}                                                                             
		    </Form.Select>   
		</Form.Group>
	    </Modal.Body>
	    <Modal.Footer>
		<div className="d-flex justify-content-end gap-2">
		    <Button variant="secondary" onClick={(e)=>props.hideModal()}>
		    Cancel</Button>
		    <Button variant="primary" type="submit" onClick={(e)=>props.submit()}>
		    Submit</Button>
		</div>
	    </Modal.Footer>
	</Modal>
    )
}

export default AddResolutionModal;
