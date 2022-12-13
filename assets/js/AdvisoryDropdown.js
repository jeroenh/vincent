import React, {useState, useEffect} from "react";
import {Link, useParams, useNavigate} from "react-router";
import {
    Row,
    Col,
    Dropdown,
    Alert,
    ListGroup,
    Card,
    Modal,
    Form, 
    Button,
    ButtonGroup,
    DropdownButton,
} from "react-bootstrap";
import CaseThreadAPI from './ThreadAPI';
import { format } from 'date-fns';

const caseapi = new CaseThreadAPI();

const AdvisoryDropdown = (props) => {

    const [loc, setLoc] = useState(props.home ? "" : "../../");
    const caseInfo = props.caseInfo;
    const navigate = useNavigate();
    const [approvals, setApprovals] = useState([]);
    const [approval, setApproval] = useState(props.approval || null);
    const [showNav, setShowNav] = useState(false);
    const [error, setError] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [commentStatus, setCommentStatus] = useState("Approval");
    const [shareDecision, setShareDecision] = useState(null);
    const [pubDecision, setPubDecision] = useState(null);
    const { id } = useParams();

    const state = {
	approval: approval,
	caseInfo: caseInfo
    }

    const fetchInitialData = async() => {
        await caseapi.getCaseApprovals(id).then((response) => {
	    console.log(response);
	    if (response.results.length > 0) {
		setApprovals(response.results.filter(x => [1, 3].includes(x.request)));
		let ap = response.results.find(x => [1, 3].includes(x.request) && x.status == "Waiting");
		
		if (!ap) {
		    setApproval(null);
		    let dec = response.results.find(x => x.request == 1);
		    if (dec) {
			setShareDecision(dec.status);
		    }
		    let pubdec = response.results.find(x => x.request == 3);
		    if (pubdec) {
			setPubDecision(pubdec.status);
		    }
		} else {
		    setApproval(ap);
		}
	    }
	    setShowNav(true);

	    
        }).catch(err => {
	    setApprovals([]);
	    setShowNav(false);
	    
        });
    }

    useEffect(() => {
	if (props.page === "Advisory") {
	    setLoc("../");
	}
	if (!approval) {
            fetchInitialData();
	} else {
	    if (approval.request != 1) {
		/* not an advisory approval request */
		fetchInitialData();
	    }
	}
    }, []);


    const CaseApprovalCommentsModal = (props) => {
	
	const [reason, setReason] = useState("");
	
	return (
            <Modal show={props.showModal} onHide={props.hideModal} size="lg" centered backdrop="static">
		<Modal.Header closeButton className="border-bottom">
                    <Modal.Title>{props.status} Comments</Modal.Title>
		</Modal.Header>
		<Modal.Body>
		    {error &&
		     <Alert variant="danger">{error}</Alert>
		    }
                    <Form.Group className="mb-3">
			<Form.Label>Comments</Form.Label>
			<Form.Control name="comments" as="textarea" rows={6} onChange={(e)=>setReason(e.target.value)}/>
                    </Form.Group>
		</Modal.Body>
		<Modal.Footer>
                    <Button variant="secondary" data-testid="cancel-transfer-modal" onClick={props.hideModal}>
			Cancel
                    </Button>
                    <Button variant="primary" onClick={()=>props.submit(reason)}>
			{props.status === 'Approval' ? `Approve` : 'Reject'}
                    </Button>
		</Modal.Footer>
            </Modal>

	)
    }

    const DraftBanner = ({csaf}) => {
	
	if (csaf.document?.tracking?.status === "draft") {
	    return (
		<Alert variant="warning">This document is in <b>DRAFT</b> status.  Do not share this document outside of the case.</Alert>
	    )
	}

    }



    const ApprovalAlerts = (props) => {

	const pubDecision = props.publish;
	const shareDecision = props.share;
	const combine = props.publish === props.share ? true : false;

	if (combine && pubDecision && shareDecision) {
	    return (
		<Alert variant={pubDecision === 'Approved' ? 'success' : 'danger'}>
		    <p className="mb-0">This advisory has been {pubDecision} to <b>share</b> and <b>publish</b>.</p>
		</Alert>
	    )
	}

	return (
	    <>
		{pubDecision &&
		 <Alert variant={pubDecision === 'Approved' ? 'success' : 'danger'}>
		     <p className="mb-0">This advisory has been {pubDecision} to publish.</p>
		 </Alert>
		}
		
		{shareDecision &&
		 <Alert variant={shareDecision === 'Approved' ? 'success' : 'danger'}>
		     <p className="mb-0">This advisory has been {shareDecision} for sharing.</p>
		 </Alert>
		}
	    </>
	)
    }
	
    
    const update = async (comments) => {

	let decision = "Approved";
	if (commentStatus === "Rejection") {
	    decision = "Rejected";
	}

	await caseapi.updateCaseApproval(approval.id, {status: decision, approval_comments: comments}).then((response) => {
	    hideComments();
	    fetchInitialData();
	    if (decision === "Approved" && props.update) {
		props.update();
	    }
		
	}). catch(err => {
	    setError(`An error occurred while attempting to ${decision} advisory: ${err.message}`);
	    console.log(err);
	});

    }


    const showCommentModal = (status) => {
	setCommentStatus(status);
	setShowComments(true);
    }


    const hideComments = () => {
	setShowComments(false);
    }

    
    return (
	<>
	    <div className="d-flex justify-content-between">
		<h4 className="fw-bold py-3 mb-2"><span className="text-muted fw-light">Cases /</span> <Link to={loc}>{caseInfo ? `${caseInfo.case_identifier} ${caseInfo.title}` : `${props.csaf?.document.title}`}</Link> / {props.page}</h4>
		{showNav &&
		 <DropdownButton
		     variant="primary"
		     title={
			 <span>
			     Advisory{" "}
			     <i className="fas fa-chevron-down"></i>
			 </span>
		     }
		 >
		     <Dropdown.Item key="editor" eventKey="editor" href={`${loc}advisory/`} state={state}>Editor</Dropdown.Item>
		     <Dropdown.Item key="html" eventkey="html" as={Link} to={`${loc}advisory/preview/`} state={state}>
			 HTML Preview
		     </Dropdown.Item>
		     <Dropdown.Item key="validator" eventkey="validate" as={Link} to={`${loc}advisory/validator/`} state={state}>
			 CSAF Validator
		     </Dropdown.Item>
		     <Dropdown.Item key="csaf" eventKey="csaf" href={`/cvdp/api/case/${id}/advisory/csaf/`}>
			 CSAF
		     </Dropdown.Item>
		     {props.download && props.csaf &&
		      <Dropdown.Item key="download" eventkey="download" onClick={props.download}>
		     Download JSON
		      </Dropdown.Item>
		     }
		 </DropdownButton>
		}
	    </div>

	    {props.csaf &&
	     <DraftBanner
		 csaf = {props.csaf}
	     />
	    }

	    {showNav &&
	     <>
		 <CaseApprovalCommentsModal
		     showModal={showComments}
		     hideModal={hideComments}
		     submit={update}
		     status={commentStatus}
		 />


		 <ApprovalAlerts
		     publish={pubDecision}
		     share={shareDecision}
		 />

		 
		 {approval && Object.keys(approval).length > 0 &&
		  <Card bg="light" className="mb-3">
                      <Card.Header as="h5"  className="d-flex align-items-center justify-content-between mb-0">
			  <Card.Title>
                              This advisory is awaiting {approval.request == 1 ? `share` : `publish`} approval.
			  </Card.Title>
			  {approval.can_approve &&
			   <ButtonGroup aria-label="advisory approval">
                               <Button btn="sm" variant="success" onClick={(e)=>showCommentModal("Approval")}>Approve</Button>
                               <Button btn="sm" variant="danger" onClick={(e)=>showCommentModal("Rejection")}>Reject</Button>
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
		 
		 {approvals.length > 0 &&
		  <>
		      {showHistory ?
		       <p className="lead"><a href="#" onClick={(e)=>(e.preventDefault(), setShowHistory(false))}>Hide request/approval history</a></p>
		       :
		       <p className="lead"><a href="#" onClick={(e)=>(e.preventDefault(), setShowHistory(true))}>View request/approval history</a></p>
		      }
		      
		      
		      {showHistory &&
		       <ListGroup className="mb-3">
			   {approvals.map((app, index) => (
			       <ListGroup.Item key={`app-${index}`} variant="light">{app.user.name} requested approval on {format(new Date(app.created), 'yyyy-MM-dd')}<br/>
				   <b>Request {app.request == 1 ? 'to share' : 'to publish' } is {app.status}</b><br/>
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
	     </>
	    }
	</>
	     

    )
}

export default AdvisoryDropdown;
