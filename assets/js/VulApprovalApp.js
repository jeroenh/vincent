import React, { useState, useEffect } from 'react'
import {Card, ButtonGroup, Dropdown, Modal, Alert, Form, Row, Col, Button, ListGroup} from "react-bootstrap";
import { format, formatDistance, addMinutes, isBefore } from 'date-fns'
import CaseThreadAPI from './ThreadAPI';

const threadapi = new CaseThreadAPI();


const VulApprovalApp = (props) => {

    const [showApprovalRequest, setShowApprovalRequest] = useState(false);
    const [comments, setComments] = useState("");
    const [decision, setDecision] = useState(null);
    const [approval, setApproval] = useState(props.approval || null);
    const [showHistory, setShowHistory] = useState(false);
    const [commentStatus, setCommentStatus] = useState(null);
    const [error, setError] = useState(null);
    const [vul, setVul] = useState(null);
    
    const hideModal = () => {
        setShowApprovalRequest(false);
	fetchInitialData();
    }

    const doInitialLogic = (tvul) => {

	let app = tvul.approvals?.find(x => x.request == 2 && x.status !== "Waiting");
	if (app) {
	    setDecision(app.status);
	} else {
	    setDecision(null);
	}

	let ap = tvul.approvals?.find(x => x.request == 2 && x.status == "Waiting");
	setApproval(ap);

    }


    const requestApproval = async(comments) => {

	if (commentStatus) {
	    update(comments);
	    return;
	}

	let case_id = vul.case.split("#")[1];

        await threadapi.requestCaseApproval(case_id, {vulnerability: vul.id, request_comments: comments, request: 2}).then((response) => {
	    fetchInitialData();

        }).catch(err => {
	    setError(`An error occurred while attempting to request approval: ${err.message}`);
            console.log(err);
        });


    }


    const fetchInitialData = async () => {

	threadapi.getVul(vul).then(response => {
	    setVul(response);
	    if (props.setVul) {
		props.setVul(response);
	    }
	    doInitialLogic(response);
	}).catch(err => {

	    console.log(err);
	});

    }


    const update = async (comments) => {

        let decision = "Approved";
        if (commentStatus === "Rejection") {
            decision = "Rejected";
        }

        await threadapi.updateCaseApproval(approval.id, {status: decision, approval_comments: comments}).then((response) => {
	    console.log(response);
	    setCommentStatus(null);
	    hideModal();
	    props.update();
	    fetchInitialData();

	}). catch(err => {
	    setError(`An error occurred while attempting to ${decision}: ${err.message}`);
	});

    }


    const showCommentModal = (status) => {
        setCommentStatus(status);
        setShowApprovalRequest(true);
    }


    useEffect(() => {
	if (props.vul) {
	    setVul(props.vul);
	}
    }, [props.vul]);

    useEffect(() => {
	if (vul) {
	    doInitialLogic(vul);
	};
    }, [vul]);


    return (
	vul &&
            <>
	    {decision &&
             <Alert variant={decision === 'Approved' ? 'success' : 'danger'}>
                 This CVE has been {decision}.
             </Alert>
            }

		{approval && Object.keys(approval).length > 0 &&
             <Card bg="light" className="mb-3">
                 <Card.Header className="d-flex align-items-start justify-content-between mb-0" as="h5">
                     <Card.Title>
                         This CVE is awaiting publish approval. <Button size="sm" variant="outline-primary" onClick={(e)=>props.preview(props.vul)}>Preview</Button>
                     </Card.Title>

                     {approval.can_approve &&
                      <ButtonGroup aria-label="advisory approval">
                          <Button size="sm" variant="success" onClick={(e)=>showCommentModal("Approval")}>Approve</Button>
                          <Button size="sm" variant="danger" onClick={(e)=>showCommentModal("Rejection")}>Reject</Button>
                      </ButtonGroup>
                     }
                 </Card.Header>
                 <Card.Body>
                     <b>Requested on:</b> {format(new Date(approval.created), 'yyyy-MM-dd')}<br/>
                     <b>Requested by:</b> {approval.user.name}<br/>
                     {approval.request_comments &&
                      <><b>Comments:</b> {approval.request_comments}</>
                     }
                 </Card.Body>
             </Card>
            }

	    {vul.approvals?.length > 0 &&
             <>
                 {showHistory ?
                  <p className="lead"><a href="#" onClick={(e)=>(e.preventDefault(), setShowHistory(false))}>Hide request/approval history</a></p>
                  :
                  <p className="lead"><a href="#" onClick={(e)=>(e.preventDefault(), setShowHistory(true))}>View request/approval history</a></p>
                 }


                 {showHistory &&
                  <ListGroup className="mb-3">
                      {vul.approvals.map((app, index) => (
                          <ListGroup.Item key={`app-${index}`} variant="light">{app.user.name} requested approval on {format(new Date(app.created), 'yyyy-MM-dd')}<br/>
                              <b>Request is {app.status}</b><br/>
                              {app.completed &&
                               <><b>Review completed by:</b> {app.completed_by.name}<br/></>
                              }
                              {app.approval_comments &&
                               <><b>Comments:</b> { app.approval_comments }</>
                              }
                          </ListGroup.Item>
                      ))}
                  </ListGroup>
                 }
             </>
            }

	    {vul.approved || approval ?
	     ""
	     :
	     <>
		 {props.banner &&

		  <Alert variant="warning">
		      <div className="d-flex justify-content-between">
			  <span>
			      This CVE requires approval to publish.
			  </span>
			  <Button variant="primary" onClick={e=>setShowApprovalRequest(true)}>Request Publish Approval</Button>
		      </div>
		  </Alert>

		 }
	     </>

	    }
									{showApprovalRequest &&
									 <Modal show={showApprovalRequest} onHide={hideModal} size="lg" centered backdrop="static">
                 <Modal.Header closeButton className="border-bottom">
                     <Modal.Title>{commentStatus ? `${commentStatus} Comments` : `Request Approval to Publish CVE`}</Modal.Title>
                 </Modal.Header>
                 <Modal.Body>
		     {error &&
		      <Alert variant="danger">{error}</Alert>
		     }
		      
                     <Form.Group className="mb-3">
                         <Form.Label>Provide optional comments</Form.Label>
                         <Form.Control name="comments" as="textarea" rows={6} onChange={(e)=>setComments(e.target.value)}/>
                     </Form.Group>
                 </Modal.Body>
                 <Modal.Footer>
                     <Button variant="secondary" data-testid="cancel-transfer-modal" onClick={hideModal}>
                         Cancel
                     </Button>
                     <Button variant="primary" onClick={(e)=>(requestApproval(comments), hideModal())}>
                         Submit
                     </Button>
                 </Modal.Footer>
             </Modal>
	    }

        </>
    )

}


export default VulApprovalApp;
