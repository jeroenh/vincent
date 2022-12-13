import React, { useState, useEffect, useMemo } from 'react';
import CaseThreadAPI from './ThreadAPI';
import AdminAPI from './AdminAPI';
import { format, formatDistance } from 'date-fns';
import {Link, useLocation, useSearchParams} from 'react-router';
import {Row, DropdownButton, Dropdown, Alert, ButtonGroup, ToggleButton, Button, Card, Col} from 'react-bootstrap';
import Searchbar from './Searchbar.js';
import TicketTable from './TicketTable.js'
import TicketAPI from 'Components/TicketAPI';
import DisplayLogo from './DisplayLogo';
const caseapi = new CaseThreadAPI();
const adminapi = new AdminAPI();

import CaseList from './CaseList.js';
const ticketapi = new TicketAPI();

const TriageList = () => {

    const location = useLocation();
    let [searchParams, setSearchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [teams, setTeams] = useState(null);
    const [triageTeam, setTriageTeam] = useState(searchParams.get('team', null));
    const [cases, setCases] = useState([]);
    const [showTickets, setShowTickets] = useState(false);
    const [ticketUsers, setTicketUsers] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [keyword, setKeyword] = useState("");
    const [bounces, setBounces] = useState([]);
    const [itemsCount, setItemsCount] = useState(0);
    const [error, setError] = useState(null);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [newUsers, setNewUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [ticketType, setTicketType] = useState(searchParams.get('type') || "cases");
    const [user, setUser] = useState(null);
    const [states, setStates] = useState([]);
    
    const radios = [
	{ name: "Cases", value: "cases" },
        { name: "Tickets", value: "tickets" },
    ];

    // Searchbar functionality
    const onSearchbarChange = e => {
        const value = e.target.value
	setKeyword(value);
        filterData(value);
    }


    useEffect(()=> {
	console.log("currentPage in use", currentPage);
	paginationHandler(currentPage);
    }, [currentPage])


    const paginationHandler = (page) => {
	if (keyword || triageTeam) {
	    filterData(keyword, triageTeam, page);
	} else {
            caseapi.getUnassignedCasesByPage(page).then((response) => {
		setCases(response.results);
		setItemsCount(response.count);
            })
	}
    }

    const fetchTickets = (nextUrl) => {

	if (nextUrl) {
	    return ticketapi.getUnassigned(nextUrl);
	} else if (triageTeam) {
	    return ticketapi.getUnassigned(null, triageTeam);
	} else {
	    return ticketapi.getUnassigned();
	}
    }

    const filterData = (value, team=null, page=1) => {
        let urlstr = "";
        if (value) {
	    value = encodeURIComponent(value);
            urlstr = `search=${value}`
        }
	if (team) {
	    if (urlstr) {
		urlstr=`${urlstr}&team=${team}`;
	    } else {
		urlstr=`team=${team}`;
	    }
	}
	urlstr = `${urlstr}&page=${page}`;
	setCurrentPage(page);
	
	caseapi.getUnassignedCases(urlstr).then((response) => {
	    setCases(response.results);
	    setIsLoading(false);
	    setItemsCount(response.count);
	});
    }

    const getPendingUsers = async () => {
	try {
	    await adminapi.getPendingUsers().then((response) => {
		setPendingUsers(response)
	    });
	    await adminapi.getNewUsers().then((response) => {
		setNewUsers(response)
	    });

	} catch (err) {
	    setError(err.response.data.message);
	    console.log('Error:', err);
	}
    }


    const getRecentBounces = async() => {

	await adminapi.getRecentBounces().then((response) => {
	    setBounces(response.results);
	}).catch(err => {
	    console.log(err);
	});
	    
    }
    
    const fetchCaseStates = async() => {

        await caseapi.getCaseStates().then((response) => {
            setStates(response);
        }).catch(err => {
            console.log(err);
	});

    }

    
    // Async Fetch
    const fetchInitialData = async () => {
        console.log("fetching data");

	await caseapi.getTriageMeta().then((response) => {
	    setTeams(response);
	}).catch(err => {
	    console.log(err);
	});

	if (triageTeam) {
	    getTriageTeamCases(triageTeam);
	    fetchTicketData();
	} else {
	
	    await caseapi.getUnassignedCases().then((response) => {
		setItemsCount(response.count);
		setCases(response.results);
		setIsLoading(false);
	    
            }).catch(err => {
		console.log('Error:', err);
		setError(err.response.data.message);
	    });

	    fetchTicketData();
	    
	}

	await ticketapi.getUser().then((response) => {
	    setUser(response);
	}).catch(err => {
	    setError("Unknown error");
	});

	fetchCaseStates();
	
    }

    const fetchTicketData = async () => {
    
	await ticketapi.getUserAssignments().then((response) => {
            setTicketUsers(response);
        }).catch(err => {
            setError(err);
        });

    }

    useEffect(() => {
	if (searchParams.get('team')) {
	    if (teams && teams.teams.some(x => x.name == searchParams.get('team'))) {
		setTriageTeam(searchParams.get('team'));
		console.log("setting triage team");
		filterData(keyword, searchParams.get('team'));
	    }
	}
    }, [searchParams]);
    

    const getTriageTeamCases = async (team) => {
	setIsLoading(true);
	if (teams && teams.teams.some(y => y.name == team)) {
	    setTriageTeam(team);
	    window.history.pushState({}, '', `?team=${team}&type=${ticketType}`);
	    filterData(keyword, team);
	} else {
	    paginationHandler(1);
	}
    }


    
    
    const approveUser = async (user) => {
	console.log("approving user", user);
	await adminapi.approvePendingUser(user).then((response) => {
	    getPendingUsers();
	}).catch(err => {
	    console.log(err);
	    setError(err.repsonse.data.message);
	});
    }


    const setTicketTypeNow = (props) => {
	if (triageTeam) {
	    window.history.pushState({}, '', `?team=${triageTeam}&type=${props}`);
	} else {
            window.history.pushState({}, '', `?type=${props}`);
	}
        setTicketType(props);
    }

    function switchTeams(evt, evtKey) {
	console.log(evtKey);
	if (evt === "Unassigned"){
	    setTriageTeam(null);
	    window.history.pushState({}, '', `?type=${ticketType}`);
	    filterData();
	} else {
    	    getTriageTeamCases(evt);
	}
    }
    
    
    useEffect(() => {

	fetchInitialData();
	getPendingUsers();
	getRecentBounces();
	
    }, []);

    return (
	<>
	    <div className="d-flex justify-content-between align-items-center">
		
		<h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Triage / {triageTeam && `${triageTeam} /`}</span> Unassigned</h4>

		<div className="d-flex align-items-center gap-2">
		    <Button variant="secondary" as={Link}  to={"calendar"} state={{team: triageTeam}}>
			<i className="fas fa-calendar"></i>{" "}Calendar 
		    </Button>
		{teams && teams.teams.length > 1 &&
		 <DropdownButton
		     variant="primary"
		     onSelect={switchTeams}
		     title={
			 <span>
			    Teams{" "}
			     <i className="fas fa-chevron-down"></i>
			 </span>
		     }
		 >
		     <Dropdown.Item
			 key="Unassigned"
			 eventKey="Unassigned"
		     >
			 Unassigned
		     </Dropdown.Item>
		     {teams.teams.map(y => (
			 <Dropdown.Item
			     key={y.name}
			     eventKey={y.name}
			 >
			     {y.name}
			 </Dropdown.Item>
		     ))}
		     
		 </DropdownButton>
		}
		</div>
	    </div>
	    {error &&
	     <Alert variant="danger"> {error}</Alert>
	    }
	    <Row>
		<Col lg={8}>
		    <Card>
			<Card.Header as="h5">
                            <div className="d-flex align-items-start justify-content-between mt-2 gap-5 mb-2">
				<Searchbar value={keyword} onChange={onSearchbarChange} />
                            </div>
			    <div className="d-flex align-items-center justify-content-between">
			    <ButtonGroup>
				{radios.map((radio, idx) => (
				    <ToggleButton
					key={idx}
					id={`radio-${idx}`}
					type="radio"
					variant={idx ? 'outline-primary' : 'outline-secondary'}
					name="triage_type"
					value={radio.value}
					checked={ticketType === radio.value}
					onChange={(e) => setTicketTypeNow(e.currentTarget.value)}
				    >
					{radio.name}
				    </ToggleButton>
				    
				))}
			    </ButtonGroup>
				<span className="text-end fw-light fs-tiny me-2"><i>{itemsCount} cases</i></span>
			    </div>
				    
			</Card.Header>
			<Card.Body>

			    { isLoading ?
                              <div className="text-center">
				  <div className="lds-spinner"><div></div><div></div><div></div></div>
                              </div>
			      :
			      <>
				  {ticketType == "cases" ?
				   <CaseList
				       cases={cases}
				       count={itemsCount}
				       onSearchBarChange={onSearchbarChange}
				       page={currentPage}
				       setCurrentPage={setCurrentPage}
				       emptymessage="You have no unassigned cases"
				       crumbs={["Triage", "Unassigned Cases"]}
				       crumb_link="/cvdp/triage/"
				       user={user}
				       states={states}
				   />
				   :
				   <TicketTable
				       fetch={fetchTickets}
				       tableState={{hiddenColumns:['assignee', 'case']}}
				       user = {user}
				       assignment={ticketUsers}
				       roles={ticketUsers.roles}
				       team={triageTeam}
				   />
				  }
			      </>
			    }
		    </Card.Body>
                </Card>
            </Col>
	    <Col lg={4}>
		<Card className="mb-3">
		    <Card.Header as="h5">
			<Card.Title>Pending Users</Card.Title>
		    </Card.Header>
		    <Card.Body className="border-bottom">
			{pendingUsers.length > 0 ?
			 <>
			     {pendingUsers.map((user, index) => {
				 return (
				     <div className="d-flex justify-content-between mt-2 mb-2" key={`user-${index}`}>

					 <a href={`/cvdp/contact/${user.uuid}/`}>
					 <div className="d-flex align-items-center gap-2">
    					     <DisplayLogo
						 name={user.name}
						 color={user.logocolor}
						 photo={user.photo}
					     />
					     <span className="participant">
						 {user.name}
					     </span>
					 </div>
					 </a>
					 <Button variant="outline-primary" onClick={(e)=>approveUser(user)}>
					     Approve
					 </Button>
				     </div>
				 )
			     })}
			 </>
			 :
			 <b>No Pending Users</b>
			}
		    </Card.Body>
		    <Card.Header as="h5">
                        <Card.Title>New Users</Card.Title>
                    </Card.Header>
                    <Card.Body>
			{newUsers.length > 0 ?
                         <>
                             {newUsers.map((user) => {
                                 return (
				     <a href={`/cvdp/contact/${user.uuid}/`}>
					 <div className="d-flex align-items-center gap-2 mb-3">
                                             <DisplayLogo
						 name={user.name}
						 color={user.logocolor}
						 photo={user.photo}
                                             />
                                             <span className="participant">
						 {user.name ?
						  <>{user.name}</>
						  :
						  <>{user.email}</>
						 }
                                             </span>
					 </div>
				     </a>
                                 )
                             })}
                         </>
                         :
                         <b>No New Users</b>
                        }
		    </Card.Body>
		</Card>
		<Card>
		    <Card.Header className="d-flex justify-content-between">
			<Card.Title as="h5">Email Bounces</Card.Title>
			<div><a href="/cvdp/manage/bounces/">View All</a></div>
		    </Card.Header>
		    <Card.Body>
			{bounces.length > 0 &&
			<ul className="list-unstyled mb-2">
			    {bounces.map((b, idx) => (
				<li className="p-2 border-bottom" key={`bounce-${idx}`}>
				    <div><b>{b.email}:</b> {b.subject}</div>
				    <small>Bounced on {format(new Date(b.bounce_date), "Y-M-d")}</small>
				</li>
			    ))}
			</ul>
			}
			{bounces.length == 0 &&
			 <div><i>No recent bounces</i></div>
			}
		    </Card.Body>
		</Card>
	    </Col>

            </Row>
	</>
    )
}

export default TriageList;
