import React from 'react'
import { useState, useEffect, useRef} from 'react';
import { Nav, InputGroup, Badge, Row, Col, Modal, OverlayTrigger, Dropdown, DropdownButton, Tooltip, ListGroup, Tab, Tabs, Alert, Form, Button } from "react-bootstrap";
import {format, formatDistance} from 'date-fns';
import 'Styles/casethread.css';
import AdminAPI from 'Components/AdminAPI';
import DisplayLogo from "./DisplayLogo";

const adminapi = new AdminAPI();

const BounceModal = (props) => {

    const updateBounce = async () => {

	await adminapi.ignoreBounce(props.bounce.id).then((response) => {
	    console.log(response);
	    props.hideModal();
	}).catch(err => {
	    console.log(err);
	});

    }

    
    return (
        <Modal show={props.showModal} onHide={props.hideModal} size="lg" centered backdrop="static">
	    <Modal.Header closeButton>
		<Modal.Title><u>{props.bounce.bounce_type}</u> Email Bounce</Modal.Title>
            </Modal.Header>
            <Modal.Body>
		<Row>
		    <Col lg={6}>
			<div className="d-flex align-items-center gap-2 mb-2"><b>To:</b>
			    {props.bounce.user ?
			     <>
				 <DisplayLogo
				     name={props.bounce.user.name}
				     photo={props.bounce.user.logo}
				     color={props.bounce.user.logocolor}
				 />
				 <a href={`/cvdp/contact/${props.bounce.user.uuid}`}>{props.bounce.user.name}</a>
				 ({props.bounce.email})
			     </>
			     :
			     <span>{props.bounce.email}</span>
			    }
			</div>
			<p><b>From:</b> {props.bounce.from_email}</p>
			<p><b>Subject:</b> {props.bounce.subject}</p>
		    </Col>
		    <Col lg={6}>
			{props.bounce.groups.length > 0 &&
			 <>
			     <div className="mb-3">This {props.bounce.user ? `user is a member of` : `email belongs to`} the following group{props.bounce.groups.length > 1 && `s`}:</div>
			     {props.bounce.groups.map((x, idx) => (
				 <div className="d-flex align-items-center gap-2 mb-2" key={`assoc-${idx}`}>
				     <DisplayLogo
					 name={x.name}
					 photo={x.logo}
					 color={x.logocolor}
				     />
				     <a href={x.url}>
					 <span className="participant">
					     {x.name}
					 </span>
				     </a>
				     <Button variant="outline-primary" size="sm" href={`/cvdp/inbox/${x.uuid}/admin/bounce/${props.bounce.id}/`}>
					 Message Group Admins
				     </Button>
				 </div>
			     ))}
			 </>
			}
		    </Col>
		</Row>

	    </Modal.Body>
	    <Modal.Footer>
		{props.bounce.action == "ignore" ?
		 ""
		 :
		 <Button variant="outline-secondary" onClick={(e)=>updateBounce()}>Ignore</Button>
		}
                <Button variant="outline-secondary" type="cancel" onClick={props.hideModal}>Done</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default BounceModal;
