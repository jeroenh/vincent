import React from 'react';
import {Col, Button, Row, Form, InputGroup, OverlayTrigger, Tooltip} from 'react-bootstrap';
import { useState, useEffect } from 'react';

export function PostToggleButton(props) {
    // false == lifo, true=fifo
    const [toggleState, setToggleState] = useState(false);
    const [toggleClass, setToggleClass] = useState("bx bx-sort-up");
    const [isLoading, setIsLoading] = useState(true);
    const [tooltipText, setTooltipText] = useState("Show newest posts at top");

    useEffect(() => {
	if (isLoading) {
	    setIsLoading(false);
	} else {
	    if (toggleState) {
		setToggleClass("bx bx-sort-down");
		setTooltipText("Show newest posts at the bottom");
		props.onChange("fifo");

	    } else{
		setToggleClass("bx bx-sort-up");
		setTooltipText("Show newest posts at the top");
		props.onChange("lifo");
	    }
	}
    }, [toggleState]);
    
    
    return (
	<OverlayTrigger overlay={<Tooltip>{tooltipText}</Tooltip>}>
	    <Button
		variant="btn btn-icon btn-outline-primary"
		title={`Sort Posts ${tooltipText}`}
		onClick={()=>{setToggleState(!toggleState)}}> 
		<i className={toggleClass} title={`Sort Posts ${tooltipText}`}></i>             
            </Button>
	</OverlayTrigger>
    
    )
}

export default function ThreadSearchForm (props) {

    const [value, setValue] = useState("");
    const [toggle, setToggle] = useState("lifo");
    
    function handleChange(event) {
	setValue(event.target.value);
    }

    function handleSubmit(event) {
	event.preventDefault();	
	props.onSubmit(value, toggle);

    }

    useEffect(() => {
	setValue(props.value);
	setToggle(props.toggle);
    }, [props]);
    
    function togglePosts(toggle) {
	setToggle(toggle);
	props.onSubmit(value, toggle);
    }

    return (
	<form onSubmit={handleSubmit}>
	    <div className="mb-3 d-flex justify-content-between gap-2">
		<InputGroup className="w-100">
		    <Form.Control
			placeholder="Search Posts"
			aria-label="Filter Posts and Threads"
			value={value}
			onChange={handleChange}
		    />
		    <Button variant="btn btn-outline-secondary" id="button-addon2" type="submit">
			<i className="fas fa-search" title="Search Threads"></i>
		    </Button>
		</InputGroup>
		
		<PostToggleButton
		    onChange = {togglePosts}
		/>
	    </div>
	</form>
    )
}
