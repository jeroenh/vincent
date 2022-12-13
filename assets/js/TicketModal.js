import React from 'react'
import { useState, useEffect, useRef} from 'react';
import { Nav, InputGroup, Badge, Row, Col, Modal, OverlayTrigger, Dropdown, DropdownButton, Tooltip, ListGroup, Tab, Tabs, Alert, Form, Button } from "react-bootstrap";
import TicketAPI from 'Components/TicketAPI';
import DisplayLogo from 'Components/DisplayLogo';
import Messenger from 'Components/Messenger';
import TicketActivityApp from 'Components/TicketActivityApp';
import {format, formatDistance} from 'date-fns';
import 'Styles/casethread.css';
import DOMPurify from 'dompurify';
import AssignmentDropdownButton from './AssignmentDropdownButton';
import AutoAssignModule from './AutoAssignModule';
import DisplayStatus from './DisplayStatus';
import CaseTypeahead from './CaseTypeahead';
import DisplayFilePreview from './DisplayFilePreview';
import MessageThreadEditor from './MessageThreadEditor';

const ticketapi = new TicketAPI();

const initialValue = [
    {
        type: 'paragraph',
        children: [{ text: '' }],
    },
]

// Specify a configuration directive #example for custom DOMPurify
const config = {
    ADD_ATTR: ['mention-id', 'data-id'], // permit mention related attributes
    ADD_TAGS: ['span'], // permit additional custom tags
};

const TicketModal = (props) => {


    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ticket, setTicket] = useState(null);
    const [change, setChange] = useState(false);
    const [tickets, setTickets] = useState([]);
    const [tktCase, setTktCase] = useState([]);
    const [activeTab, setActiveTab] = useState("all");
    const [activity, setActivity] = useState([]);
    const [users, setUsers] = useState([]);
    const [comment, setComment] = useState(initialValue);
    const [saveDisabled, setSaveDisabled] = useState(false);
    const [showAutoAssign, setShowAutoAssign] = useState(false);
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [showMessageReply, setShowMessageReply] = useState(0);
    const [disableUserAssignment, setDisableUserAssignment] = useState(false);
    const [showEditCase, setShowEditCase] = useState(false);
    const [invalidCase, setInvalidCase] = useState(false);
    const messageRef = useRef(null);

    const hideThisModal = () => {
        if (change) {
            setConfirmMessage(`Are you sure you want to exit? Changes will be lost.`);
            setDisplayConfirmationModal(true);
        } else {
            props.hideModal();
        }

    }

    const replyToMessage = () => {
	setShowMessageReply(ticket.msg_thread);
	setTicket(null);
    }

    const backToTicket = () => {
	setLoading(true);
	setShowMessageReply(0);
	fetchTicket();
    }

    const hideAutoAssign = () => {
	setShowAutoAssign(false);
    }

    const sanitizeHTML = (html) => {
        return DOMPurify.sanitize(html, config);
    };

    const addComment = async () => {

	if (comment === JSON.stringify(initialValue)) {
            return
        }

	let html = messageRef.current.sanitizeHTML(comment);

	let data = {'comment': html, 'json': comment}

	await ticketapi.addTicketComment(ticket, data).then((response) => {

	    fetchTicketActivity();
	    clearComment();
	    setShowCommentForm(false);
	    setSaveDisabled(false);

	}).catch(err => {
	    setError(`Error adding comment: ${err.message}`);
	})
    }


    const clearComment = () => {
	messageRef.current.clearText();
	setComment(initialValue);
    }

    const createCase = async () => {

	await ticketapi.createCase(ticket).then(async function (response) {
	    console.log(response);
	    const data= {'case': response.case_id}
            await ticketapi.updateTicket(ticket, data).then((resp) => {
		window.location = `/cvdp/cases/${response.case_id}`;
	    }).catch(error => {
		setError(`Error assigning ticket to case: ${error.message}`);
	    });
	}).catch(err => {
	    setError(`Error creating case: ${err.message}`);
	});
    }

    const setCurrentTicket = async (id) => {

        await ticketapi.getTicket(id).then((response) => {
            setTicket(response);
	    setLoading(false);
        }).catch(err => {
	    setError(`Error retrieving ticket: ${err.message}`);
        });
    }

    function changeStatus(evtKey, evt) {
	ticketapi.updateTicket(ticket, {'status': evtKey}).then((response) => {
	    props.hideModal();
        }).catch(err => {
	    setError(`Error updating ticket: ${err.message}`);
        });


    }


    const StatusChanger = (props) => {
	let btnvariant="primary";
	const TKT_STATUS = ["Open", "In Progress", "Closed"];

	switch(props.status) {
        case 'Open' :
	    btnvariant="success";
	    break;
        case 'Closed':
	    btnvariant="secondary";
	    break;
	default:
	    break;
	}

        return (
            <DropdownButton
		variant={btnvariant}
		onSelect={changeStatus}
		title={
		    <span>{props.status} <i className="fas fa-chevron-down mx-1"></i> </span>
		}
	    >
		{TKT_STATUS.map((item, index) => {
		    if (props.status != item) {
			return (
			    <Dropdown.Item key={item} eventKey={item}>
				<DisplayStatus
				status={item}
				/>
			    </Dropdown.Item>
			)
		    }
		})}
            </DropdownButton>
	)
    }


    // Async Fetch
    const fetchTicket = async () => {

	if (props.ticket.emails.length > 0) {
	    await ticketapi.getThreadTickets(props.ticket.id).then((response) => {
		setTickets(response.results);
		if (response.results.some(y => y.team == null)) {
		    setDisableUserAssignment(true);
		} else {
		    setDisableUserAssignment(false);
		    let group = response.results[0].team;
		    /* set available users */
		    let u = props.assignment.users.filter(x => x.groups.includes(group.name));
		    setUsers(u);

		}
	    }).catch(err => {
		setError(`Error retrieving tickets on thread: ${err.message}`);
	    });
	} else {
	    //setTicket(props.ticket.last_email) - if we do this ticket receipt doesn't get created
	    console.log(props.assignment.users);
	    if (props.ticket.last_email.team == null) {
		setDisableUserAssignment(true);
		console.log("SETTING DISABLE!!!");
	    } else {
		console.log(props.assignment);
		setDisableUserAssignment(false);
		let u = props.assignment.users.filter(x => x.groups.includes(props.ticket.last_email.team.name));
		setUsers(u);
		console.log(u);
	    }

	}

	setCurrentTicket(props.ticket.emails[0]);


    }

    function autoAssignUser(role) {
        ticketapi.autoAssignTicket(ticket, role).then((response) => {
	    setTicket(response);
            hideAutoAssign();
        });
    }


    const submitChangeCase = async() => {
	if (tktCase.length > 0) {
	    if (tktCase[0]['case_id']) {
		setInvalidCase(false);
		const data= {'case': tktCase[0]['id']}
		await ticketapi.updateTicket(ticket, data).then((response) => {
		    setTicket(response);
		    setShowEditCase(false);
		    setTktCase([]);
		}).catch(err => {
		    setError(`Error assigning ticket to case: ${err.message}`);
		});
	    } else {
		setInvalidCase(true);
	    }
	} else {
	    setInvalidCase(true);
	}

    }

    const assignUser = async (evtKey, e) => {

	if (evtKey == 0) {
            setShowAutoAssign(true);
	} else {
            await ticketapi.assignTicket(ticket, evtKey).then((response) => {
		setTicket(response);
            }).catch(err => {
		setError(`Error assigning ticket: ${err.message}`);
            });
	}
    }

    const assignGroup = async(evtKey, e) => {
	await ticketapi.assignTicketTeam(ticket, evtKey).then((response) => {
            setTicket(response);
	    if (response.team) {
		setDisableUserAssignment(false);
		let u = props.assignment.users.filter(x => x.groups.includes(response.team.name));
		setUsers(u);
		console.log(u);
	    }
        }).catch(err => {
            setError(`Error assigning ticket: ${err.message}`);
        });
    }


    const removeCase = async() => {
	const data= {'case': 'remove'}
	await ticketapi.updateTicket(ticket, data).then((response) => {
            setTicket(response);
            setShowEditCase(false);
	    setTktCase([]);
        }).catch(err => {
	    setError(`Error updating ticket: ${err.message}`);
        });
    }

    useEffect(() => {
        setChange(false);
	setTickets([]);
	setTicket(null);
	setShowMessageReply(0);
	if (props.ticket) {
	    console.log(props.ticket);

	    fetchTicket();
        }
    }, [props.ticket]);


    const fetchTicketActivity = async () => {

	await ticketapi.getTicketActivity(ticket).then((response) => {
	    setActivity(response.results);
	}).catch(err => {
	    setError(`Error retrieving ticket activity: ${err.message}`);
	});
    }

    useEffect(() => {
	if (ticket) {
	    fetchTicketActivity();
	}
    }, [ticket]);

    return (
        <Modal show={props.showModal} onHide={hideThisModal} size="xl" centered backdrop="static">
	    <Modal.Header closeButton>
		<div className="d-flex align-items-center gap-3">
		    <Modal.Title>{props.ticket?.topic}</Modal.Title>
		    {ticket &&
		     <div className="mx-2 mt-1">{ticket.label != "no_label" &&
						 <Badge pill className="mx-1"  bg="primary">{ticket.label}</Badge>
						}
		     </div>
		    }
		</div>
            </Modal.Header>

	    <Modal.Body>
		{showMessageReply > 0 &&
		 <>
		     <div><a href="#" onClick={backToTicket}><i className="fas fa-chevron-left"></i> View Ticket</a></div>

		     <MessageThreadEditor
			 thread = {showMessageReply}
		     />

		 </>
		}

		{loading ?
		 <div className="text-center">
                     <div className="lds-spinner"><div></div><div></div><div></div></div>
		 </div>
		 :
		 <>
		     {ticket && props.ticket &&
		      <>
			  {error &&
			   <Alert variant="danger">{error}</Alert>
			  }
			  <Row>
			 {tickets.length > 1 &&
			  <Col lg={4}>
			      <ListGroup defaultActiveKey={`#link0`}>
				  {tickets.map((tkt, index) => (

				      <ListGroup.Item key={`{tkt-${index}`} action onClick={(e) => setCurrentTicket(tkt.id)} href={`#link${index}`}>
					  {tkt.title}
				      </ListGroup.Item>
				  ))}
			      </ListGroup>
			  </Col>
			 }
			 <Col lg={tickets.length > 1 ? `8` : `12`}>

			     <InputGroup className="align-items-center mb-2">
				 <Form.Label className="mb-0 me-2">Case:</Form.Label>
				 {showEditCase ?
				  <>
				      <CaseTypeahead
					  case = {tktCase}
					  setCase = {setTktCase}
					  disabled = {false}
					  allowNew={false}
					  invalid={invalidCase}
				      />
				      <Button variant="outline-secondary" onClick={(e)=>submitChangeCase()}><i className="fas fa-check"></i></Button>
				      <Button variant="outline-secondary" onClick={(e)=>{setTktCase([]), setShowEditCase(false), setInvalidCase(false)}}><i className="fas fa-times"></i></Button>
				  </>
				  :
				  <>
				      {ticket.case ?
				       <div>

					   <a href={`/cvdp/ticket/${ticket.id}`}><Badge pill className="mx-1" bg="secondary">{ticket.case}</Badge></a>
					   <Button variant="icon" onClick={(e)=>setShowEditCase(true)}><i className="fas fa-edit"></i></Button>
					   {ticket.assigned_to && props.user.uuid == ticket.assigned_to.uuid &&
					    <Button variant="icon" onClick={(e)=>removeCase()}><i className="fas fa-trash"></i></Button>
					   }
				       </div>
				       :
				       <>
					   <div className="d-flex align-items-center gap-2">
					       <Button variant="primary" size="sm" onClick={(e)=>setShowEditCase(true)}>Assign to Case</Button>
					       <Button variant="outline-primary" size="sm" onClick={(e)=>createCase()}>Create Case</Button>
					   </div>
				       </>
				      }
				  </>
				 }
			     </InputGroup>


			     {props.assignment?.teams?.length > 0 &&
			      <div className="d-flex justify-content-between border-bottom mb-3 pb-1">
				  <div className="d-flex align-items-center gap-3">
				      <Form.Label>Coordinator:</Form.Label>
				      <AssignmentDropdownButton
					  options = {props.assignment.teams}
					  assignUser = {assignGroup}
					  owners = {ticket.team ? [ticket.team] : []}
				      />
				  </div>
			      </div>
			     }


			     <div className="d-flex justify-content-between border-bottom mb-3 pb-1">
				 <div className="d-flex align-items-center gap-3">
				     <Form.Label>Assigned To:</Form.Label>
				     <AssignmentDropdownButton
					 options = {users}
					 assignUser = {assignUser}
					 disabled={disableUserAssignment}
					 owners = {ticket.assigned_to ? [ticket.assigned_to] : []}
				     />
				     <AutoAssignModule
					 showModal = {showAutoAssign}
					 hideModal = {hideAutoAssign}
					 confirmModal = {autoAssignUser}
					 roles = {props.roles}
				     />
				 </div>
				 <div>
				     <StatusChanger
					 status = {ticket.status}
				     />
				 </div>
			     </div>

			     <div className="d-flex justify-content-between">
				 <h5>{ticket.title}</h5>
				 <div className="d-flex align-items-center gap-2">
				     <span>{format(new Date(ticket.created), 'yyyy-MM-dd HH:mm')}</span>
				     {ticket.msg_thread &&
				      <Button variant="primary" size="sm" onClick={(e) => replyToMessage()} title="Respond to Message"><i className="fas fa-comments"></i> Respond</Button>
                                     }
				 </div>
			     </div>
			     <div className="mb-2">
				 <p><b>From:</b> {ticket.submitted_by}</p>
			     </div>
			     {ticket.sent_to &&
			     <div>

				 {Object.entries(ticket.sent_to).map(([key, value], idx) => (
				     <p key={`tikt-sent-to${idx}`}><b>{key}:</b> {value}</p>
				 ))}
			     </div>
			     }
			     {ticket.attachments &&
			      <>
			      {ticket.attachments.length > 0 &&
			       <div className="d-flex align-items-center mb-2 gap-2">
				   <i className="fas fa-paperclip"></i>
				   {ticket.attachments.map((item, index) => (
				       <DisplayFilePreview
					   file={item}
					   remove={false}
					   share={false}
				       />
				   ))}

			       </div>
			      }
			      </>
			     }
			     <div className="border-bottom mb-2 pb-5">
				 {ticket.msg_thread ?
				  <div className="chat-content"><div className="mb-0" dangerouslySetInnerHTML={{__html: sanitizeHTML(ticket.content)}} /></div>
				  :
				  <div className="mb-0">{ticket.content}</div>
				 }
			     </div>
			     <div className="my-2">
				 <p>
				    <b> Activity</b>
				 </p>
				 <Tab.Container
				     defaultActiveKey="all"
				     activeKey = {activeTab}
				     className="mb-3"
				     onSelect={setActiveTab}
				 >

					 <Nav variant="pills" className="mb-3">
					     <Nav.Item key="all">
						 <Nav.Link eventKey="all">All</Nav.Link>
					     </Nav.Item>
					     <Nav.Item key="comments">
						 <Nav.Link eventKey="comments">Comments</Nav.Link>
					     </Nav.Item>
					     <Nav.Item key="activity">
						 <Nav.Link eventKey="activity">Changes</Nav.Link>
					     </Nav.Item>
					 </Nav>
				     <Tab.Content className="p-0">
					 <Tab.Pane eventKey="all" key="all">
					     {activity.length > 0 ?
					      activity.map((item, index) => (
						  <React.Fragment key={`activity-${index}`}>
						  <TicketActivityApp
						      activity = {item}
						  />
						  </React.Fragment>
					      ))
					     :
					      <p>No activity yet</p>
					     }

					 </Tab.Pane>
					 <Tab.Pane eventKey="comments" key="comments">
					     {props.user &&
					      <Form>
						  {showCommentForm ?
						   <>
						       <div className="d-flex align-items-center gap-5">
							   <DisplayLogo
							       photo = {props.user.photo}
							       color = {props.user.logocolor}
							       name= {props.user.name}
							   />
							   <div className="pb-3 mb-3">
							   <Messenger
							       placeholder="Add a comment"
							       setValue={setComment}
							       value={comment}
							       ref={messageRef}
							       className={"commentEditor"}
							   />
							   </div>
						       </div>
						       <div className="d-flex align-items-center gap-2">
							   <Button disabled={saveDisabled} variant="primary" size="sm" onClick={(e) => (setSaveDisabled(true), addComment())}>Save</Button>
							   <Button variant="secondary" size="sm" onClick={(e)=>(clearComment(), setShowCommentForm(false), setSaveDisabled(false))}>Cancel</Button>
						       </div>
						   </>
						   :
						   <div className="d-flex align-items-center gap-2">
                                                       <DisplayLogo
                                                           photo = {props.user.photo}
                                                           color = {props.user.logocolor}
                                                           name= {props.user.name}
                                                       />
						       <Form.Control type="text" onClick={(e)=>setShowCommentForm(true)} />
						   </div>

						  }
					      </Form>
					     }
					     <div className="pt-3">
					     {activity.length > 0 ?
					      activity.map((item, index) => {
						  if (item.comment) {
						      return (
							  <React.Fragment key={`comment-${index}`}>
							      <TicketActivityApp
								  activity = {item}
							      />
							  </React.Fragment>
						      )
						  }})
                                              :
                                              <p>No comments yet</p>
                                             }
					     </div>
					 </Tab.Pane>
					 <Tab.Pane eventKey="activity" key="activity">
					     <div className="pt-3">
						 {activity.length > 0 ?
						  activity.map((item, index) => {
                                                      if (!item.comment) {
							  return (
							      <React.Fragment key={`change-${index}`}>
								  <TicketActivityApp
								      activity = {item}
								  />
							      </React.Fragment>
							  )
                                                      }})
						  :
						  <p>No comments yet</p>
						 }
                                             </div>
					 </Tab.Pane>
				     </Tab.Content>
				 </Tab.Container>
			     </div>
			 </Col>
		     </Row>

		  </>
		 }
	     </>
		}
	    </Modal.Body>

        </Modal>
    )
}

export default TicketModal;
