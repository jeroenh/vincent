import React, { useState, useEffect } from 'react'
import {Card, Modal, Alert, NavDropdown, DropdownButton, Dropdown, InputGroup, FloatingLabel, Form, Container, Row, Col, Badge, Button, OverlayTrigger, Tooltip} from 'react-bootstrap';
import {createEvent} from 'ics';
import { format, formatDistance, addMinutes, isBefore } from 'date-fns'
import CaseThreadAPI from './ThreadAPI';
import TagModal from './TagModal';
import AdminAPI from './AdminAPI';
import '../css/casethread.css';
import DisplayStatus from './DisplayStatus';
import StateChanger from './StateChanger'
import DisplayLogo from './DisplayLogo';
//import CSAFValidatorModal from './CSAFValidatorModal';
import {Typeahead} from 'react-bootstrap-typeahead';
import AutoAssignModule from './AutoAssignModule';
import UnassignModule from './UnassignModule';
import NotifyVendorModal from "./NotifyVendorModal";
import {useModalManager} from "./hooks/useModalManager";
import TransferCaseModal from "./TransferCaseModal";
import ConfirmStartAdvisoryModal from "./ConfirmStartAdvisoryModal";
import PublishAdvisoryModal from "./PublishAdvisoryModal";
import ErrorModal from "./ErrorModal";
import {Link, useNavigate} from "react-router"
import ApprovalListModal from "./ApprovalListModal";

const threadapi = new CaseThreadAPI();
const adminapi = new AdminAPI();

const CaseStatusApp = (props) => {

    const navigate = useNavigate();
    const { openModal, closeModal, currentModal } = useModalManager();
    const [apiError, setApiError] = useState(null);
    const [coordinator, setCoordinator] = useState([]);
    const [caseInfo, setCaseInfo] = useState(null);
    const [date, setDate] = useState("")
    const [drfError, setDRFError] = useState(null);
    const [datePublic, setDatePublic] = useState("");
    const [dateDue, setDateDue] = useState("");
    const [caseResolution, setCaseResolution] = useState("");
    const [metadata, setMetadata] = useState({});
    const [users, setUsers] = useState({});
    const [error, setError] = useState(null);
    const [newStatus, setNewStatus] = useState(null);
    const [notifyVendorCount, setNotifyVendorCount] = useState(0);
    const [displayTransferModal, setDisplayTransferModal] = useState(false);
    const [displayErrorModal, setDisplayErrorModal] = useState(false);
    const [displayPublishModal, setDisplayPublishModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [showUnassignModal, setShowUnassignModal] = useState(false);
    const [unassignType, setUnassignType] = useState("");
    const [showAdvisory, setShowAdvisory] = useState(false);
    const [openApprovalList, setOpenApprovalList] = useState(false);
    
    const hideErrorModal = () => {
	setDRFError(null);
	setErrorMessage(null);
	setDisplayErrorModal(false);
	setOpenApprovalList(false);
    }

    const hideTransferModal = () => {
	setDisplayTransferModal(false);
	/*if transfer was successful, case status should have changed */
	props.updateStatus();
    }

    const hideAutoAssign = () => {
	setShowUnassignModal(false);
	setDisplayPublishModal(false);
	setApiError(null);

    };

    const hideVNModal = () => {
	closeModal();
	/* if we get here, that means user decided not to notify vendors
	   at the email prompt, so we need to update status */
	props.updateStatus();
    }

    const unassignUser = async (users, reason) => {
	setShowUnassignModal(false);

	let data = {users: users, reason: reason}

	await threadapi.unassignCase(caseInfo.case_id, data).then((response) => {
	    if ('redirect' in response) {
		window.location = response['redirect'];
	    }
	    props.updateStatus();
	}).catch(err => {
	    if (err.response?.status == 403) {
		setErrorMessage(`Error removing user from case: Permission Denied.`);
	    } else {
		setErrorMessage(`Error removing user from case: ${err.message}: ${err.response?.data?.error}`);
	    }
            setDisplayErrorModal(true);
	    console.log(err);
	});
    }

    function assignUser(evtKey, evt) {
	if (evtKey === "auto_assign") {
	    openModal("autoAssign");
	} else if (evtKey.includes("unassign")) {
	    setUnassignType(evtKey);
	    setShowUnassignModal(true);
	} else {
	    threadapi.assignCase(caseInfo.case_id, evtKey).then((response) => {
		props.updateStatus();
	    });
	}
    };

    const autoAssignUser = async (role) => {
	await threadapi.autoAssignCase(caseInfo.case_id, role).then((response) => {
            props.updateStatus();
	    hideAutoAssign();
        }).catch(err => {
	    setApiError(`Error auto assigning case: ${err.message}: ${err.response?.data?.error}`);
	});

    }

    const editCase = () => {
	const currentPath = window.location.pathname;
	if (currentPath.endsWith('/')) {
	    window.location=`${currentPath}edit`;
	} else {
	    window.location=`${currentPath}/edit`;
	}
    }
    
    const submitNotifyVendors = async (subject, content) => {

	let formField = new FormData();
	formField.append('subject', subject);
        formField.append('content', content);

        await threadapi.notifyAllParticipants({'case': caseInfo.case_id}, formField).then((response) => {
	    closeModal();
	    props.updateStatus();
	    props.reload();

        }).catch(err => {
	    if (err.response?.status == 400) {
	        setDRFError(err.response.data);
            } else {
                setErrorMessage(`Error notifying vendors: ${err.message}.`);
            }
            setDisplayErrorModal(true);
	    console.log(err);
	});

    }

    const requestApproval = async(comments, approval_type) => {
	await threadapi.requestCaseApproval(caseInfo.case_id, {request_comments: comments, request: approval_type}).then((response) => {
	    props.reload();
	}).catch(err => {
	    console.log(err);
	});
    }


    const checkPrompt = async () => {
	/*check to see if there are unnotified vendors and prompt user to notify*/
	threadapi.getCaseParticipantSummary({'case':caseInfo.case_id}).then((response) => {
	    if (response.data.count != response.data.notified) {
		setNotifyVendorCount(response.data.count-response.data.notified);
		/* prompt user to notify participants */
		openModal("notifyPrompt")
	    } else {
		props.updateStatus();
	    }
	});
    }

    
    function updateStatus(status) {
	const before_status = caseInfo.status;
	const data = {'status': status};

	closeModal();

	threadapi.updateCase(caseInfo, data).then((response) => {
	    if (before_status != "Active" && status == "Active") {
		checkPrompt();
	    } else {
		props.updateStatus();
	    }
        }).catch(err => {
	    if (err.response?.status == 400) {
                setDRFError(err.response.data);
	    } else {
		setErrorMessage(`Error updating status: ${err.message}. Is this case assigned?`);
	    }
	    setDisplayErrorModal(true);
	    console.log(err);
	});

    }

    function changeStatus(evtKey, evt) {
	if (caseInfo.status != "Inactive" && evtKey == "Inactive") {
	    openModal("resolutionPrompt");
	} else {
	    updateStatus(evtKey);
	}
    };


    function changeState(evtKey, evt) {
	const data = {'state': evtKey};
        threadapi.updateCase(caseInfo, data).then((response) => {
            props.updateStatus();
        }).catch(err => {
	    if (err.response?.status == 400) {
                setDRFError(err.response.data);
            } else {
		setErrorMessage(`Error updating state: ${err.message}. Is this case assigned?`);
	    }
            setDisplayErrorModal(true);
            console.log(err);
        });

    }


    async function downloadCalendar () {
	const filename = `${caseInfo.case_identifier}.ics`;
	const dueDate = [dateDue.getFullYear(), dateDue.getMonth()+1, dateDue.getUTCDate(), 9, 0];
	const event = {
	    start: dueDate,
	    title: `${caseInfo.case_identifier}: ${caseInfo.title}`,
	    description: `${caseInfo.summary}`,
	    url: window.location.href,
	    status: 'TENTATIVE',
	    organizer: { name: 'VINCE-NT', email: '' },
	}
	const file = await new Promise((resolve, reject) => {
	    createEvent(event, (error, value) => {
		if (error) {
		    reject(error)
	  }

		resolve(new File([value], filename, { type: 'plain/text' }))
	    })
	})
	const url = URL.createObjectURL(file);

	// trying to assign the file URL to a window could cause cross-site
	// issues so this is a workaround using HTML5
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;

	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);

	URL.revokeObjectURL(url);
    }


    const shareAdvisory = async() => {
	threadapi.shareAdvisory(caseInfo.case_id).then(response => {
	    props.updateStatus();
	}).catch(err => {
	    console.log(err);
	    setError(`Error sharing advisory: ${err.message}`);
	    
	});
    }


    const publishAdvisory = () => {
	props.updateStatus();
	hideAutoAssign();
    }

    const StatusChanger = (props) => {
	return (
	    <Dropdown onSelect={changeStatus}>
            <Dropdown.Toggle className="p-0" variant="light">
                <DisplayStatus
                    status={props.status}
                />
            </Dropdown.Toggle>
            <Dropdown.Menu>
		<Dropdown.Item key="Pending" eventKey="Pending">
		    <DisplayStatus
                        status="Pending"
		    />
		</Dropdown.Item>
		<Dropdown.Item key="Active" eventKey="Active">
                    <DisplayStatus
                        status="Active"
                    />
                </Dropdown.Item>
                <Dropdown.Item key="Inactive" eventKey="Inactive">
		<DisplayStatus
                    status="Inactive"
                />
                </Dropdown.Item>
	    </Dropdown.Menu>
	</Dropdown>
	)
    }

    const ApprovalDropdown = (props) => {

	const [showApprovalRequest, setShowApprovalRequest] = useState(false);
	const [comments, setComments] = useState("");
	const [approvalType, setApprovalType] = useState(1);
	
	const hideModal = () => {
	    setShowApprovalRequest(false);
	    props.update();
	}

	if (props.caseInfo.advisory_status !== "NOT STARTED") {

	    let app = metadata.approvals.find(x => x.request == 1);
	    let pubapp = metadata.approvals.find(x => x.request == 3);
	    if (app && pubapp) {
		return "";
	    } else {
		return (
		    <>
			{!pubapp &&
			 <Dropdown.Item eventKey='pubrequest' onClick={e=>{setShowApprovalRequest(true), setApprovalType(3)}}>Request Publish Approval</Dropdown.Item>
			}
			
			{!app &&
			 <Dropdown.Item eventKey='request' onClick={e=>{setShowApprovalRequest(true)}}>Request Share Approval</Dropdown.Item>
			}
			
			{showApprovalRequest &&

			 <Modal show={showApprovalRequest} onHide={hideModal} size="lg" centered backdrop="static">
			     <Modal.Header closeButton className="border-bottom">
				 <Modal.Title>Request Approval to {approvalType == 3 ? "Publish" : "Share" } Advisory</Modal.Title>
			     </Modal.Header>
			     <Modal.Body>
				<Form.Group className="mb-3">
				    <Form.Label>Provide optional comments</Form.Label>
				    <Form.Control name="comments" as="textarea" rows={6} onChange={(e)=>setComments(e.target.value)}/>
				</Form.Group>
			     </Modal.Body>
			     <Modal.Footer>
				 <Button variant="secondary" data-testid="cancel-transfer-modal" onClick={hideModal}>
				     Cancel
				 </Button>
				 <Button variant="primary" onClick={(e)=>(props.submit(comments, approvalType), hideModal())}>
				     Submit
				 </Button>
			     </Modal.Footer>
			 </Modal>
			}

		    </>
		)
	    }

	}
	return "";

    }


    const notifyAll = async () => {
	closeModal();
	openModal("vendorNotify");
    }

    const updateResolution = async () => {
	const data = {'resolution': caseResolution, 'status': 'Inactive'};
        threadapi.updateCase(caseInfo, data).then((response) => {
            props.updateStatus();
        }).catch(err => {
	    if (err.response?.status == 400) {
                setDRFError(err.response.data);
            } else {
		setErrorMessage(`Error updating resolution: ${err.message}. Is this case assigned?`);
	    }
            setDisplayErrorModal(true);
            console.log(err);
        });
    }

    const saveTags = async (tags) => {

        const formDataObj = {};
        formDataObj['tags'] = tags.map(t => t.tag);

	closeModal();
	
        await threadapi.updateCase(props.caseInfo, formDataObj).then((response) => {
            props.updateStatus();
        }).catch(err => {
            console.log(err);
	    setErrorMessage(`An error occurred: ${err.response?.data?.detail}. Make sure you are assigned to the case before editing.`);
	    setDisplayErrorModal(true);

        })

    }
    

    useEffect(()=> {
	if (caseResolution && currentModal == "resolutionPrompt") {
	    closeModal();
	    updateResolution();
	}
    }, [caseResolution]);


    const NotifyPrompt = (props) => {

	return (
            <Modal show={props.show} centered onHide={props.hide} backdrop="static">
		<Modal.Header closeButton>
		    <Modal.Title>{props.title}</Modal.Title>
		</Modal.Header>
		<Modal.Body>{props.message}</Modal.Body>
		<Modal.Footer>
		    <Button variant="secondary" onClick={props.hide}>
			No
		    </Button>
		    <Button variant="primary" onClick={notifyAll}>
			Yes
		    </Button>
		</Modal.Footer>
	    </Modal>
	)
    }

    const AddResolutionPrompt = (props) => {

	const [resolution, setResolution] = useState("");
	const [other, setOther] = useState("");
	const [showOther, setShowOther] = useState(false);
	const [options, setOptions] = useState([]);
	const [error, setError] = useState(null);

	const fetchInitialData = async () => {
	    adminapi.getResolutionOptions().then((response) => {
		setOptions(response);
		if (response.length == 0) {
		    setError("Improperly configured. No resolutions available. Ask admin to create resolution options.");
		}
            }).catch(err => {
		console.log(err);
		setError(`Error retrieving resolutions - ${err.message}`);
            });
	}

	useEffect(() => {
	    if (props.show) {
		fetchInitialData();
	    }
	}, []);

	const addResolution = async () => {
	    if (other) {
		setCaseResolution(other);
	    } else if (resolution) {
		setCaseResolution(resolution);
	    } else {
		updateStatus("Inactive");
	    }
	}

	return (
            <Modal show={props.show} centered onHide={props.hide} backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title>Add Resolution</Modal.Title>
                </Modal.Header>
                <Modal.Body><p>Optional: Add a resolution for this case.</p>
		    {error &&
		     <Alert variant="danger">{error}</Alert>
		    }
		    <Form.Group className="mb-3" controlId="_type">
			<Form.Label>Resolution </Form.Label>
			{options.map((o, index) => {
			    return (
				<Form.Check
				    label={o.description}
				    name="resolution"
				    type="radio"
				    value="fixed"
				    onChange={(e)=>setResolution(o.description)}
				    key={`resolution-${o.id}`}
				/>
			    )
			})}
			<Form.Check
			    label="Other"
			    name="resolution"
			    type="radio"
			    value="other"
			    onChange={(e)=>setShowOther(true)}
			    key="resolution-other"
			/>
		    </Form.Group>
		    {showOther &&
		     <Form.Group className="mb-3">
			 <Form.Control autoFocus placeholder="Required: resolution" name="resolution" as="textarea" rows={3} value={other} onChange={(e)=>setOther(e.target.value)}/>
		     </Form.Group>
		     }

		</Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={addResolution}>
			{resolution || other ?
                         `Add Resolution`
			 :
			 `Continue without resolution`
			}
                    </Button>
                </Modal.Footer>
            </Modal>
        )
    }

    const downloadJSON = () => {
	let obj = {};
	threadapi.getCurrentAdvisory({'case':caseInfo.case_id}).then((response) => {
	    let obj = response;
	    delete obj['diff'];
	    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
	    const a = document.createElement('a');
	    a.setAttribute("href",     dataStr);
	    a.setAttribute("download", `${caseInfo.case_identifier}` + ".json");
	    document.body.appendChild(a);
	    a.click();
	    a.remove();
	});
    }

    const canPublish = () => {

	if (metadata?.approvals?.find(x => (x.request == 3 && x.status === "Approved"))) {
	    return true;
	}

	return false;
    }


    const canShare = () => {
	    
	if (metadata?.approvals?.find(x => (x.request == 1 && x.status === "Approved"))) {
	    return true;
	}

	return false;
    }


    const goToAdvisory = (e, advisory_state) => {

	if (advisory_state == "NOT STARTED") {
	    openModal('confirmStartAdvisory');
	} else {
	    switch(e) {
	    case "editor":
		navigate("advisory/", {state: { caseInfo: caseInfo }});
		return;
	    case "html":
		navigate("advisory/preview/", {state: { caseInfo: caseInfo }});
		return;
	    case "validate":
		navigate("advisory/validator/", {state: { caseInfo: caseInfo }});
		return;
	    case "json":
		window.location.href = `/cvdp/api/case/${caseInfo.case_id}/advisory/csaf/`;
		return;
	    default:
		navigate("advisory/", {state: { caseInfo: caseInfo }});
	    }
	}
    }

    const startAdvisory = async () => {
	let formData = {};
	closeModal();

	formData['title']=caseInfo.title;
	formData['content'] = `Advisory for case ${caseInfo.case_id}`;
	formData['json_content'] = [];
	formData['user_message'] = "started advisory";
	
	threadapi.saveAdvisory({'case': caseInfo.case_id}, formData).then((response) => {

	    navigate("advisory/preview/", {state: {caseInfo:caseInfo}});
	    
        }).catch(err => {
	    if (err.response?.status == 400) {
                setDRFError(err.response.data);
            } else {
                setErrorMessage(`Error starting advisory: ${err.message}.`);
            }
            setDisplayErrorModal(true);
        });

    }
    
    const AdvisoryBadge = (props) => {
	let badgetype = "info";

	switch(props.advisory) {
	case "NOT STARTED":
	    badgetype="warning"
	    break;
	case "PUBLISHED":
	    badgetype="success"
	    break;
	default:
	    break;
	}
	return (
	    <div className="d-flex align-items-center gap-3">
		{['owner'].includes(props.role) ?
		 <Dropdown>
		     <Dropdown.Toggle className="p-0" variant="light">
			 <Badge pill bg={badgetype}>
			     {props.advisory}
			 </Badge>
		     </Dropdown.Toggle>
		     <Dropdown.Menu>
			 <Dropdown.Item key="editor" eventKey="editor" onClick={(e)=>goToAdvisory("editor", props.advisory)}>
			     Editor
			 </Dropdown.Item>
			 <Dropdown.Item eventkey="html" onClick={(e)=>goToAdvisory("html", props.advisory)}>
			     HTML Preview
			 </Dropdown.Item>
			 <Dropdown.Item key="validator" eventkey="validate" onClick={(e)=>goToAdvisory("validate", props.advisory)}>
			     CSAF Validator
			 </Dropdown.Item>
			 <Dropdown.Item key="json" eventkey="json" onClick={(e)=>goToAdvisory("json", props.advisory)}>
			     {/*"`/cvdp/api/case/${props.case_id}/advisory/csaf/`}>")} href={*/}

			     View CSAF JSON
			 </Dropdown.Item>
		     </Dropdown.Menu>
		 </Dropdown>
		 :
		 <Link to="advisory/preview">
		     <Badge pill bg={badgetype}>
			 {props.advisory}
                     </Badge>
		 </Link>
		}
		{props.advisory !== "NOT STARTED" &&
                <DropdownButton variant="btn p-0"
                                title={<i className="fas fa-download" title="Download/Share Advisory"></i>}
		>
		    <Dropdown.Item key="csaf" eventKey="csaf" href={`/cvdp/api/case/${props.case_id}/advisory/csaf/download/`}>
			Download CSAF JSON
		    </Dropdown.Item>
		    {['owner'].includes(props.role) &&
		     <>
			 <Dropdown.Item key="pdf" eventKey="pdf" href={`/cvdp/cases/${props.case_id}/csaf/pdf/`}>
			     PDF (beta)
			 </Dropdown.Item>

		     </>
		    }
		</DropdownButton>
		}
	    </div>

	)
    }

    const CustomMenu = React.forwardRef(
	({ children, style, className, 'aria-labelledby': labeledBy }, ref) => {
	    const [value, setValue] = useState('');
	    return (
		<div
		    ref={ref}
		    style={style}
		    className={`${className} assignmentdrop`}
		    aria-labelledby={labeledBy}
		>
		    {React.Children.toArray(children).length > 0 &&
		     <Form.Control
			 autoFocus
			 className="mx-3 my-2 w-auto"
			 placeholder="Type to filter..."
			 onChange={(e) => setValue(e.target.value)}
			 value={value}
		     />
		    }
		    <ul className="list-unstyled">
			{React.Children.toArray(children).filter(
			    (child) =>
			    !value || child.props.children.key?.toLowerCase().startsWith(value),
			)}
		    </ul>
		</div>
	    );
	},
    );

    const AssignmentDropdownButton = (props) => {

	let owners = props.owners;
	let unassigntype = -1;
	let show_autoassign = false;
	let options = [];

	const popperConfig = {
	    strategy: "fixed"
	};

	let title = (
	    <div className="d-flex align-items-center gap-2 mt-2 mb-2">
		<DisplayLogo
		    name="?"
		/>
		<span className="participant">
		    Unassigned
		</span>
	    </div>
	);

	if (props.type) {
	    owners = props.owners.filter(x => x.participant_type === props.type)
	    if (props.type !== "user") {
		unassigntype = -2;
	    }
	    if (props.options?.users && props.type === "user") {
		options = props.options.users;
	    } else if (props.options?.teams && props.type === "group") {
		options = props.options.teams;
	    } else if (props.options) {
		/* combine them */
		if (props.options.user) {
		    options = props.options.users;
		}
		if (props.options.teams) {
		    options.push(...props.options.teams);
		}
	    }
	}

	if (owners.length > 0) {
	    title = owners.map((item, index) => {
		return (
		    <div className="d-flex align-items-center gap-2 mt-2 mb-2" key={`owner=${item.id}`}>
			<DisplayLogo
			    name={item.name}
			    color={item.logocolor}
			    photo={item.photo}
			/>
			<span className="participant" data-testid="testing-assignee">
			    {item.name}
			</span>
		    </div>
		)
	    })
	}
	return (
	    <>
		{['owner'].includes(props.role) && options.length > 0 ?
		 <Dropdown onSelect={assignUser} className="assignment_dropdown" title="Select User">
		     <Dropdown.Toggle className="p-0" variant="light">
			 {title}
		     </Dropdown.Toggle>
		     <Dropdown.Menu style={{ margin:0}} as={CustomMenu} popperConfig={popperConfig} renderOnMount>
			 {options.map((u, index) => {
			      return (
				  <Dropdown.Item key={u.name} eventKey={u.uuid}>
				      <div className="d-flex align-items-center gap-2 mt-2 mb-2" key={u.name}>
					  <DisplayLogo
					      name={u.name}
					      color={u.logocolor}
					      photo={u.photo}
					  />
					  <span className="participant">
					      {u.name}
					  </span>
				      </div>
				  </Dropdown.Item>
			      )
			 })
			 }
			 {options.length > 0 && props.options.roles?.length > 0 && props.type === "user" &&
			  <>
			      <Dropdown.Divider />

			      <Dropdown.Item key="Auto Assign" eventKey="auto_assign">
				  <div className="d-flex align-items-center gap-2 mt-2 mb-2" key="Auto Assign">
				      <DisplayLogo
					  name="?"
				      />
				      <span className="participant">
					  Auto Assign
				      </span>
				  </div>
			      </Dropdown.Item>
			  </>
			 }
			 {owners.length > 0 &&
			  <Dropdown.Item key="Unassign" eventKey={`unassign_${props.type}`}>
                              <div className="d-flex align-items-center gap-2 mt-2 mb-2" key="Unassign">
				  <DisplayLogo
                                      name="?"
				  />
				  <span className="participant">
                                      Unassign
				  </span>
                              </div>
			  </Dropdown.Item>
			 }
		     </Dropdown.Menu>
		 </Dropdown>
		 :
		 <>{title}</>
		}
	    </>
	)
    }

    useEffect(() => {
        setCaseInfo(props.caseInfo);
	setDate(new Date(props.caseInfo.created));
	if (props.caseInfo.due_date) {
	    setDateDue(new Date(props.caseInfo.due_date));
	}
	if (props.caseInfo.public_date) {
	    setDatePublic(new Date(props.caseInfo.public_date));
	}

	if (props.caseInfo.owners.length > 0) {
	    let c = props.caseInfo.owners.filter(x => x.participant_type == "group");
	    setCoordinator(c);
	} else {
	    setCoordinator([]);
	}

	if (['DRAFT', 'PUBLISHED'].includes(props.caseInfo.advisory_status)) {
	    setShowAdvisory(true);
	} else {
	    setShowAdvisory(false);
	}

	setMetadata(props.metadata);
	
	if (['coordinator', 'owner'].includes(props.user?.role)) {
	    setShowAdvisory(true);
	}

    }, [props.caseInfo, props.user, props.metadata]);

    return (
        caseInfo ?
	    <Card className="mb-3">
		<Card.Header as="h5" className="d-flex align-items-center justify-content-between pb-2">
		    <Card.Title>Case Details</Card.Title>
		    {props.user.role === "owner" &&
		     <DropdownButton variant="btn p-0"
				     id="case-status-dropdown"
                                    title={<i className="bx bx-dots-vertical-rounded" title="Manage Case Details"></i>}
                    >
                         <Dropdown.Item eventKey='edit' onClick={()=>editCase()}>Edit Details</Dropdown.Item>
			 <Dropdown.Item eventKey="tagCase" onClick={()=>openModal("tagModal")}>Tag Case</Dropdown.Item>
			 <Dropdown.Item eventKey='csaf' as={Link} state={{caseInfo: caseInfo}} to={`csaf/`}>Edit CSAF Settings</Dropdown.Item>
			 <Dropdown.Item eventKey='advisory' as={Link} to={`advisory/`}>Edit Advisory</Dropdown.Item>
			 <ApprovalDropdown
			     caseInfo={caseInfo}
			     metadata={metadata}
			     submit={requestApproval}
			     update={props.updateStatus}
			 />

			 {caseInfo.advisory_status !== "NOT STARTED" &&
			  <>
			      {caseInfo.advisory_status.includes("DRAFT SHARED") ?
			       <Dropdown.Item eventKey='share' onClick={(e)=>shareAdvisory()}>Unshare Advisory</Dropdown.Item>
			       :
			       <>
				   {canShare() &&
				    <Dropdown.Item eventKey='share' onClick={(e)=>shareAdvisory()}>Share Latest Advisory</Dropdown.Item>
				   }
			       </>
			      }
			      {canPublish() &&
			       <Dropdown.Item eventKey='publish' onClick={(e)=>setDisplayPublishModal(true)}>Publish Advisory</Dropdown.Item>
			      }

			  </>
			 }
			 <Dropdown.Item eventKey='transfer' onClick={(e)=>setDisplayTransferModal(true)}>Transfer Case</Dropdown.Item>

                    </DropdownButton>
		    }
		</Card.Header>
		<Card.Body>
		    {apiError &&
		     <Alert variant="danger">{apiError}</Alert>
		    }
		    <Row className="mb-2">
			<Col sm={4}>
			    <Form.Label>Status</Form.Label>
			</Col>
			<Col sm={8}>
			    {props.user.role==="owner" ?
			    <StatusChanger
				status = {caseInfo.status}
				user = {props.user}
			    />
			     :
			     <DisplayStatus
				 status={caseInfo.status}
			     />
			    }
			</Col>
		    </Row>
		    {['owner', 'coordinator'].includes(props.user.role)  &&
		     <>
			 <Row className="mb-2">
			     <Col sm={4}>
				 <Form.Label>State</Form.Label>
			     </Col>
			     <Col sm={8}>
				  <StateChanger
				      state = {caseInfo.state}
				      states= {metadata.states}
				      changeState={changeState}
				  />
			     </Col>
			 </Row>
			 {caseInfo.resolution &&
			  <Row className="mb-2 align-items-center">
			      <Col sm={4}>
				  <Form.Label>Resolution</Form.Label>
			      </Col>
			      <Col sm={8}>
				  {caseInfo.resolution}
			      </Col>
			  </Row>
			 }
		     </>

		    }

                    <Row className="mb-2 align-items-center overflow-hidden">
                        <Col sm={4}>
                            <Form.Label>{coordinator.length > 1 ? `Coordinators` : `Coordinator`}</Form.Label>
                        </Col>
                        <Col sm={8}>
			    <AssignmentDropdownButton
				owners={coordinator}
				options={metadata}
				role={props.user.role}
				type="group"
			    />
                        </Col>
                    </Row>
		    {['owner', 'coordinator'].includes(props.user.role) && coordinator.length > 0 &&
		    <Row className="mb-2 align-items-center overflow-hidden">
                        <Col sm={4}>
                            <Form.Label>Assigned To</Form.Label>
                        </Col>
                        <Col sm={8}>
                            <AssignmentDropdownButton
                                owners={caseInfo.owners}
                                options={metadata}
                                role={props.user.role}
				type="user"
                            />
                        </Col>
                    </Row>
		    }
                    <Row className="mb-2">
                        <Col sm={4}>
                            <Form.Label>Public</Form.Label>
                        </Col>
                        <Col sm={8}>
			    {caseInfo.public_date && isBefore(new Date(caseInfo.public_date), new Date()) ?
			     <Badge pill bg="success">
				 Public
				 </Badge>
			     :
			     <Badge pill bg="warning">
				 NOT Public
			     </Badge>
			    }

                        </Col>
                    </Row>
		    {datePublic &&
                    <Row className="mb-2">
                        <Col sm={4}>
                            <Form.Label>Date Public</Form.Label>
                        </Col>
                            <Col sm={8}>
                                {format(addMinutes(datePublic, datePublic.getTimezoneOffset()), 'yyyy-MM-dd')}
                            </Col>
                    </Row>
		    }
                    <Row className="mb-2">
                        <Col sm={4}>
                            <Form.Label>Date Created</Form.Label>
                        </Col>
                            <Col sm={8}>
				{format(addMinutes(date, date.getTimezoneOffset()), 'yyyy-MM-dd H:mm:ss')}
                            </Col>
                    </Row>
		    <Row className="mb-2">
                        <Col sm={4}>
                            <Form.Label>Est. Date Public</Form.Label>
                        </Col>
                        <Col sm={8}>
			    {dateDue ?
			     <>{format(addMinutes(dateDue, dateDue.getTimezoneOffset()), 'yyyy-MM-dd')}<OverlayTrigger overlay={<Tooltip>Download Calendar reminder</Tooltip>}><a href="#" data-testid="calendar-download" onClick={(e)=>downloadCalendar()}><i className="mx-2 fas fa-calendar-plus" title="Download Calendar Reminder"></i></a></OverlayTrigger></>
			     :
			     <b>TBD</b>
			    }
                        </Col>
                    </Row>



		    {showAdvisory &&
                    <Row className="mb-2">
                        <Col sm={4}>
                            <Form.Label>Advisory</Form.Label>
                        </Col>
                        <Col sm={8}>
			    <AdvisoryBadge
				advisory = {caseInfo.advisory_status}
				case_id = {caseInfo.case_id}
				role = {props.user.role}
			    />
                        </Col>
			{error &&
			 <Alert variant="danger">{error}</Alert>
			}
                    </Row>
		    }

		    {['owner', 'coordinator'].includes(props.user.role) && metadata?.approvals?.length > 0 &&

		     <Row className="mb-2">
			 <Col sm={4}>
			     <Form.Label>Approval Request</Form.Label>
			 </Col>
			 <Col sm={8}>
			     {metadata.approvals.slice(0, 5).map((app, index) => (
				 <div key={`app-${index}`}> <Link to={[1, 3].includes(app.request) ? "advisory/preview/" : `?activeTab=addvuls&cve=${app.vulnerability?.cve}`} state={{caseInfo: caseInfo}}>
								{app.request == 1 ?
								 `Share `
								 :
								 'Publish '
								}
								{[1, 3].includes(app.request) ?
								 `Advisory ${app.advisory_version}`
								 : `CVE ${app.vulnerability?.cve}`
								}
								
							    : {app.status}</Link></div>
			     ))}
			     {metadata.approvals.length > 5 &&
			      <div>
				  <a href="#" onClick={(e)=>(e.preventDefault(), setOpenApprovalList(true))}>
				      View All
				  </a>
				  <ApprovalListModal
				      approvals={metadata.approvals}
				      caseInfo={caseInfo}
				      showModal={openApprovalList}
				      hideModal={hideErrorModal}
				  />
			      </div>
			     }

			 </Col>
		     </Row>
		    }
		</Card.Body>
		{['owner'].includes(props.user.role) &&
		 <>
		     {currentModal === 'confirmStartAdvisory' && (
			 <ConfirmStartAdvisoryModal
			     hideModal={() => closeModal()}
			     doAction={()=>startAdvisory()}
			 />
		     )}
		     {currentModal === "autoAssign" &&
		      <AutoAssignModule
			  showModal = {true}
			  hideModal = {() => closeModal()}
			  confirmModal = {autoAssignUser}
			  roles = {metadata?.roles || []}
			  error={apiError}
		      />
		     }
		     { currentModal === "tagModal" &&
			<TagModal
                            showModal = {true}
                            hideModal = {() => closeModal()}
                            dataType = "case"
                            options = {[]}
                            tags = {caseInfo.tags}
                            submitTags = {saveTags}
			/>
		      }
		     <UnassignModule
			 showModal = {showUnassignModal}
			 hideModal = {hideAutoAssign}
			 confirmModal = {unassignUser}
			 owners = {caseInfo.owners}
			 type={unassignType}
			 caseInfo={caseInfo}

		     />
		     {currentModal === "resolutionPrompt" &&
		      <AddResolutionPrompt
			  show = {true}
			  hide = {() => closeModal()}
		      />
		     }
		     {currentModal === "notifyPrompt" &&
		     <NotifyPrompt
			 show = {true}
			 hide = {() => (closeModal(), updateStatus("Active"))}
			 title="Do you want to notify all participants?"
			 message="Now that the case is active, do you want to notify all participants that haven't been notified?"
		     />
		     }
		     {currentModal === "vendorNotify" &&
		      <NotifyVendorModal
			  showModal = {true}
			  hideModal = {hideVNModal}
			  confirmModal = {submitNotifyVendors}
			  count={notifyVendorCount}
		      />
		     }
		     <TransferCaseModal
			 showModal = {displayTransferModal}
			 hideModal = {hideTransferModal}
			 caseInfo = {caseInfo}
		     />
		     <ErrorModal
			 showModal = {displayErrorModal}
			 hideModal = {hideErrorModal}
			 message = {errorMessage}
			 drf = {drfError}
		     />
		     <PublishAdvisoryModal
			 showModal = {displayPublishModal}
			 hideModal = {hideAutoAssign}
			 caseInfo = {caseInfo}
			 publish = {publishAdvisory}
		     />
		 </>
		}
	    </Card>
	:
	<div className="text-center"><div className="lds-spinner"><div></div><div></div><div></div></div></div>
    )
}

export default CaseStatusApp;
