import React, { useRef, useState, useEffect, useCallback } from 'react';
import {Card, Badge, DropdownButton, Dropdown, InputGroup, Form, Row, Col, Table, Accordion, Alert, Button} from 'react-bootstrap';
import CaseThreadAPI from './ThreadAPI';
import {useParams, useNavigate, Link, useLocation} from "react-router";
import { format, formatDistance, addMinutes } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz';

const threadapi = new CaseThreadAPI();


const AdvisoryRevisionApp = () => {

    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(null);
    const [caseInfo, setCaseInfo] = useState(location.state?.caseInfo);
    const [revisions, setRevisions] = useState([]);


    // Async Fetch
    const fetchInitialData = async () => {

        if (caseInfo == null) {
            await threadapi.getCase({'case': id}).then((response) => {
		console.log(response);
                setCaseInfo(response);
            }).catch(err => {
                if (err.response.status == 403 || err.response.status==404) {
                    navigate("../err");
                }
                setError(`Error: ${err.message}`);
            });
	}
	await threadapi.getAdvisoryRevisions({'case': id}).then((response)=> {
            setRevisions(response);
	    console.log(response);
        }).catch(err => {
	    if (err.response.status == 403) {
                navigate("../err");
            } else if (err.response.status != 404) {
                setError(`Error: ${err.message}`);
            }
	});


    }


    const navBack = () => {
	navigate('..');
    }

    
    const saveAdvisory = async () => {
	setError(null);
	
	if (caseInfo.advisory_status == "PUBLISHED") {
	/* make sure one revision has date published */
	    let x = revisions.some(rev => rev.date_published != null);
	    if (!x) {
		setError("This advisory is published. At least one revision must provide a date published.");
		return;
	    }

	    let y = revisions.filter(rev => {
		if (rev.date_published && rev.version_number.startsWith("0")) {
		    return rev;
		}
	    });

	    if (y.length > 0) {
		setError("Revisions that are published must have non-zero major version numbers.");
		return;
	    }
	    
	}

        await threadapi.updateRevisions(id, revisions).then((response) => {
            setSuccess("Got it! Your changes have been saved!");
            fetchInitialData();
        }).catch(err => {
	    console.log(err);
            setError(`Error saving advisory: ${err.message}`);
        });
    }
    
    
    const updateRevision = (i, e) => {
	let formname = e.target.name;

	let newFormValues = [...revisions];
	if (formname == "date_published" && e.target.value == "") {
	    newFormValues[i][formname]=null;
	} else {
	    newFormValues[i][formname]=e.target.value;
	}
	setRevisions(newFormValues);

    }


    useEffect(() => {
        fetchInitialData();
    }, [])

    return (

	<>
            {caseInfo ?
	     <>
		 <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Cases /</span> <Link to={'../..'}>{caseInfo.case_identifier} {caseInfo.title}</Link> / <Link to={'..'}>Advisory</Link> / Revisions</h4>


		 {caseInfo.advisory_status == "PUBLISHED" ?
		  <Alert variant="info">Advisory is published.  Only published revisions will be used in CSAF.</Alert>
		  :
		  <Alert variant="info">Advisory is in draft mode.</Alert>
		 }

		 {success &&
		  <Alert variant="success">{success}</Alert>
		 }
		 {error &&
		  <Alert variant="danger">Oops! An error occurred: {error}</Alert>
		 }


		 <Accordion>
                     {revisions.map((rev, index) => {
			 let published = new Date(rev.date_published) || null;
			 return (
			     <Accordion.Item eventKey={index} key={`rev-${rev.revision_number}`}>
				 <Accordion.Header>
				     <div>
					 <span className="px-2">{rev.version_number && <b>V.{rev.version_number}{"    "}</b>}(rev #{rev.revision_number}){" "}
					     {rev.date_published ?
					      <>
						  {formatInTimeZone(new Date(rev.date_published), 'UTC', 'yyyy-MM-dd')}
					      </>
					      :
					      <>
						  {formatInTimeZone(new Date(rev.created), 'UTC', 'yyyy-MM-dd')}
					      </>
					     }
					     {" "} by {rev.author} {" "}
					     {rev.date_published &&
					      <Badge pill variant="primary">Published</Badge>
					     }
					     
					     
					     
					 </span>
				     </div>
				 </Accordion.Header>
				 <Accordion.Body>
				     <Row>
					 <Col lg={12}>
					     <Form.Group className="mb-3">
						 <Form.Label>Log</Form.Label>
						 <Form.Control name="user_message" value={rev.user_message || ""} onChange={(e)=>updateRevision(index, e)}/>
					     </Form.Group>
					 </Col>
				     </Row>
				     <Row>
					 <Col lg={6} md={6} sm={12}>
					     <Form.Group className="mb-3">
						 <Form.Label>Version</Form.Label>
						 <Form.Control name="version_number" value={rev.version_number || ""} onChange={(e)=>updateRevision(index, e)}/>
					     </Form.Group>
					 </Col>
					 <Col lg={6} md={6} sm={12}>
					     <Form.Group className="mb-3">
						 <Form.Label>Date Published</Form.Label>
						 {rev.date_published ?
						  <Form.Control name="date_published" type="date" value={format(addMinutes(published, published.getTimezoneOffset()), 'yyyy-MM-dd')} onChange={(e)=>updateRevision(index, e)}/>
						  :
						  <Form.Control name="date_published" type="date" value={rev.date_published || ""} onChange={(e)=>updateRevision(index, e)}/>
						 }
					     </Form.Group>
					 </Col>
				     </Row>
				 </Accordion.Body>
			     </Accordion.Item>
			 )})
		     }
		 </Accordion>
		 <Row className="mt-3">
		     <Col lg={12}>
			 <div className="mb-3 d-flex align-items-center gap-3">
			     <Button type="Cancel" variant="secondary" onClick={(e)=>navBack()}>
				 Cancel
			     </Button>
			     <Button
				 variant="outline-primary"
				 onClick={(e)=>saveAdvisory()}>
				 Save
			     </Button>
			 </div>
		     </Col>
		 </Row>
	     </>
	     :
	     <p>Loading..</p>
	    }
	</>
    );


}

export default AdvisoryRevisionApp;
