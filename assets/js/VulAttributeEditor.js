import React from 'react';
import { Modal, ButtonGroup, ToggleButton, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import { useState, useEffect } from 'react';
import AdminAPI from './AdminAPI';

const adminapi = new AdminAPI();


const VulAttributeEditor = (props) => {

    const [attributes, setAttributes] = useState([]);
    const [vulattrs, setVulAttrs] = useState({});
    
    
    const getVulAttribute = (attr_name) => {
	if (vulattrs.hasOwnProperty(attr_name)) {
	    return vulattrs[attr_name];
	} else {
	    return "";
	}
    }
	    

    const handleAttributeChange = (e) => {
	const {name, value} = e.target;
	setVulAttrs(prevv => ({...prevv, [name]: value})); 	
    }
    
    
    const fetchInitialData = async () => {

        await adminapi.getVulAttributes().then((response) => {
            setAttributes(response);
        }).catch(err => {
	    console.log(err);
        });
    };

    useEffect(() => {
	if (props.attributes?.length > 0) {
	    setAttributes(props.attributes);
	} else {
	    fetchInitialData();
	}
    }, []);

    useEffect(() => {

	if (props.vul) {
	    let a = {};
	    props.vul.attributes?.forEach(y => {
		if (props.source && y.source) {
		    if (props.source == y.source) {
			a[y.name] = y.value
		    }
		} else {
		    a[y.name] = y.value
		}
	    });
	    setVulAttrs(a);
	}

    }, [props.vul]);

    useEffect(() => {
	let newAttrs = [];
	Object.keys(vulattrs).forEach((x) => newAttrs.push({name: x, value: vulattrs[x]}))
	props.setAttributes(newAttrs);

    }, [vulattrs]);
    
    return  (
	attributes.length > 0 &&
	 <>
	     {props.attributes?.length > 0 ?
	      ""
	      :
	      <Form.Label>Attributes</Form.Label>
	     }
	     {attributes.map((attr, index) => (
		 <div key={`attr-${index}`} className="border-bottom py-2 mb-2">
		     <Row>
			 <Col lg={12} sm={12} md={12}>
			     <div>
				 <Form.Group controlId={`attributeInput-${index}`}>
				     <Form.Label className="mb-0">{ attr.attribute }</Form.Label>
				     <Form.Text className="mb-2 pb-0 mt-0">{ attr.description }</Form.Text>
				     <Form.Control name={attr.attribute} value={getVulAttribute(attr.attribute)} onChange={(e)=>handleAttributeChange(e)} aria-label={attr.attribute} />
				 </Form.Group>
			     </div>
			 </Col>
		     </Row>
		 </div>
	     ))}
	 </>
    );




}

export default VulAttributeEditor;
