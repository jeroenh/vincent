import React from 'react';
import { Modal, Alert, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import { useState, useEffect } from 'react';
import AdminAPI from './AdminAPI';
const adminapi = new AdminAPI();

const NotifyVendorModal = (props) => {
    
    const [btnDisabled, setBtnDisabled] = useState("disabled");
    const [error, setError] = useState(null);
    const [data, setData] = useState([]);
    const [content, setContent] = useState("");
    const [subject, setSubject] = useState("");
    const [template, setTemplate] = useState(0);
    
    const fetchInitialData = async () => {
	try {
	    await adminapi.getCaseEmailTemplates().then((response) => {
		setData(response);
	    });
	} catch (err) {
	    setError(`Error loading email templates: ${err.message}`);
	}
    };


    const submitContent = () => {
	props.confirmModal(subject, content);
    }
    
    const makeSelect = (e) => {
	let tmpl = e.target.value;
	let email = data.filter((e) => e.id == tmpl);
	if (email.length > 0) {
	    setSubject(email[0].subject);
	    setContent(email[0].plain_text);
	    setTemplate(email[0].id);
	} else {
	    setSubject("");
	    setContent("");
	    setTemplate(0);
	}
	    
			
    }

    useEffect(() => {
	if (data.length > 0) {
	    let notify = data.filter((i, index) => i.template_name.includes('vendor_notify'));
	    if (notify) {
		setTemplate(notify[0].id);
		setSubject(notify[0].subject);
		setContent(notify[0].plain_text);
	    } else {
		setTemplate(data[0].id);
		setSubject(data[0].subject);
		setContent(data[0].plain_text);
	    }
	}
    }, [data]);
    
    useEffect(() => {
	if (props.showModal) {
	    fetchInitialData();
	}
    }, [props.showModal]);

    return (
        <Modal show={props.showModal} onHide={props.hideModal} size="lg" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
		{props.count ?
		 <Modal.Title>Notify {props.count} Selected Participants</Modal.Title>
		 :
		 <Modal.Title>Select Participant to Notify</Modal.Title>
		}
            </Modal.Header>
            <Modal.Body>
		{props.count ?

		 <>
		     {data.length > 0 &&
		      <Form.Group className="mb-3">
			  <Form.Label>Select Email Template</Form.Label>
			  <Form.Select name="email_template" value={template} className="select form-select" onChange={(e)=> makeSelect(e)}>
			      {data.map((email, index) => {
				  return (
				      <option value={email.id} key={email.id}>{email.template_name}</option>
				  )
			      })
			      }
			      <option value={0} key="no_email">Do not send email</option>
			  </Form.Select>
		      </Form.Group>
		     }

		     {template ?
		      <>
		     <Form.Group className="mb-3">
                         <Form.Label>Email Subject</Form.Label>
			 <Form.Control
			     value = {subject}
			     onChange={(e)=>setSubject(e.target.value)}
			 />
		     </Form.Group>
		     <Form.Group className="mb-3">
			 <Form.Label>Email Content</Form.Label>    
			 <Form.Text>Any content with {"{{}}"} will be populated when email is sent. Standard email signature will also be added.</Form.Text>
			 <Form.Control
			     aria-label="contact"
			     aria-describedby="basic-addon1"
			     as="textarea"
			     rows={6}
			     value = {content}
			     onChange={(e)=>setContent(e.target.value)}
			 />
		     </Form.Group>
		      </>
		      :
		      <Alert variant="warning">No email will be sent but access will be granted to this case.</Alert>
		     }

		      
		 </>
		 :
		 <Alert variant="warning">Oops! You forgot to select a participant to notify.</Alert>
		}
	    </Modal.Body>
        <Modal.Footer className="border-top">
          <Button variant="secondary" onClick={props.hideModal}>
            Cancel
          </Button>
            <Button variant="primary" onClick={(e)=>submitContent()}>
		Send
          </Button>
        </Modal.Footer>
      </Modal>
    )
}

export default NotifyVendorModal;
