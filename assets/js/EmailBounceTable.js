import React, { useCallback, useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Alert, Badge, Dropdown, Card, Row, Col, DropdownButton, InputGroup, Form, Button } from "react-bootstrap";
import AdminAPI from 'Components/AdminAPI';
import {format} from 'date-fns';
import ClickCellTable from "Components/ClickCellTable";
import BounceModal from "Components/BounceModal";
import 'Styles/casethread.css';

const adminapi = new AdminAPI();

const EmailBounceTable = (props) => {

    const { id } = useParams();
    const navigate = useNavigate();
    const [tableState, setTableState] = useState(null);
    const [reload, setReload] = useState(false);
    const [data, setData] = useState([]);
    const [response, setResponse] = useState(null);
    const [sort, setSort] = useState({direction: 'none', accessor: 'none'});
    const [controller, setController] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [bounce, setBounce] = useState(null);
    const [viewBounceModal, setViewBounceModal] = useState(false);
    const [showAll, setShowAll] = useState(false);

    const columns = useMemo(
        () => [
            {
                Header: 'Email',
                accessor: 'email',
                minWidth: 200,
                onClick: (props) => {clickRow(props)},
                Cell: (props) => {
                    return (
                        <div onClick={()=>props.column.onClick(props.row)}>{props.cell.value}</div>
                    )
                }
            },
            {
                Header: 'Subject',
                accessor: 'subject',
                maxWidth: 500,
                onClick: (props) => {clickRow(props)},
                Cell: (props) => {
                    return (
                        <div onClick={()=>props.column.onClick(props.row)}>{props.cell.value}</div>
                    )
                }
	    },
	    {
                Header: 'Date',
                accessor: 'bounce_date',
                maxWidth: 500,
                onClick: (props) => {clickRow(props)},
                Cell: (props) => {
                    return (
                        <div onClick={()=>props.column.onClick(props.row)}>{format(new Date(props.cell.value), 'yyyy-MM-dd HH:mm')}</div>
                    )
                }
	    },
	    {
	        Header: 'Type',
                accessor: 'bounce_type',
                maxWidth: 500,
                onClick: (props) => {clickRow(props)},
                Cell: (props) => {
                    return (
                        <div onClick={()=>props.column.onClick(props.row)}>{props.cell.value}</div>
                    )
                }
	    },
	    {
		Header: 'User',
                accessor: 'user.name',
                maxWidth: 500,
                Cell: (props) => {
		    if (props.row.original.user) {
			return (
                            <div><a href={`/cvdp/contact/${props.row.original.user.uuid}/`}>{props.cell.value}</a></div>
			)
		    } else {
			return (
			    <b>No user</b>
			)
		    }
                }
	    },
	    {
		Header: 'Groups',
                accessor: 'groups',
                maxWidth: 500,
                Cell: (props) => {
                    return (
			props.cell.value.map((y, idx) => (
                            <div key={`g-${idx}`}>{y.name}</div>
			))
                    )
                }
	    },
            {
                Header: 'Action',
                accessor: 'action',
                maxWidth: 500,
                onClick: (props) => {clickRow(props)},
                Cell: (props) => {
                    return (
                        <div onClick={()=>props.column.onClick(props.row)}><b>{props.cell.value}</b></div>
                    )
                }
            },	    

	], []
    );


    const fetchInitial = async (showAll) => {

	if (showAll) {

	    await adminapi.getAllEmailBounces().then((response) => {
		console.log(response);
		setResponse(response);
		setData(response.results);
		setIsLoading(false);
	    }).catch(err => {
		console.log(err);
	    });


	} else {
	
	    await adminapi.getEmailBounces().then((response) => {
		console.log(response);
		setResponse(response);
		setData(response.results);
		setIsLoading(false);
	    }).catch(err => {
		console.log(err);
	    });
	}
    }


    const clickRow = (row) => {
        setBounce(row.original);
        setViewBounceModal(true);
    }


    const fetchNextData = async () => {
        console.log("fetching...");
        await adminapi.getBounces(response?.next).then((response) => {
            console.log(response);
            setResponse(response);
            if (reload) {
                setData(response.results);
                setReload(false);
            } else {
                setData(data.concat(response.results));
            }
            setIsLoading(false);
        }).catch(err => {
            console.log(err);
            console.log("data doesn't span multiple pages");
        })
    }


    const fetchData = () => {
        console.log("loading more...");
        if (response && response.next) {
            fetchNextData();
        }
        setTimeout(() => {

        }, 1500);

    };

    useEffect(() => {
        fetchInitial(false);
    }, []);

    
    const hideBounceModal = (data) => {
	setViewBounceModal(false);
	fetchInitial(showAll);
    }


    const viewAll = (e) => {
	e.preventDefault();
	if (showAll) {
	    setShowAll(false);
	    fetchInitial(false);
	} else {
	    setShowAll(true);
	    fetchInitial(true);
	}
    }
    
    

    return (

	<>
	    <Row>
		<Col lg={9} sm={12}>
                    <h4 className="fw-bold py-3 pb-0">
			<span className="text-muted fw-light">Triage /</span>{" "}
			<span>Email Bounces</span>
		    </h4>
		</Col>
		<Col lg={3} sm={12} className="text-end mb-4">
		</Col>
            </Row>

	    <Card>

		<Card.Body>

		    
		    {isLoading ?
		     <div className="text-center">
			 <div className="lds-spinner">
			     <div></div>
			     <div></div>
			     <div></div>
			 </div>
		     </div>
		     :
		     <div>
			 {showAll ?
			  <p>Viewing <b>all</b> bounce notifications.  <a href="#" onClick={(e)=>viewAll(e)}>View unprocessed</a></p>
			  :
			  <p>Viewing <b>unprocessed</b> bounce notifications.  <a href="#" onClick={(e)=>viewAll(e)}>View All</a></p>
			 }
			 <ClickCellTable
			     columns = {columns}
			     data = {data}
			     update = {fetchData}
			     hasMore = {false}
			     sort = {sort}
			     onClickFunction = {null}
			     initialState = {props.tableState || []}
			 />
		     </div>
		    }
		    {bounce &&
		     <BounceModal
			 showModal={viewBounceModal}
			 hideModal={hideBounceModal}
			 bounce={bounce}
		     />
		    }
		    
		</Card.Body>
	    </Card>
	</>
    );


}

export default EmailBounceTable;
