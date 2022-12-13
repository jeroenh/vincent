import React, { useState, useRef, useEffect, useMemo, useContext } from "react";
import {
    Nav,
    Dropdown,
    DropdownButton,
    InputGroup,
    CardGroup,
    Alert,
    Button,
    Tab,
    Tabs,
    Row,
    Form,
    Card,
    Col,
} from "react-bootstrap";
import TicketTable from './TicketTable';
import TicketAPI from './TicketAPI';
import CompContext from './CompContext';
import LoadingDiv from './LoadingDiv';
import {Link, useLocation, useSearchParams} from 'react-router';

const ticketapi = new TicketAPI();

const ticket_types = [
    { name: "All", value: "all"},
    { name: "Open", value: "open" },
    { name: "Closed", value: "closed"},
    { name: "In Progress", value: "progress"},
];


const TicketApp = (props) => {

    const {user, setUser, loading} = useContext(CompContext);
    const location = useLocation();
    let [searchParams, setSearchParams] = useSearchParams();
    const [nextUrl, setNextUrl] = useState("");
    const [ticketUsers, setTicketUsers] = useState([]);
    const [ticketType, setTicketType] = useState("");
    const [ticketTeam, setTicketTeam] = useState("");
    const [ticketUser, setTicketUser] = useState("");
    const [ticketUrlStr, setTicketUrlStr] = useState("");
    const [searchVal, setSearchVal] = useState("");

    const fetchTickets = (nextUrl) => {
	console.log(nextUrl);
	console.log(ticketUrlStr);
	if (nextUrl) {
            return ticketapi.getTickets(nextUrl);
        } else {
	    if (ticketTeam == "Unassigned" || ticketUser=="Unassigned") {
		if (ticketType) {
		    return ticketapi.getUnassignedStatus(ticketType);
		}
		return ticketapi.getUnassigned();
	    }
            return ticketapi.getMyTickets(`?${ticketUrlStr}`);
        }
    }

    const onSearch = (e, field) => {
	console.log(e);
        if (field == "state") {
            setTicketType(e.target.value);
        } else if (field == "team") {
            setTicketTeam(e.target.value);
	} else if (field == "user") {
	    setTicketUser(e.target.value);
	} else {
	    setSearchVal(e.target.value);
        }
    }


    const initParams = (params) =>
          params.reduce((acc, curr) => {
              const arr = curr.values.map((x) => [curr.name, x]);
              return acc.concat(arr);
          }, []);
    
    const compileUrlStr = () => {

	let urlstr = "";
	const params = [];
	
	if (searchVal) {
	    let sv = encodeURIComponent(searchVal);
	    params.push({'name': 'search', values: [sv]});

	}

	if (ticketTeam) {
	    params.push({name: 'team', values: [ticketTeam]});
	}

	if (ticketType) {
	    params.push({name: 'status', values: [ticketType]});
	}

	if (ticketUser) {
	    params.push({name: 'user', values:[ticketUser]})
	}

	const test = initParams(params);
        const sps = new URLSearchParams(initParams(params));
	setSearchParams(sps);
	setTicketUrlStr(sps.toString());
    }


    const fetchInitialSearchParams = () => {
	if (searchParams.get('team')) {
	    setTicketTeam(searchParams.get('team'))
	}
	if (searchParams.get('status')) {
	    setTicketType(searchParams.get('status'))
	} else {
	    setTicketType("open");
	}
	if (searchParams.get('search')) {
	    let sv = decodeURIComponent(searchParams.get('search'));
	    setSearchVal(sv);
	}
	if (searchParams.get('user')) {
	    setTicketUser(searchParams.get('user'));
	}
    }

    
    useEffect(() => {

	compileUrlStr();
	
    }, [searchVal, ticketTeam, ticketType, ticketUser]);
    

    useEffect(() => {
        /* when search params/URL changes, adjust view accordingly */
        fetchInitialSearchParams();
    }, [searchParams]);
    
    const TicketStatus = () => {
        const stat = ticket_types.find(item => item.value == ticketType);
	console.log(stat);
	if (ticketType && stat) {
            return (
		<b>State: {stat?.name}</b>
            )
	}
	return (<b>State</b>);
    }

    const TeamAssigned = () => {
	const stat = ticketUsers.teams.find(item => item.uuid == ticketTeam);
	if (ticketTeam && stat) {
            return (
		<b>Team: {stat?.name || "Unassigned"}</b>
            )
	} 
	return (<b>Team</b>)

    }

    const UserAssigned = () => {
	const stat = ticketUsers.users.find(item => item.uuid == ticketUser);
	if (ticketTeam && stat) {
            return (
		<b>User: {stat?.name || "Unassigned"}</b>
            )
	} 
	return (<b>User</b>)

    }
    
	
    
    const fetchTicketAssignments = async() => {
        await ticketapi.getUserAssignments().then((response) => {
            setTicketUsers(response);
        }).catch(err => {
            console.log(err);
            setError(`Error retrieving ticket assignments: ${err.message}`);
        });
    }

    useEffect(() => {
	if (user && user.roles.includes('coordinator')) {
	    fetchTicketAssignments();
	}
    }, [user]);

    return (
	loading ?
	    <LoadingDiv />

	    :

	<div className="ticket-app">
	    <Row>
		<Col lg={12}>
		    <div className="d-flex justify-content-between align-items-center">
			<h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Tickets /</span> {user.name}</h4>
		    </div>
		</Col>
	    </Row>
	    <Row>
		<Col lg={12}>
		    <Card>
			<Card.Header as="h5" className="pb-1 mb-2 d-flex align-items-center">

			    <InputGroup>
                                <Form.Control
                                    placeholder="Search"
                                    aria-label="Search Ticketss"
				    value={searchVal}
                                    onChange={(e)=>onSearch(e, "cve")}
                                />
				{ticketUsers.lead && ticketUsers?.teams?.length > 0 &&
				<DropdownButton
                                    variant="outline-secondary"
                                    title={<TeamAssigned />}
                                    id="input-group-dropdown-3"
                                >
                                    <Form.Label className="px-3">Coordinator</Form.Label>
				    <Dropdown.ItemText key={"unassigned"}>
					<Form.Check
                                            onChange={(e)=>onSearch(e, "team")}
                                            label={"Unassigned"}
                                            value={"Unassigned"}
                                            title={"Unassigned"}
                                            checked={ticketTeam === "Unassigned"}
                                            type="checkbox"
                                        />
				    </Dropdown.ItemText>
                                    {ticketUsers.teams?.map((o, index) => {
                                        return (
                                            <Dropdown.ItemText key={index}>
                                                <Form.Check
                                                    onChange={(e)=>onSearch(e, "team")}
                                                    label={o.name}
                                                    value={o.uuid}
                                                    title={o.name}
                                                    checked={ticketTeam === o.uuid}
                                                    type="checkbox"
                                                />
                                            </Dropdown.ItemText>
                                        )
                                    })}
                                </DropdownButton>
				}
				{!ticketUsers.lead && ticketUsers?.users?.length > 0 &&
				 <DropdownButton
				     variant="outline-secondary"
                                     title={<UserAssigned />}
                                     id="input-group-dropdown-3"
                                >
                                    <Form.Label className="px-3">Coordinator</Form.Label>
				    <Dropdown.ItemText key={"unassigned"}>
					<Form.Check
                                            onChange={(e)=>onSearch(e, "user")}
                                            label={"Unassigned"}
                                            value={"Unassigned"}
                                            title={"Unassigned"}
                                            checked={ticketUser === "Unassigned"}
                                            type="checkbox"
                                        />
				    </Dropdown.ItemText>
                                    {ticketUsers.users?.map((o, index) => {
                                        return (
                                            <Dropdown.ItemText key={index}>
                                                <Form.Check
                                                    onChange={(e)=>onSearch(e, "user")}
                                                    label={o.name}
                                                    value={o.uuid}
                                                    title={o.name}
                                                    checked={ticketUser === o.uuid}
                                                    type="checkbox"
                                                />
                                            </Dropdown.ItemText>
                                        )
                                    })}
                                </DropdownButton>
				}

				
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
			    <div className="scrollable">				
				<TicketTable
				    fetch={fetchTickets}
				    tableState={{hiddenColumns:[]}}
				    user = {user}
				    reload={ticketUrlStr}
				    team={ticketTeam}
				    assignment={ticketUsers}
				    roles = {ticketUsers.roles}
				/>
			    </div>
			</Card.Body>
		    </Card>
		</Col>
	    </Row>
	</div>
    )


}


export default TicketApp;
