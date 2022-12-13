import React from 'react';
import ReactDOM from "react-dom";
import Image from 'react-bootstrap/Image';

export default function DisplayLogo(props) {

    const {name, photo, color, tag} = props;


    let style = {
	backgroundColor: "#959595"
    };

    if (color) {
	style = {
            backgroundColor: color
	};
    }
    if (tag) {
	return (
	    <div className="profile-pic rounded-circle text-center flex-shrink-0" style={style}>
            <span className="logo-initial"><i className="fas fa-tag"></i></span></div>
        )

    }


    if (photo) {
	return (
	    <Image src={photo} className="profile-pic flex-shrink-0" rounded />
	)
    } else {
	return (
	    <div className="profile-pic rounded-circle text-center flex-shrink-0" style={style}>
	    <span className="logo-initial">{name ? name[0] : "?"}</span></div>
	)
    }
}
