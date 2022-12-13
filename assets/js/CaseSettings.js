import React, { useState, useEffect, useMemo } from 'react';
import {Row, Button, Form, InputGroup, Dropdown, DropdownButton, Alert, ListGroup, Card, Col} from 'react-bootstrap';
import AdminAPI from './AdminAPI';
import DeleteConfirmation from "./DeleteConfirmation";
import ErrorModal from "./ErrorModal";
import AddResolutionModal from "./AddResolutionModal";

const adminapi = new AdminAPI();

import '../css/casethread.css';

const CaseSettings = () => {

    const [options, setOptions] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [resolution, setResolution] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState(null);
    const [displayErrorModal, setDisplayErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [selTemplate, setSelTemplate] = useState("");
    
    const hideErrorModal = () => {
	setDisplayErrorModal(false);
    }

    /* need to add code to retrieve resolutions, add new ones, and remove one. */

    const fetchInitialData = async () => {
	setResolution("");
	setSelTemplate("");
        await adminapi.getResolutionOptions().then((response) => {
            console.log(response);
            setOptions(response);
	    setIsLoading(false);
        }).catch(err => {
	    console.log(err);
	    setErrorMessage(`Error retrieving options: ${err.message}.`);
            setDisplayErrorModal(true);
	});

    }

    const fetchEmailTemplates = async() => {
	
        await adminapi.getCaseEmailTemplates().then((response) => {
            setTemplates(response);
        }).catch(err => {
            setError(`Error loading email templates: ${err.message}`);
        })
    }

    const submitRemoveOption = (id) => {
        adminapi.deleteResolutionOption(id).then((response) => {
            setOptions((qs) =>
                qs.filter((select) => select.id !== id))
        }).catch(err => {
            setErrorMessage(`Error removing option: ${err.message}.`);
            setDisplayErrorModal(true);
            console.log(err);
        });
        setDisplayConfirmationModal(false);
    }


    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    }

    function removeOption(id) {
        setRemoveID(id);
        /* TODO - pull related status to show user before confirmation */
        setDeleteMessage("Are you sure you want to remove this resolution option?");
	setDisplayConfirmationModal(true);
    };

    useEffect(() => {
        fetchInitialData();
	fetchEmailTemplates();
    }, []);

    const submitResolution = async () => {
	const data = {'description': resolution}
	if (selTemplate) {
	    data['email_template'] = parseInt(selTemplate);
	}

	adminapi.addResolutionOption(data).then((response) => {
            fetchInitialData();
	    setShowForm(false);

        }).catch(err => {
	    setShowForm(false);
	    setErrorMessage(`Error adding option: ${err.message}.`);
            setDisplayErrorModal(true);
	    console.log(err);
	});
    }


    const hideResolutionForm = () => {
	setShowForm(false);
    }

    return (
	 <Card className="mb-4">
             <Card.Header><Card.Title>Case Settings</Card.Title></Card.Header>
             <Card.Body>
		 <Row xs={1} md={2} className="g-4">
		     <Col>
			 <Card>
			     <Card.Header className="d-flex justify-content-between">
				 <Card.Title>Case Resolution Options
				 </Card.Title>
				 <DropdownButton variant="btn p-0"
						 title={<i className="bx bx-dots-vertical-rounded" title="Add Resolution Option"></i>}>
				     <Dropdown.Item eventKey="add" onClick={(e)=>setShowForm(true)}>Add Option</Dropdown.Item>
				 </DropdownButton>
			     </Card.Header>
			     <Card.Body>

				 {showForm &&
				  <div>
				      <AddResolutionModal
					  showModal={showForm}
					  hideModal={hideResolutionForm}
					  submit={submitResolution}
					  resolution = {resolution}
					  setResolution ={setResolution}
					  templates={templates}
					  selTemplate={selTemplate}
					  setSelTemplate={setSelTemplate}
				      />
				      
				  </div>
				 }
				 {isLoading ?
				  <div className="text-center">
				      <div className="lds-spinner"><div></div><div></div><div></div></div>
				  </div>
				  :
				  <ListGroup>
				      {options.map((o, index) => {
					  return (
					      <ListGroup.Item key={`resolution-${index}`} className="d-flex justify-content-between align-items-center">
						  <span>{o.description}
						      {o.email &&
						       <small>  (Email: {o.email?.template_name})</small>
						      }
						  </span>
						  <Button variant="btn p-0" onClick={(e)=>removeOption(o.id)}><i className="fas fa-trash" title="Remove option"></i></Button>
					      </ListGroup.Item>
					  )
				      })}
				  </ListGroup>
				 }

			     </Card.Body>

			 </Card>
		     </Col>
		 </Row>
		 <DeleteConfirmation
                     showModal={displayConfirmationModal}
                     confirmModal={submitRemoveOption}
                     hideModal={hideConfirmationModal}
                     id={removeID}
                     message={deleteMessage} />
		 <ErrorModal
                     showModal = {displayErrorModal}
                     hideModal = {hideErrorModal}
                     message = {errorMessage}
                 />
	     </Card.Body>
	 </Card>
    )

}

export default CaseSettings;
