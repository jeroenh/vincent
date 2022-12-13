import {Badge} from 'react-bootstrap';
import React, { useState } from "react";


const TLPLabel = ({tlp}) => {

    if (!tlp) {
	return "";
    }


    
    if (["AMBER"].includes(tlp.toUpperCase())) {
	return (
	    <Badge pill bg="amber">
		TLP: {tlp}
	    </Badge>
	)
    } else if (["RED"].includes(tlp.toUpperCase())) {
	return (
            <Badge pill bg="danger">
                TLP: {tlp}
            </Badge>
        )
    } else if (["GREEN"].includes(tlp.toUpperCase())) {
	return (
            <Badge pill bg="success">
		TLP: {tlp}
            </Badge>
	)
    } else if (["CLEAR"].includes(tlp.toUpperCase())) {
	return (
	    <Badge pill bg="clear">
		TLP: {tlp}
	    </Badge>
	)
    }

}

export default TLPLabel;
