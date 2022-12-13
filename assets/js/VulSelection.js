import React, { useState, useEffect } from 'react';
import {Form, Alert} from "react-bootstrap";


const VulSelection = (props) => {

    const [selection, setSelection] = useState(null);

    useEffect(() => {
	if (selection) {
	    props.onSelect(selection);
	}

    }, [selection]);
    
    return (
	props.vuls.length > 0 ?
	    <Form.Group>                                                            

		<Form.Label>Choose Vulnerability to Edit</Form.Label>                         
                {props.vuls.map((a, index) => (
		    <Form.Check
			type="radio"
                        key={`vul-${a.id}`}
                        onChange={(e)=>setSelection(a)}
                        name="account"
                        label={<div>{a.vul} {a.title ? a.title : a.description}</div>}
		    />
		))}
		 
		 </Form.Group>
	:
	<Alert variant="info">No vulnerabilities to edit.</Alert>
	
    )
}

export default VulSelection;
    
