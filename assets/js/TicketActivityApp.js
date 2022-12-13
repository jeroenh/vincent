import React, { useState, useEffect } from 'react';
import { format, formatDistance } from 'date-fns';
import {Button, Row, Col} from 'react-bootstrap';
import DisplayLogo from './DisplayLogo';

const TicketActivityApp = (props) => {

    let created = new Date(props.activity.created);
    let timeago = formatDistance(created, new Date(), {addSuffix: true});

    return (
	<Row>
	    <Col lg={1}>
		<DisplayLogo
		    photo = {props.activity.user?.photo}
		    color = {props.activity.user?.logocolor}
		    name= {props.activity.user?.name}
		/>
	    </Col>
	    <Col lg={11}>
		<div className="d-flex justify-content-between pb-3 mt-2">
		    <span><b>{props.activity.user?.name ? props.activity.user.name : "Unknown User"}</b> {props.activity.title}</span>
		    <div className="text-muted"><i className="fas fa-clock" />	{' '}{format(created, 'yyyy-MM-dd H:mm:ss ')} ({timeago})
		    </div>
		</div>
		
		{props.activity.comment &&
		 <>
		     <div className="bold-mx" className="border-start py-1">
			 <div className="mb-0 mx-2" dangerouslySetInnerHTML={{__html: props.activity.comment}} />
		     </div>
		     {/*
		     <div className="d-flex align-items-start gap-3">
			 <Button variant="primary"size="xs">Edit</Button>
			 <Button variant="secondary" size="xs">Delete</Button>
			 </div>
		      */}
		 </>
		}
	    </Col>

	</Row>
    )
}

export default TicketActivityApp;
