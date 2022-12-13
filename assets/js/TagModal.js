import React from 'react';
import { Modal, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import { useState, useEffect } from 'react';
import AdminAPI from './AdminAPI.js'
import TagTypeahead from './TagTypeahead.js';

const adminapi = new AdminAPI();

const TagModal =(props) => {

    const [error, setError] = useState("");
    const [invalidTag, setInvalidTag] = useState(false);
    const [tags, setTags] = useState([]);

    
    useEffect(() => {
        setError("");
    }, [props.showModal]);

    useEffect(() => {
	if (props.tags) {
	    let t = props.tags.map(x => ({'tag': x, 'id': 0}));
	    setTags(t);
	}
    }, [props.tags]);


    const submitTags = (e) => {
	props.submitTags(tags);
	 /*else {
	    if (e) {
		e.preventDefault();
	    }
	    setError("Tags must be pre-defined in System Settings");
	}*/
    }

    return (

        <Modal show={props.showModal} onHide={props.hideModal} centered>
            <Modal.Header closeButton className="border-bottom">
                <Modal.Title>Tag {props.dataType}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error ?
                 <div className="alert alert-danger">{error}</div>
                 : ""}
		<p>Tags must be pre-defined in System Settings.</p>
		<div className="mb-3">
		    <TagTypeahead
			dataType= {props.dataType}
			setTags = {setTags}
			tags = {tags}
			disabled = {false}
		    />
		</div>
		
		<div className="d-flex justify-content-end gap-2">
		    <Button variant="secondary" onClick={(e)=>props.hideModal()}>
                    Cancel</Button>
                    <Button variant="primary" type="submit" onClick={(e) => submitTags(e)}>
                    Submit</Button>
                </div>
            </Modal.Body>
        </Modal>
    )


}



export default TagModal;
