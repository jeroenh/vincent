import React, { useState, useEffect, useRef } from "react";
import {Container, Button, InputGroup, Form, DropdownButton, Row, Col, Dropdown, Alert, ListGroup, Card } from "react-bootstrap";
import {Link} from "react-router";
import CaseThreadAPI from "./ThreadAPI";
import DisplayLogo from "./DisplayLogo";
import CaseList from "./CaseList.js";
import Searchbar from "./Searchbar.js";
import ActivityApp from "./ActivityApp.js";
import InfiniteScroll from "react-infinite-scroll-component";
import {useLocation} from 'react-router';
import TicketTable from './TicketTable.js'
import TicketAPI from './TicketAPI';

const ticketapi = new TicketAPI();

import "../css/casethread.css";

const caseapi = new CaseThreadAPI();

const DashboardList = () => {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const [isLoading, setIsLoading] = useState(true);
    const [requested, setRequested] = useState([]);
    const [user, setUser] = useState(null);
    const [states, setStates] = useState([]);
    const [ticketUsers, setTicketUsers] = useState([]);
    const [activityLoading, setActivityLoading] = useState(true);
    const [cases, setCases] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsCount, setItemsCount] = useState(0);
    const [error, setError] = useState(null);
    const [activity, setActivity] = useState([]);
    const [activityHasMore, setActivityHasMore] = useState(false);
    const [activityNext, setActivityNext] = useState(null);
    const [ticketType, setTicketType] = useState(searchParams.get('status') || "all");
    const [columnHeight, setColumnHeight] = useState("800");
    const [ticketUrlStr, setTicketUrlStr] = useState(searchParams.get('status') ? `?status=${searchParams.get('status')}` : `?status=all`);
    const [searchVal, setSearchVal] = useState("");
    const [col1Height, setCol1Height] = useState(0);
    const [fetchingActivity, setFetchingActivity] = useState(false);
    const col2 = useRef(null);
    const col1 = useRef(null);

    const ticket_types = [
	{ name: "All", value: "all"},
        { name: "Unread", value: "unread" },
        { name: "Open", value: "open" },
	{ name: "Closed", value: "closed"},
	{ name: "In Progress", value: "progress"},
    ];

    // Searchbar functionality›
    const onSearchbarChange = (e) => {
        const value = e.target.value;
	setSearchVal(value);
	filterData(value);
    };

    /*the following is a whole bunch of code to make infinite scrolling sane
      and it all depends on who the user is/how much data is being returned
      and how many cards are shown */

    function resetHeights() {

	if (user && user.roles.includes('coordinator')) {
	    setColumnHeight(col1Height);
	} else {
	    setColumnHeight(col1Height-75);
	}
    }
    useEffect(() => {

	resetHeights();

    }, [col1Height])

    useEffect(() => {
	const colHeight = () => {
	    /*initially use column height but then use window innerheight because
	      colheight seems to go off the rails on resize*/
	    if (col1.current) {
		if (col1.current.clientHeight < (window.innerHeight +300)) {
		    setCol1Height(col1.current.clientHeight);
		} else {
		    setCol1Height(window.innerHeight);
		}
		//console.log(`setting col1height to ${col1.current.clientHeight}`);
	    }
	};
	colHeight();

	window.addEventListener(
	    "resize",
	    colHeight
	);

	return () => {
	    window.removeEventListener(
                "resize",
                colHeight
            );
        };
    }, [cases]);



    useEffect(() => {
        paginationHandler(currentPage);
    }, [currentPage]);

    const paginationHandler = (page) => {
        caseapi
            .getMyCasesByPage(page)
            .then((response) => {
                setCases(response.results);
                setItemsCount(response.count);
                setIsLoading(false);
            })
            .catch((err) => {
                //console.log(err.response);
                setError(`Error is ${err.response}`);
                setIsLoading(false);
            });
    };

    const filterData = (value) => {
        setIsLoading(true);
        let urlstr = "";
        if (value) {
            value = encodeURIComponent(value);
            urlstr = `search=${value}`;
        }
        caseapi.getMyCases(urlstr).then((response) => {
            setCases(response.results);
            setItemsCount(response.count);
            setIsLoading(false);
        });
    };


    const fetchCaseStates = async() => {

	await caseapi.getCaseStates().then((response) => {
	    setStates(response);
	}).catch(err => {
	    console.log(err);
	});

    }


    useEffect(() => {
	if (user && user.roles.includes('coordinator')) {
	    resetHeights();
	    fetchCaseStates();
	    fetchTicketAssignments();
	}
    }, [user]);


    const fetchTicketAssignments = async() => {
	await ticketapi.getUserAssignments().then((response) => {
	    setTicketUsers(response);
        }).catch(err => {
	    console.log(err);
	    setError(`Error retrieving ticket assignments: ${err.message}`);
        });
    }

    // Async Fetch
    const fetchInitialData = async () => {

	await caseapi.getUser().then((response) => {
	    setUser(response);
	});

        await caseapi
            .getMyActivity()
            .then((response) => {
                let data = response;
                setActivity(data.results);
                setActivityNext(data.next);
                if (data.next) {
                    setActivityHasMore(true);
                }
                setActivityLoading(false);
            })
            .catch((err) => {
		console.log(err);
                setError(`Error is ${err.response.data.message}`);
                setActivityLoading(false);
            });
    };

    const fetchMoreActivity = async (page) => {
	setFetchingActivity(true);

        await caseapi.getMyActivity(activityNext).then((response) => {
	    setActivity(activity.concat(response.results));
	    setActivityNext(response.next);
	    if (response.next) {
                setActivityHasMore(true);
	    } else {
                setActivityHasMore(false);
	    }
	    setFetchingActivity(false);
	}).catch(err => {
	    console.log(err);
	    setError("Error fetching more activity");
        })
    };

    useEffect(() => {
        fetchInitialData();
    }, []);


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


    const requestToJoin = async (g) => {
	let oldreq = requested;
	setRequested([...requested, g]);
	await caseapi.userAssociationRequest({'group': g}).then((response) => {

	}).catch(err => {
	    setRequested(requested);
	    setError("There was an error requesting addition to the group.");
	    console.log(err);
	});

    }


    const fetchTickets = (nextUrl) => {

        if (nextUrl) {
            return ticketapi.getTickets(nextUrl);
        } else {
            return ticketapi.getMyTickets(ticketUrlStr);
        }
    }

    const goToCase = (url) => {
        window.location.href = url;
    };

    return (
        <>
	    {error && <Alert variant="danger">{error}</Alert>}
	    {user && (user.welcome?.suggestions.length > 0 ||
		      user.welcome?.new_posts > 0 ||
		      user.welcome?.new_cases > 0 ||
		      user.welcome?.pending.length > 0) &&
	     <Card className="mb-3">
		 <Card.Header as="h5" className="pb-0">
		     <Card.Title>
			 Welcome to VINCE-NT!
		     </Card.Title>
		 </Card.Header>
		 <Card.Body>
		     {user.welcome.suggestions.length > 0 &&
		      <div className="mb-3">
			  <div className="mb-2">We have identified {user.welcome.suggestions.length > 1 ? `some potential groups` : `a potential association` } for you based on your email address!</div>
			  {user.welcome.suggestions.map((x, idx) => (
			      <div className="d-flex align-items-center gap-2 mb-2" key={`assoc-${idx}`}>
				  <DisplayLogo
				      name={x.name}
				      photo={x.logo}
				      color={x.logocolor}
				  />
				  <span className="participant">
				      {x.name}
				  </span>

				  <Button variant={requested.includes(x.uuid) ? `success` : `outline-primary`} size="sm" disabled={requested.includes(x.uuid)} onClick={(e)=>requestToJoin(x.uuid)}>{requested.includes(x.uuid) ? 'Request Sent!' : 'Request to join'}</Button>
			      </div>
			  ))}

		      </div>
		     }
		     {user.welcome.pending.length > 0 &&
		      <div className="mb-1">
			  <div className="mb-2">Your affiliation with the following {user.welcome.pending.length > 1 ? `groups` : `group` } is pending:</div>
			  {user.welcome.pending.map((x, idx) => (
			      <div className="d-flex align-items-center gap-2 mb-2" key={`pending-${idx}`}>
				  <DisplayLogo
				      name={x.name}
				      photo={x.logo}
				      color={x.logocolor}
				  />
				  <span className="participant">
				      {x.name}
				  </span>
			      </div>
			  ))}
		      </div>
		     }

		     {user.welcome?.new_cases?.length > 0 || user.welcome?.unseen_cases?.length > 0 || user.welcome?.new_posts?.length > 0 &&
		     <div className="welcome-stats">
			 {user.welcome?.new_cases?.length > 0 &&
			  <span className="lead">You have <b>{ user.welcome.new_cases.length }</b> new {user.welcome.new_cases.length > 1 ? `cases` : `case`}</span>
			 }
			 {user.welcome?.new_posts > 0 &&
			  <span className="lead"> {user.welcome?.new_cases?.length > 0 ? `and ` : `You have `}{user.welcome?.new_posts} unread {user.welcome.new_posts > 1 ? `posts` : `post`}</span>
			 }
			 . There is new activity in the following case{user.welcome.unseen_cases.length > 1 && `s` }:<br/>
			 {user.welcome.unseen_cases.map((c, idx) => (
			     <React.Fragment key={`lk-${idx}`}>
				 <Link className="fw-bold" to={`/cvdp/cases/${c.case_id}`}>{ c.title }</Link><br/>
			     </React.Fragment>
			 ))}
		     </div>
		     }
		 </Card.Body>
	     </Card>
	    }

	    <Row>
		<Col lg={user && user.roles.includes('coordinator') ? '6' : '8'} className="mb-2">
		    <Card ref={col1} className="h-100 overflow-auto">
			<Card.Header>
			    <div className="d-flex align-items-start justify-content-between mt-2 gap-5">
				<Searchbar
				    onChange={onSearchbarChange}
				    value={searchVal}
				    placeholder="Filter My Active/Pending Cases"
				/>
			    </div>
			    {isLoading ? ""
			     :
			     <div className="text-muted mt-2">{itemsCount} Cases</div>
			    }
			</Card.Header>
			<Card.Body>
			    {isLoading ? (
				<div className="text-center">
                                    <div className="lds-spinner">
					<div></div>
					<div></div>
					<div></div>
                                    </div>
				</div>
				) : (
				    <CaseList
					cases={cases}
					count={itemsCount}
					page={currentPage}
					setCurrentPage={setCurrentPage}
					emptymessage="You have no active cases"
					crumbs={["Dashboard", "My Cases"]}
					crumb_link="/cvdp/dashboard"
					user={user}
					states={states}
				    />
				)}
			</Card.Body>
		    </Card>
		</Col>
		<Col lg={user && user.roles.includes('coordinator') ? '6' : '4'}>
		    <>
			{user && user.roles.includes('coordinator') &&
			 <Card className="mb-2 card-max-height-500">
			     <Card.Header as="h5" className="pb-1 d-flex justify-content-between align-items-center gap-5">
				 <Card.Title className="text-nowrap"><Link to={"/cvdp/tickets"}>My Tickets</Link></Card.Title>
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
			     <div className="scrollable" style={{height: columnHeight}}>
				 <TicketTable
				     fetch={fetchTickets}
				     tableState={{hiddenColumns:['assignee', 'label', 'team']}}
				     user = {user}
				     reload={ticketUrlStr}
				     assignment={ticketUsers}
				     roles = {ticketUsers.roles}
				 />
			     </div>

			 </Card>
			}

			<Card className="mt-2 card-max-height-500">
			    <Card.Header as="h5" className="pb-1">
				<Card.Title>Recent Activity</Card.Title>
			    </Card.Header>
			    <Card.Body className="p-2" id="infiniteDiv" style={{ height: columnHeight, overflow: 'auto', overflowY: 'scroll'}}>
				{activityLoading ? (
				    <div className="text-center">
					<div className="lds-spinner">
					    <div></div>
					    <div></div>
					    <div></div>
					</div>
				    </div>
				) : (
				    <>
					<ListGroup variant="flush">
					    {activity.map((a, index) => {
						return (
						    <ListGroup.Item
							action
							onClick={(e) =>
							    goToCase(a.url)
							}
							className="p-2 border-bottom"
							key={`activity-${index}`}
						    >
							<ActivityApp activity={a} />
						    </ListGroup.Item>
						);
					    })}
					</ListGroup>
					{activityHasMore && !fetchingActivity &&
					 <div className="text-center">
					     <Button className="mb-3" variant="outline-secondary" onClick={(e)=>fetchMoreActivity()}>Load More</Button>
					 </div>
					}
					{fetchingActivity &&
					 <div className="text-center">
					     <div className="lds-spinner"><div></div><div></div><div></div></div>
					 </div>
					}
				    </>
				)}
			    </Card.Body>
			</Card>
		    </>
		</Col>
	    </Row>
            </>
    );
};

export default DashboardList;
