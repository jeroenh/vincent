import React from 'react';
import { ListGroup, Modal, Alert, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import { useState, useEffect } from 'react';
import {format} from 'date-fns';
import ThreadAPI from './ThreadAPI';
import ApprovalList from './ActivityApp';

const threadapi = new ThreadAPI();

const ApprovalListModal = (props) => {
    
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [caseInfo, setCaseInfo] = useState(null);
    const [approvals, setApprovals] = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activityHasMore, setActivityHasMore] = useState(false);
    const [activityNext, setActivityNext] = useState(null);
    const [moreLoading, setMoreLoading] = useState(false);
    const [endMessage, setEndMessage] = useState(null);

    const handleSearch = async (event) => {
	if (event) {
	    event.preventDefault();
	}
	setEndMessage(<div className="text-center"></div>);

	if (search) {
	    let filtered = props.approvals.filter(x => {
		if (x.vulnerability?.cve.includes(search) ||
		    x.approval_comments?.includes(search) ||
		    x.request_comments?.includes(search) ||
		    x.advisory_revision?.includes(search) ||
		    x.user?.name.includes(search) ||
		    x.completed_by?.name.includes(search)) {
		    return x;
		}
	    });
	    setApprovals(filtered);

	} else {
	    setApprovals(props.approvals);

	}
    }

    useEffect(() => {

	handleSearch();

    }, [search]);
    

    const fetchInitialData = async () => {

    }

    useEffect(() => {

	if (props.showModal) {
	    setCaseInfo(props.caseInfo);
	    setApprovals(props.approvals);
	    setLoading(false);
	}

    }, [props.showModal]);


    const checkKeyPress = (e) => {
	/* handle enter to submit */
	const { key, keyCode } = e;
	if (keyCode === 13) {
	    handleSearch();
	}
    };


    const getApprovalType = (app) => {

	switch(app.request) {
	case 1:
	    return "to share advisory";
	case 2:
	    return `to publish ${app.vulnerability.vul}`;
	case 3:
	    return `to publish advisory version ${app.advisory_version}`;
	default:
	    return "";
	}
    }
	

    return (
        <Modal show={props.showModal} onHide={props.hideModal} size="lg" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
		<Modal.Title>Case Approvals</Modal.Title>
            </Modal.Header>
            <Modal.Body>
		{error &&
		 <Alert variant="danger">{error}</Alert>
		}
		<InputGroup className="w-100">
		    <InputGroup.Text id="basic-addon1"><i className="fas fa-search"></i></InputGroup.Text>
		    <Form.Control
			placeholder="Filter by Keyword"
			aria-label="search"
			aria-describedby="basic-addon1"
			onChange={(e)=>setSearch(e.target.value)}
			onKeyDown={checkKeyPress}
		    />
		    <Button variant="outline-secondary" onClick={(e)=>handleSearch(e)} id="button-addon2">
			Search
		    </Button>

		</InputGroup>
                {loading ?
                 <div className="text-center">
                     <div className="lds-spinner"><div></div><div></div><div></div></div>
                 </div>
                 :
		 <div>

		     <ListGroup className="mb-3">                                                                                               
			 {approvals.map((app, index) => (
                             <ListGroup.Item key={`app-${index}`} variant="light">{app.user.name} requested approval {getApprovalType(app)} on {format(new Date(app.created), 'yyyy-MM-dd')}<br/>                                                                                                                  
				 <b>Request is {app.status === 'Approved' ? <span className="goodtext">{app.status}</span> : <span className="warningtext">{app.status}</span>}</b><br/>                                                                            
				 {app.request_comments &&
				  <><b>Request Comments:</b> {app.request_comments}<br/></>
				 }
				 {app.completed &&
				  <><b>Review completed by:</b> {app.completed_by.name}<br/></>
				 }                                                                                                              
				 {app.approval_comments &&
				  <><b>Approval Comments:</b> { app.approval_comments }</>
				 }                                                                                                              
                             </ListGroup.Item>
			 ))}                                                                                                                    
                     </ListGroup>
		     {activityHasMore && !moreLoading &&
		      <div className="text-center">
			  <Button className="mb-3" variant="outline-secondary" onClick={(e)=>fetchMoreActivity()}>Load More</Button>
		      </div>
		     }
		     {moreLoading &&
		      <div className="text-center">
			  <div className="lds-spinner"><div></div><div></div><div></div></div>
		      </div>
		     }
                 </div>
                }
	    </Modal.Body>
            <Modal.Footer className="border-top">
		<Button variant="secondary" onClick={props.hideModal}>
		    Return to Case
		</Button>
            </Modal.Footer>
	</Modal>
    )
}

export default ApprovalListModal;
