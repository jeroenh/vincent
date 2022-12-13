import React from 'react';
import { Modal, InputGroup, Tabs, Alert, Badge, Button, Form, Tab } from "react-bootstrap";
import { useState, useEffect } from 'react';
import ComponentTypeahead from './ComponentTypeahead';
import ComponentAPI from './ComponentAPI.js'
import "../css/casethread.css";
import axios from 'axios';

const componentapi = new ComponentAPI();


const AddDependencyModal = ({showModal, hideModal, component}) => {

    const [error, setError] = useState(null);
    const [depdencies, setDependencies] = useState([]);
    const [versions, setVersions] = useState([]);
    const [showSubmit, setShowSubmit] = useState(false);
    const [name, setName] = useState([]);
    const [version, setVersion] = useState([]);
    
    useEffect(() => {
	if (showModal) {
	    setError(null);
	}
    }, [showModal]);
    

    const addDeps = async() => {

	const axiosArray = []

        setError(null);

	let dependencies = version;

	if (dependencies.length == 0) {
	    /* no version was selected - so select root component which is in name */
	    dependencies = [name[0].id];
	}

        dependencies.map(item => {
            let data = {'dependency': item}
            axiosArray.push(componentapi.addOneDependency(component.id, data));
        });

        let responses = await axios.all(axiosArray).then((response) => {
	    setShowSubmit(false);
	    setVersions([]);
	    setError({'variant':'success', 'msg': 'Successfully added dependency'});
	    setName([]);
	}).catch(err => {
	    setError({'variant': 'danger', 'msg':`Error adding dependency: ${err.response.data.detail}`});
        });
    }


    useEffect(() => {
	if (name.length > 0) {
	    if (name[0].versions) {
		setVersions(name[0].versions);
	    }
	    setShowSubmit(true);
	}
    }, [name])

    return (

	<Modal show={showModal} onHide={hideModal} size="lg" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
                <Modal.Title>Add Dependency</Modal.Title>
            </Modal.Header>
            <Modal.Body>
		{error &&
		 <Alert variant={error.variant}>{error.msg}</Alert>
		}
		<Form.Group className="mb-3" controlId="_type">
		    <Form.Label>Add Dependency</Form.Label>
                    <InputGroup>
			<ComponentTypeahead
			    component = {name}
			    setComponent = {setName}
			    disabled = {false}
			    allowNew ={false}
			/>
		    </InputGroup>
		</Form.Group>

		{versions.length > 0 &&
		 <Form.Group controlId="version_multiselect" className="mb-3">
		     <Form.Label>Specific Version?</Form.Label>
		     <Form.Control as="select" multiple value={version} onChange={e => setVersion([].slice.call(e.target.selectedOptions).map(item => item.value))}>
			 {versions.map((v, index) => {
			     return (
				 <option key={`option-${index}`} value={v.id}>{v.version}</option>
			     )
			 })}
		     </Form.Control>
		 </Form.Group>
		}


		
	    </Modal.Body>
	    <Modal.Footer>
		<div className="d-flex justify-content-end gap-2">
                    <Button variant="outline-secondary" type="button" onClick={(e)=>(hideModal())}>Cancel</Button>
		    <Button disabled={showSubmit?false:true} variant="primary" onClick={(e)=>addDeps()}>Add Dependency</Button>
                </div>
	    </Modal.Footer>
	</Modal>
    )

};

export default AddDependencyModal;
