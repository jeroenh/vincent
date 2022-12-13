import React from 'react';
import { Modal, Alert, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import { useCallback, useState, useEffect } from 'react';
import ContactAPI from './ContactAPI.js';
import ComponentAPI from './ComponentAPI';
import GroupTypeahead from './GroupTypeahead';
import DisplayLogo from "./DisplayLogo";
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../css/casethread.css'

const componentapi = new ComponentAPI();

const SelectGroupModal = ({showModal, hideModal, selected}) => {

    const [error, setError] = useState("");
    const [invalidOwner, setInvalidOwner] = useState(false);
    const [owner, setOwner] = useState([]);

    useEffect(() => {
	setError("");
    }, [showModal]);

    const handleSubmit = async() => {
	let formdata = new FormData();
	if (owner.length == 0) {
	    setInvalidOwner(true);
	    return;
	}
	console.log(owner);
	console.log(selected);
	selected.forEach((item) => (
	    formdata.append('components[]', item.original.component.id)
	));
	formdata.append('group', owner[0]["uuid"]);
	
	console.log(formdata);
	try {
	    let res = await componentapi.updateComponentOwner(formdata);
	    let data = await res.data;
	    hideModal();
	} catch (err) {
	    console.log(err);
	    setError(`Error adding group: ${err.response.data.message}`);

	}
    }


    return (
	showModal ?
	<Modal show={showModal} onHide={hideModal} size="lg" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
                <Modal.Title>Select Product Owner</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {selected.length == 0 ?
                 <div className="alert alert-danger">Please select rows before adding a supplier.</div>
                 :

		 <Form>
		     {error &&
		      <Alert variant="danger">{error}</Alert>
		     }
                    <Form.Group className="mb-3" controlId="_type">
                        <Form.Label>Select Owner:</Form.Label>
			<GroupTypeahead
			    owner = {owner}
			    setOwner ={setOwner}
			    invalid={invalidOwner}
			/>
                    </Form.Group>

		     {invalidOwner &&
		      <Form.Text className="error">
                          This field is required.
                      </Form.Text>
                     }
		     {selected.some(comp => !comp.original.owner) &&
		      <p>Adding ownership to the following components:</p>
		     }
		     <ul>
			 {selected.filter(comp => !comp.original.owner).map( fcomp => (
			     <li key={`comp-${fcomp.original.component.id}`}>{fcomp.original.component.name}</li>
			 ))}
		     </ul>
		     {selected.some(comp=>comp.original.owner) &&
		      <p>Changing ownership of the following components:</p>
		     }
                     <ul>
                         {selected.filter(comp => comp.original.owner).map( fcomp => (
                             <li key={`comp-${fcomp.original.component.id}`}>{fcomp.original.component.name}</li>
                         ))}
                     </ul>
		 </Form>
		 
		}

	    </Modal.Body>
            <Modal.Footer>
                <Button variant="outline-secondary" type="cancel" onClick={(e)=>(e.preventDefault(), hideModal())}>Cancel</Button>
		{selected.length > 0 &&
                 <Button
		     type="submit"
		     onClick={(e)=>handleSubmit()}
		     variant="primary"
		     disabled={owner ? false: true}>
		 Submit </Button>
		}
            </Modal.Footer>
	</Modal>
	:
	""
    )

};

export default SelectGroupModal;
