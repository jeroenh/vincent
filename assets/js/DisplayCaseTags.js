import React, { useState, useEffect } from "react";
import { Badge } from "react-bootstrap";

const DisplayCaseTags = ({tags}) => {

    return (
	<>
	    {tags.map((t, idx) => (
		
		<Badge bg="primary" key={`casetag-${idx}`}>
		    <i className="fas fa-tag me-1"></i>{t}
		</Badge>
	    ))
	    }
	</>
    )
	

    
}

export default DisplayCaseTags;
