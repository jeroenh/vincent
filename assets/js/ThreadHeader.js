import React, { useState, useEffect } from 'react'
import {Card, Badge, Dropdown, Row, Col, OverlayTrigger, Tooltip} from 'react-bootstrap';
import {useParams, useNavigate, Link, useLocation} from "react-router"
import CaseThreadAPI from './ThreadAPI';
import ParticipantModal from './ParticipantModal.js';
import {useModalManager} from "./hooks/useModalManager";

const threadapi = new CaseThreadAPI();

const ThreadHeader = (props) => {

    const [thread, setThread] = useState(props.thread);
    const { openModal, closeModal, currentModal } = useModalManager();
    const [user, setUser] = useState(props.user);
    const [participants, setParticipants] = useState(props.participants);


    useEffect(() => {

	if (props) {
	    setUser(props.user);
	    setThread(props.thread);
	    setParticipants(props.participants);
	}
	console.log(props.caseInfo);

    }, [props]);


    return (
	<Card className="mb-3">
	    <Card.Body className="p-2">
		<Row>
		    <Col lg={10}>
			<div className="d-flex align-items-center gap-2 fw-bold">
			    {/*<i className="far fa-star"></i>*/}
			    <b>DM Thread:</b>
			    <span className="text-truncate">{participants.map(p => p.participant.name).join(', ')}</span>
			    <Dropdown className="mx-1">
				<Dropdown.Toggle className="p-0">
				    <Badge bg="primary"><i className="fas fa-user me-2"></i>{participants.length}</Badge>
				    <span className="visually-hidden">Participants in Thread</span>
				</Dropdown.Toggle>
				<Dropdown.Menu>
				    {user.role === "owner" &&
				     <Dropdown.Item onClick={()=>openModal("addParticipant")}><i className="fas fa-user-plus" title="Add user to thread"></i> Add</Dropdown.Item>
					}
				    {participants.map((p, idx) => (
					<Dropdown.Item key={`p-${idx}`}>{p.participant.name}</Dropdown.Item>
				    ))}
				</Dropdown.Menu>
			    </Dropdown>
			</div>
			<div>
			    {thread.subject}
			</div>
		    </Col>
		    <Col lg={2} className="text-end">
			<h5 className="mb-0">
			<OverlayTrigger
                            placement="left"
                            overlay={
                                <Tooltip>
				    Who can see this DM thread?<br/>
				    Only participants listed can view and interact with
				    this case thread. If you believe a user/group should be present,
				    ask a coordinator to add them.
                                </Tooltip>
                            }
                        >
                        <i className="fas fa-info-circle"></i></OverlayTrigger>
			</h5>
		    </Col>
		</Row>
		{currentModal === "addParticipant" && user.role === "owner" &&
		     <ParticipantModal
			 showModal = {true}
			 hideModal = {()=>closeModal()}
			 thread={thread.id}
			 caseid={props.caseInfo.case_id}
			 allowSelectRole={false}
			 confirmInvite = {()=>props.update()}
			 title={"Invite Participants to Thread"}
			 currentParticipants = {participants}
			 caseInfo = {props.caseInfo}
                     />
		}
	    </Card.Body>
	</Card>
    )

}

export default ThreadHeader;
