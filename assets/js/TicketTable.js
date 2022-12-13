import React, { useCallback, useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Alert, Badge, Dropdown, Card, Row, Col, DropdownButton, InputGroup, Form, Button } from "react-bootstrap";
import TicketAPI from 'Components/TicketAPI';
import {format} from 'date-fns';
import ClickCellTable from "Components/ClickCellTable";
import DisplayStatus from "Components/DisplayStatus";
import TicketModal from "Components/TicketModal";
import 'Styles/casethread.css';
import DisplayLogo from "./DisplayLogo";

const ticketapi = new TicketAPI();

const TicketTable = (props) => {

    const { id } = useParams();
    const navigate = useNavigate();
    const [tableState, setTableState] = useState(null);
    const [error, setError] = useState(null);
    const [reload, setReload] = useState(false);
    const [data, setData] = useState([]);
    const [skipInitial, setSkipInitial] = useState(true);
    const [response, setResponse] = useState(null);
    const [sort, setSort] = useState({direction: 'none', accessor: 'none'});
    const [controller, setController] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [ticket, setTicket] = useState(null);
    const [viewTicketModal, setViewTicketModal] = useState(false);

    const columns = useMemo(
        () => [
            {
                Header: 'From',
                accessor: 'last_email.submitted_by',
                minWidth: 150,
		onClick: (props) => {clickRow(props)},
		Cell: (props) => {
		    return (
			<div onClick={()=>props.column.onClick(props.row)}>{props.cell.value}</div>
		    )
		},
            },
            {
                Header: 'Title',
                accessor: 'topic',
                maxWidth: 500,
		onClick: (props) => {clickRow(props)},
		Cell: (props) => {
		    if (props.row.original.last_email.attachments.length > 0) {
			return (
			    <div onClick={()=>props.column.onClick(props.row)}>{props.cell.value} <i className="fas fa-paperclip"></i></div>
			)
		    } else {
			return (
			    <div onClick={()=>props.column.onClick(props.row)}>{props.cell.value}</div>
			)
		    }
		},
            },
	    {
		Header: 'Status',
		accessor: d => d.last_email.status && <DisplayStatus status={d.last_email.status} />,
		id:"status",
		onClick: (props) => {clickRow(props)},
		Cell: (props) => {
		    return (
			<div onClick={()=>props.column.onClick(props.row)}>{props.cell.value}</div>
		    )
		}
	    },
            {
                Header: 'Modified',
		accessor: d => d.last_email.modified && format(new Date(d.last_email.modified), 'yyyy-MM-dd HH:mm'),
		id: 'modified',
		onClick: (props) => {clickRow(props)},
                Cell: (props) => {
                    return (
                        <div onClick={()=>props.column.onClick(props.row)}>{props.cell.value}</div>
                    )
                },

            },
	    {
		Header: 'Case',
		accessor: d => d.last_email.case && <Badge pill bg="secondary">{d.last_email.case}</Badge>,
		id: 'case',
		onClick: (props) => {clickRow(props)},
		Cell: (props) => {
                    return (
                        <div onClick={()=>props.column.onClick(props.row)}>{props.cell.value}</div>
                    )
                },
	    },

	    {
		Header: 'Label',
		accessor: d => d.last_email.label && <Badge pill bg="primary">{d.last_email.label}</Badge>,
		id: 'label',
		onClick: false,
	    },
	    {
		Header: 'Team',
		accessor: d => d.last_email.team &&
		    <div className="d-flex align-items-center gap-2">
			<DisplayLogo
			    name={d.last_email.team.name}
			    photo={d.last_email.team.logo}
			    color={d.last_email.team.logocolor}
			/>
			<span className="team">
			    {d.last_email.team.name}
			</span>
		    </div>,
		id: 'team',
		onClick: (props) => {clickRow(props)},
                Cell: (props) => {
                    return (
                        <div onClick={()=>props.column.onClick(props.row)}>{props.cell.value}</div>
                    )
                },
	    },
		
	    {
		Header: 'Assigned To',
		accessor: d => d.last_email.assigned_to ? d.last_email.assigned_to.name : 'Unassigned',
		id: 'assignee',
		onClick: false,

	    },
	], []
    );


    const hideTicketModal = () => {
        setViewTicketModal(false);
	setReload(true);
    }

    const clickRow = (row) => {
	setTicket(row.original);
	setViewTicketModal(true);
    }


    const sortData = async (column, direction) => {
        setIsLoading(true);
        if (controller) {
            controller.abort();
        }

	const newcontrol = new AbortController();
        setController(newcontrol);
    }

    /* TODO - implement sort on header click */
    const columnHeaderClick = async (column) => {
	switch (sort.direction) {
	case 'ASC':
            setSort({ direction: 'DESC', accessor: column.id });
            sortData(column.id, 'DESC');
            break;
        case 'DESC':
            setSort({ direction: 'none', accessor: column.id })
            sortData(null, 'none');
            break;
	case 'none':
	default:
            setSort({ direction: 'ASC', accessor: column.id });
            sortData(column.id, 'ASC');
            break;
	    
        }
	
    }

    const reloadData = async () => {
        console.log("fetching new data...");
	await props.fetch().then((response) => {
	    console.log(response);
            setResponse(response);
	    setData(response.results);
	    setReload(false);
	    setIsLoading(false);
        }).catch(err => {
	    setIsLoading(false);
	    setError(err.message);
	    console.log(err);
        })
    }


    const fetchNextPage = async () => {
	console.log("fetching next page...");
	await props.fetch(response?.next).then((response) => {
	    console.log(response);
            setResponse(response);
	    setData(data.concat(response.results));
	    setIsLoading(false);
        }).catch(err => {
	    setIsLoading(false);
	    setError(err.message);
            console.log(err);
            console.log("data doesn't span multiple pages");
        })
    }


    const fetchData = () => {
        console.log("loading more...");
	if (response && response.next) {
            fetchNextPage();
        }
        setTimeout(() => {

        }, 1500);

    };

    useEffect(() => {
	reloadData();
    }, []);


    useEffect(() => {
	if (reload) {
	    reloadData();
	}
    }, [reload]);

    useEffect(() => {
	/* don't do this on initial load, just whenever props change */
	if (skipInitial) {
	    setSkipInitial(false);
	} else {
	    setIsLoading(true);
	    setReload(true);
	}
    }, [props.reload, props.team]);


    return (
	isLoading ?
            <div className="text-center">
                <div className="lds-spinner">
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
            </div>
            :
	    <div>
		{error &&
		 <Alert variant="danger">{error}</Alert>
		}

		<ClickCellTable
                    columns = {columns}
                    data = {data}
                    update = {fetchData}
                    hasMore = {response?.next}
                    sort = {sort}
                    onClickFunction = {null}
	            initialState = {props.tableState || []}
		/>
		{ticket &&
		 <TicketModal
		     showModal = {viewTicketModal}
		     hideModal = {hideTicketModal}
		     ticket={ticket}
		     assignment = {props.assignment || []}
		     user = {props.user}
		     roles = {props.roles || []}
		 />
		}

	    </div>

    )

};

export default TicketTable;
