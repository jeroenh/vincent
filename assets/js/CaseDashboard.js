import React, { useState, useRef, useEffect } from 'react'
import {ButtonGroup, ToggleButton, ProgressBar, Modal, Card, DropdownButton, Dropdown, InputGroup, FloatingLabel, Form, Badge, Container, Alert, Row, Col, Tab, Tabs, Nav, Button, Tooltip, OverlayTrigger} from 'react-bootstrap';
import {useParams, useNavigate, Link, useLocation} from "react-router"
import CaseThreadAPI from './ThreadAPI';
import DisplayLogo from "./DisplayLogo";
import '../css/casethread.css';
import { format, formatDistance } from 'date-fns';
import VendorStatementList from './VendorStatementList';
import DeleteConfirmation from "./DeleteConfirmation";
import TicketTable from "./TicketTable";
import CaseActivityApp from './CaseActivityApp';
import TicketAPI from './TicketAPI';
import ErrorModal from "./ErrorModal";


const threadapi = new CaseThreadAPI();
const ticketapi = new TicketAPI();

const NOTE_TYPES = ['Flagged', 'Archived']

const CaseDashboard = () => {

    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const [metadata, setMetadata] = useState(null);
    const [crumbs, setCrumbs] = useState(location.state?.breadcrumbs);
    const [crumbLink, setCrumbLink] = useState(location.state?.crumb_link);
    const [caseInfo, setCaseInfo] = useState(location.state?.caseInfo);
    const [isLoading, setIsLoading] = useState(false);
    const [reqUser, setReqUser] = useState(location.state?.reqUser);
    const [activeTab, setActiveTab] = useState(null);
    const [activeNotes, setActiveNotes] = useState("all");
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState(null);
    const [showAddNoteModal, setShowAddNoteModal] = useState(false);
    const [notes, setNotes] = useState([]);
    const [notesNext, setNotesNext] = useState(null);
    const [displayErrorModal, setDisplayErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [ticketType, setTicketType] = useState(searchParams.get('status') || "all");
    const [ticketUrlStr, setTicketUrlStr] = useState(searchParams.get('status') ? `?status=${searchParams.get('status')}` : `?status=all`);
    const [currentCaseState, setCurrentCaseState] = useState(0);



    const ticket_types = [
	{ name: "All", value: "all" },
	{ name: "Unread", value: "unread" },
        { name: "Open", value: "1" },
        { name: "Closed", value: "2" },
	{ name: "In Progress", value: "3"},
    ];

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
	setDisplayErrorModal(false);
    }

    const hideNoteModal = () => {
	setShowAddNoteModal(false);
    }

    // Async Fetch
    const fetchInitialData = async () => {
	if (caseInfo == null) {
            await threadapi.getCase({'case': id}).then((response) => {
                console.log(response);
                setCaseInfo(response);
            }).catch(err => {
                console.log('Error:', err)
                if (err.response.status == 403 || err.response.status==404) {
                    navigate("../err");
		}

                setError(`Error retrieving component status: ${err.message}`);

            });
	}
	if (reqUser == null) {
            await threadapi.getUserCaseState({'case': id}).then((response) => {
                console.log("USER IS ", response);
		setReqUser(response);
	    }).catch(err => {
		console.log(err);
		if (err.response && (err.response.status == 403 || err.response.status==404)) {
		    navigate("err");
		}
	    });
	}

	await threadapi.getCaseMetadata(id).then((response) => {
            setMetadata(response);
        }).catch(err => {
	    console.log(err);
	});
    }

    const filterCaseNotes = async (urlstr) => {
        await ticketapi.filterCaseNotes(id, urlstr).then((response) => {
            console.log(response.results);
            setNotes(response.results);
            setNotesNext(response.next);
        }).catch(err => {
            console.log(err);
            if (err.response && (err.response.status == 403 || err.response.status==404)) {
                navigate("err");
            }
        });
    }

    const fetchCaseTickets = (nextUrl) => {

	if (nextUrl) {
	    return ticketapi.getTickets(nextUrl);
	} else {
	    console.log("IN GET CASE TICKETS")

	    return ticketapi.getCaseTickets(id, ticketUrlStr);
	}
    }


    useEffect(() => {
	fetchInitialData();
	filterCaseNotes("?archived=false");
	if (id)	{
            document.title = `VINCE-NT Case#${id} Dashboard`;
	}
    }, []);


    useEffect(() => {

	if (caseInfo && metadata) {
	    let stindex = metadata.states.find((x, index) => x.name === caseInfo.state);
	    for (let x = 0; x < metadata.states.length; x++) {
		if (metadata.states[x].name === caseInfo.state) {
		    setCurrentCaseState(x);
		    break;
		}
		if (metadata.states[x].children.length > 0) {
		    let states = metadata.states[x].children.map(y => y.name);
		    if (states.includes(caseInfo.state)) {
			setCurrentCaseState(x);
			break;
		    }
		}
	    }

	}
    }, [caseInfo, metadata]);

    const setActiveNotesNow = (props) => {

	const newtab = props ? props : activeNotes;

	if (newtab == "Archived") {
	    filterCaseNotes("?archived=true");
	} else if (newtab == "Flagged") {
	    filterCaseNotes("?flagged=true&archived=false");
	} else {
	    filterCaseNotes("?archived=false");
	}

	setActiveNotes(newtab);
    }


    const milestoneAchieved = (state) => {

	if (metadata) {
	    return metadata.milestones.some(x => x.state == state)
	}
	return false;
    }

    const addCaseNote = async(description) => {

	const data= {'content': description};

	await ticketapi.writeCaseNote(id, data).then(response => {
	    console.log(response);

	    hideNoteModal(true);
	    setActiveNotesNow();
	}).catch(err => {
	    console.log(err);
	    setErrorMessage(`Error adding note: ${err.message}. Is this case assigned?`);
            setDisplayErrorModal(true);
	    hideNoteModal();

	});
    }

    const flagNote = async(note) => {
	const data = {'flagged': !note.flagged}

	await ticketapi.updateCaseNote(note.id, data).then(response => {
	    console.log(response);
            setActiveNotesNow();
        }).catch(err => {
            console.log(err);
            setErrorMessage(`Error updating note: ${err.message}`);
            setDisplayErrorModal(true);

        });
    }


    const archiveNote = async(note) => {
	const data = {'archived': !note.archived}

	await ticketapi.updateCaseNote(note.id, data).then(response => {
            console.log(response);
            setActiveNotesNow();
        }).catch(err => {
            console.log(err);
            setErrorMessage(`Error updating note: ${err.message}`);
            setDisplayErrorModal(true);

        });
    }


    const Note = (props) => {

	return (
	    <Col>
		<Card>
		    <div className="ms-auto">
			<Button variant="icon" onClick={(e) => flagNote(props.note)}><i className={props.note.flagged ? "fas fa-flag link-danger" : "fas fa-flag"}></i></Button>
			<Button variant="icon" onClick={(e) => archiveNote(props.note)}><i className={props.note.archived ? "fas fa-trash-restore" : "fas fa-check"}></i></Button>
		    </div>
		    <Card.Body>
			{props.note.content}
		    </Card.Body>
		    <Card.Footer className="d-flex justify-content-between pb-0">
			<div className="d-flex align-items-center gap-2 mt-2 mb-2">
			    <DisplayLogo
				photo = {props.note.user.photo}
				color = {props.note.user.logocolor}
				name= {props.note.user.name}
                            />
			    <p>{props.note.user.name}</p>
			</div>
			<div>
			    <p className="note-date">{format(new Date(props.note.created), 'yyyy-MM-dd')}</p>
			</div>
		    </Card.Footer>
		</Card>
	    </Col>
	)
    }


    const NoteModal = (props) => {

	const [invalidDescription, setInvalidDescription] = useState(false);
	const [description, setDescription] = useState("");

	const addNote = (e) => {

	    if (description == "") {
		setInvalidDescription(true);
		return;
	    } else {
		props.addNote(description);
	    }
	}
	return (
	    <Modal show={props.showModal} onHide={props.hideModal} backdrop="static" centered>
		<Modal.Header closeButton>
		    <Modal.Title>Add Note</Modal.Title>
		</Modal.Header>
		<Modal.Body>
		    <Form.Group className="mb-3" controlId="_type">
                        <Form.Label>Note <span className="required">*</span></Form.Label>
                        <Form.Control name="description" as="textarea" rows={3} isInvalid={invalidDescription} value={description} onChange={(e)=>(setDescription(e.target.value))}/>
                        {invalidDescription &&
                         <Form.Text className="error">
			    A note is required to submit.
                         </Form.Text>
                        }
		    </Form.Group>
		</Modal.Body>
		<Modal.Footer>
		    <Button data-testid="cancel-confirm" variant="secondary" onClick={props.hideModal}>
			Cancel
		    </Button>
		    <Button variant="primary" onClick={(e) => addNote(e)}>
			Ok
		    </Button>
		</Modal.Footer>
	    </Modal>
	)
    }

    const onSearch = (e, field) => {
        if (field == "state") {
            window.history.pushState({}, '', `?status=${e.target.value}`);
            setTicketUrlStr(`?status=${e.target.value}`);
            setTicketType(e.target.value);
	} else {
            setTicketUrlStr(`?search=${e.target.value}&status=${ticketType}`);
        }
    }


    const TicketStatus = () => {
        const stat = ticket_types.filter(item => item.value == ticketType);
        return (
	    <b>{stat[0].name}</b>
	)
    }


    /*
    useEffect(() => {
	if (activeTab != "addTab") {
	    getThreadParticipants();
	} else {
	    setParticipants([]);
	}
    }, [activeTab]);
    */

    return (
	<>
	    {caseInfo && reqUser &&
		<>
		    <div className="d-flex justify-content-between align-items-center">
		    {crumbs ?

		     <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">{crumbs[0]} /</span> <Link to={crumbLink} >{crumbs[1]}</Link> / <Link to={'..'}>{caseInfo.case_identifier} {caseInfo.title}</Link> / Dashboard</h4>
		     :

		     <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Cases /</span> <Link to={'..'}>{caseInfo.case_identifier} {caseInfo.title}</Link> / Dashboard</h4>

		    }
			{['coordinator', 'owner'].includes(reqUser.role) &&
			 <Button variant="outline-primary" as={Link} to={".."}>Case</Button>
			}
		    </div>

		    {errorMessage &&
		     <Alert variant="danger">{errorMessage}</Alert>
		    }

		    <Row>
			<Col lg={12}>
			    <div className="d-flex align-items-center gap-2 mb-3">
				<Button variant="outline-primary" size="sm" onClick={(e) => document.querySelector("#emailTable").scrollIntoView({behavior: 'smooth', block: 'center'})}>
				    Tickets <Badge bg={metadata?.unread > 0 ? "danger" : "success"}>{metadata?.unread}</Badge>
				    <span className="visually-hidden">unread messages</span>
				</Button>
				<Button variant="outline-primary" size="sm" onClick={(e) => document.querySelector("#unapprovedTable").scrollIntoView({behavior: 'smooth', block: 'center'})}>
				    Unapproved <Badge bg={metadata?.unapproved > 0 ? "danger" : "success"}>{metadata?.unapproved}</Badge>
				    <span className="visually-hidden">unapproved vendor statements</span>
				</Button>
			    </div>
			</Col>
		    </Row>

		    <Row>
			<Col lg={8}>
			    <Row className="mb-3" id="emailTable">
				<Col lg={12}>
				    <Card>
					<Card.Header as="h5" className="pb-1 d-flex justify-content-between gap-5">
					    <Card.Title className="mb-0">
						Emails
					    </Card.Title>
					    <InputGroup>
						<Form.Control
						    placeholder="Search"
						    aria-label="Search Emails"
						    onChange={(e)=>onSearch(e, "cve")}
						/>
						<DropdownButton
						    variant="outline-secondary"
						    title={<TicketStatus />}
						    id="input-group-dropdown-3"
						>
						<Form.Label className="px-3">State</Form.Label>
                                             {ticket_types.map((o, index) => {
                                                 return (
                                                     <Dropdown.ItemText key={index}>
                                                         <Form.Check
                                                             onChange={(e)=>onSearch(e, "state")}
                                                             label={o.name}
                                                             value={o.value}
                                                             title={o.name}
                                                             checked={ticketType === o.value}
                                                             type="checkbox"
                                                         />
                                                     </Dropdown.ItemText>
                                                 )
                                             })}
						</DropdownButton>
					    </InputGroup>
					</Card.Header>
					<Card.Body>
					    <TicketTable
						fetch={fetchCaseTickets}
						reload={ticketUrlStr}
						assignment={{'users': caseInfo.owners?.filter(x => x.participant_type === "user") || []}}
						tableState={{hiddenColumns:['case', 'team']}}
						user = {reqUser.user}
					    />

					</Card.Body>

				    </Card>
				</Col>
			    </Row>
			    <Row className="mb-3" id="unapprovedTable">
				<Col lg={12}>
				    <VendorStatementList
					caseInfo={caseInfo}
					reqUser={reqUser}
				    />
				</Col>
			    </Row>
			    <Row className="mb-3">
				<Col lg={12}>
				    <Card>
					<Tab.Container
					    defaultActiveKey="all"
					    activeKey = {activeNotes}
					    className="mb-3"
					    onSelect={setActiveNotesNow}
					>
					    <Card.Header>
					    <Nav variant="pills"  className="p-3 bg-light mb-3 rounded-pill align-items-center">
						<Nav.Item key="all">
						    <Nav.Link eventKey="all" className="rounded-pill note-link d-flex align-items-center px-2 px-md-3 mr-0 mr-md-2" id="all-category">
							<i className="icon-layers mr-1"></i><span>All Notes</span>

						    </Nav.Link>
						</Nav.Item>
						{NOTE_TYPES.map(item => (
						    <Nav.Item key={item}>
							<Nav.Link eventKey={item} className="rounded-pill note-link d-flex align-items-center px-2 px-md-3 mr-0 mr-md-2" id="note-business"> <i className="icon-briefcase mr-1"></i><span>{item}</span></Nav.Link>
						</Nav.Item>
						))}
						<Nav.Item key="add" className="ms-auto">
						    <Button variant="primary" onClick={(e)=> setShowAddNoteModal(true)} className="rounded-pill d-flex align-items-center px-2" id="add-notes"> <i className="fas fa-pen m-1"></i><span className="font-14">Add Note</span></Button>
						</Nav.Item>
					    </Nav>
					    </Card.Header>
					    <Card.Body>
						<Tab.Content id="admin-fns" className="p-0">
						    <Tab.Pane eventKey="all" key="all">
							<Row xs={1} md={2} className="g-4">
							{notes.map((note, idx) => (
							    <React.Fragment key={idx}>
								<Note
								    note={note}
								/>
							    </React.Fragment>
							))}
							</Row>
                                                    </Tab.Pane>
						    {NOTE_TYPES.map(item => (
							<Tab.Pane eventKey={item} key={item}>
							    <Row xs={1} md={2} className="g-4">
								{notes.map((note, idx) => (
								    <React.Fragment key={idx}>
									<Note
									    note={note}
									/>
								    </React.Fragment>
								))}
							    </Row>
							</Tab.Pane>
						    ))}
						</Tab.Content>
					    </Card.Body>
					</Tab.Container>
					<NoteModal
					    showModal={showAddNoteModal}
					    hideModal={hideNoteModal}
					    addNote={addCaseNote}
					/>
				    </Card>
				</Col>
			    </Row>
			</Col>

			<Col lg={4}>
			    <Card>
				<Card.Header as="h5" className="pb-1">
				    <Card.Title className="pb-0">
					Milestones
				    </Card.Title>
				</Card.Header>
				<Card.Body>
				    <ul className="list-unstyled mb-4 thread-preview-list">
					{metadata?.states?.length > 0 &&
					 <>
					     {metadata.states.map((state, idx) => (
					 	 <li className="p-2 border-bottom" key={`state-${idx}`}>
						     <div className="d-flex justify-content-between align-items-start">
							 <OverlayTrigger overlay={<Tooltip>{state.description}</Tooltip>}>
							     <h6 className="mb-1">{state.name}</h6>
							 </OverlayTrigger>
							 {idx == currentCaseState ?
							  <>
							      {caseInfo.state_meta &&
							       <span> {caseInfo.state_meta}</span>
							      }
							      <i className="fas fa-circle warningtext"></i>
							  </>
							  :
							  <>
							      {milestoneAchieved(state.name) &&
							       <i className="fas fa-check goodtext"></i>
							      }
							  </>
							 }
						     </div>
						     {state.children.length > 0 &&
						      <ul>
							  {state.children.map((child, index) => (
							      <span className="d-flex justify-content-between align-items-start" key={`substate-${idx}-${index}`}>
								  <OverlayTrigger overlay={<Tooltip>{child.description}</Tooltip>}>
								      <li>{child.name}</li>
								  </OverlayTrigger>

								  {child.name == caseInfo.state ?
								   <>
								       {caseInfo.state_meta &&
									<span>{caseInfo.state_meta}</span>
								       }

								       <i className="fas fa-arrow-circle-left"></i>
								   </>
								   :
								   <>
								       {milestoneAchieved(child.name) &&
									<i className="fas fa-check goodtext"></i>
								       }
								   </>
								  }
							      </span>
							  ))}
						      </ul>
						     }
						 </li>
					     ))}
					 </>
					}
				    </ul>
				</Card.Body>
			    </Card>
			</Col>
		    </Row>

		    {/*
		    <ProgressBar now={60} />
                     <ErrorModal
                         showModal = {displayErrorModal}
                         hideModal = {hideConfirmationModal}
                         message = {errorMessage}
			 />

		     */}











		</>






	    }
	</>
    )

};

export default CaseDashboard;
