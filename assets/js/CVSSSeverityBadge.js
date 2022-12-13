import {Badge} from 'react-bootstrap';
import React, { useState } from "react";


const CVSSSeverityBadge = ({severity}) => {

    if (["High", "high", "HIGH", "Critical", "CRITICAL"].includes(severity)) {
	return (
	    <Badge pill bg="danger">
		{severity}
	    </Badge>
	)
    } else if (["Medium","medium", "MEDIUM"].includes(severity)) {
	return (
            <Badge pill bg="warning">
                {severity}
            </Badge>
        )
    } else {
	return (
            <Badge pill bg="success">
		{severity}
            </Badge>
	)
    }
}

export default CVSSSeverityBadge;
