import {Badge} from 'react-bootstrap';
import React, { useState } from "react";

const DisplayStatus = ({status}) => {

    if (["Active", "Open"].includes(status)) {
	return (
	    <Badge pill bg="success">
		{status}
	    </Badge>
	)
    } else if (["Pending", "In Progress"].includes(status)) {
	return (
            <Badge pill bg="warning">
                {status}
            </Badge>
        )
    } else {
	return (
            <Badge pill bg="info">
		{status}
            </Badge>
	)
    }
}

export default DisplayStatus;
