import React, { useState, useEffect } from "react";
import { Badge } from "react-bootstrap";

const DisplayState = ({state, states}) => {

    let color = states?.find(st => st.name === state) || "info";

    if (state) {
	return (
	    
            <Badge pill bg={ color.color }>
		{state}
            </Badge>
	)
    } else {
	return (
	    <Badge pill bg="warning">
		Unknown
	    </Badge>
	)
    }
    
}

export default DisplayState;
