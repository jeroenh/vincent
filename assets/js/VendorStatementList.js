import React, { useState, useEffect, useMemo } from 'react';
import {Card, Toast, Badge, DropdownButton, Dropdown, ListGroup, InputGroup, Form, Row, Col, Table, Accordion, Alert, Button} from 'react-bootstrap';
import ComponentAPI from "./ComponentAPI";
import { format, formatDistance } from 'date-fns'
import StatusModal from "./StatusModal";
import '../css/casethread.css';
import {Link, useLocation} from "react-router"
import SortingTable from "./SortingTable";
import ContactManageDropdown from './ContactManageDropdown';
import DeleteConfirmation from './DeleteConfirmation';
import DisplayVulStatus from "./DisplayVulStatus";

const componentapi = new ComponentAPI();

const VendorStatementList = (props) => {

    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [success, setSuccess] = useState("");
    const [response, setResponse] = useState(null);
    const [sort, setSort] = useState({direction: 'none', accessor: 'none'});
    const [unapproved, setUnapproved] = useState([]);
    const [unverifiedContacts, setUnverifiedContacts] = useState([]);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [detail, setDetail] = useState(null);

    const [showToast, setShowToast] = useState({
        show: false,
        msg: "",
        type: "",
    });

    const hideStatusModal = () => {
        setShowStatusModal(false);
    };

    const fetchInitialData = async () => {
        setIsLoading(true);
        await componentapi
            .getUnapprovedComponentStatus(props.caseInfo)
	    .then((response) => {
		setResponse(response);
		let newcomps = []
		response.results.forEach(x => {
		    x.vuls.forEach(y => {
			if (!y.approved) {
			    newcomps.push({'component': x.component, 'summary': x.summary,
					   'vul': y.vul, 'status': y.status, 'statement': y.statement,
					   'modified': y.modified, 'id': y.id, 'user': y.user})
			}
		    });
		});
		console.log(newcomps);
		setUnapproved(newcomps);
		setIsLoading(false);
	    }).catch(err => {
		console.log(err);
	    });
    }


    const columnHeaderClick = async (column) => {

        switch (sort.direction) {
        case 'ASC':
            setSort({ direction: 'DESC', accessor: column.id });
            //sortData(column.id, 'DESC');
            break;
        case 'DESC':
            setSort({ direction: 'none', accessor: column.id })
            //sortData(null, 'none');
	    break;
	case 'none':
	default:
            setSort({ direction: 'ASC', accessor: column.id });
            //sortData(column.id, 'ASC');
            break;

        }
    };


    function viewDetail(comp) {
	setShowToast({show:false, type:"save"});
	setDetail(comp);
	setShowStatusModal(true);
    }

    const unapproved_columns =  useMemo(
        () => [
            {
                Header: 'Owner',
                accessor: 'component.owner.name',
                Cell: props => {
		    if (props.row.original.component.owner) {
			return (
			    <Link to={props.row.original.component.owner.url}>{props.row.original.component.owner.name}</Link>
			)
		    } else {
			return (
			    <span><i className="fa fa-exclamation-triange"></i>No Owner</span>
			)
		    }
		    
                }
            },
            {
                Header: 'Component Name',
                accessor: 'component.name'
            },
	    {
		Header: 'Vul',
		accessor: 'vul.vul'
	    },
	    {
		Header: 'Status',
		accessor: 'status.status',
		Cell: props => {
		    if (props.row.original.status.length > 0 ) {
			return (
			    <DisplayVulStatus status={props.row.original.status[0].status} />
			)
		    } else {
			return "";
		    }
		    
		}
	    },
	    {
		Header: 'Version',
		accessor: 'status.version_value',
		Cell: props => {
		    if (props.row.original.status.length > 0) {
			return (
			    <span> {props.row.original.status[0].version_value
				   }{" "}
				{props.row.original.status[0].version_range? props.row.original.status[0].version_range
				 : ""}{" "}
				{props.row.original.status[0].version_end_range
				 ? props.row.original.status[0].version_end_range
				 : ""}{" "}
			    </span>
			)
		    } else {
			return ""
		    }
		}
	    },
	    {
                Header: 'Action',
                accessor: 'action',
                Cell: props => (
                    <div className="text-nowrap d-flex gap-2">
			<Button variant="outline-primary" size="sm" title="View" onClick={() => viewDetail(props.row.original)}>View</Button>
                        <Button variant="primary" size="sm" title="Approve" onClick={() => approveStatus(props, )}>
                            Approve
                        </Button>
                    </div>
                )
            },
        ], []
    );


    const approveStatus = async (status) => {
        setShowToast({show:false, type:"save"});
        await componentapi.approveComponentStatus(status.row.original.id).then(response=> {
	    setShowToast({
                show: true,
                msg: "Got it! Status has been approved.",
                type: "success",
            });
	    fetchInitialData();
        }).catch(err => {
            setError(`Error approving status: ${err.response.data.detail}`);
        });
	};


    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    };

    function noSelect(row) {
	console.log("do something")

    }


    useEffect(() => {
        fetchInitialData();
    }, []);


    const fetchNextData = async () => {
        console.log("fetching...");
        await contactapi.getMoreUnverified(response.next)
            .then((response) => {
                console.log(response);
                setResponse(response);
		setUnverifiedContacts(unverifiedContacts.concat(response.results));
            })
            .catch((err) => {
                console.log(err);
                console.log("data doesn't span multiple pages");
            });
    }


    const approveAll = async () => {

	await componentapi.approveAll(props.caseInfo).then(response => {
	    setShowToast({
                show: true,
                msg: "Got it! All statuses have been approved.",
                type: "success",
            });
            fetchInitialData();
	}).catch(err => {
	    setError(`Error approving status: ${err.response.data.detail}`);
	    console.log(err);
	});
    }
    
    const fetchData = () => {
        console.log("loading more...");
        if (response && response.next) {
	    fetchNextData();
        }
        setTimeout(() => {}, 1500);
    };

    return (
	<Card>
	    <Card.Header as="h5" className="d-flex justify-content-between">
		<Card.Title>
                    Pending Vendor Statements
                </Card.Title>
		{unapproved.length > 0 &&
		 <Button variant="outline-primary" size="sm" onClick={(e)=>approveAll()}>Approval All</Button>
		}
            </Card.Header>
	    <Card.Body>
		<Row>
		    <Col lg={12}>
			{error &&
			 <Alert variant="danger">{error}</Alert>
			}
			{success &&
			 <Alert variant="success"> {success}</Alert>
			}
			<div className="float-end">
			    <Toast
				autohide={true}
				bg={showToast.type}
				onClose={() =>
				    setShowToast({ show: false, type: "success" })
				}
				show={showToast.show}
			    >
				<Toast.Body>{showToast.msg}</Toast.Body>
			    </Toast>
			</div>
		    </Col>
		</Row>
		{isLoading ?
		 <div className="text-center">
		     <div className="lds-spinner">
			 <div></div>
			 <div></div>
			 <div></div>
		     </div>
		 </div>
		 
		 :
		 <>
		     
		     <SortingTable
			 columns={unapproved_columns}
			 data = {unapproved}
			 update = {fetchData}
			 hasMore={response && response.next ? true : false}
			 sort = {sort}
			 onHeaderClick = {columnHeaderClick}
			 onClickFunction={null}
			 initialState={[]}
			 hidden={[]}
		     />
		     {detail &&
		      <StatusModal
			  showModal={showStatusModal}
			  hideModal={hideStatusModal}
			  component={{component: detail.component}}
			  status={detail}
			  vuls={[detail.vul]}
			  user={props.reqUser}
                      />
		     }
		 </>
		}
		
	    </Card.Body>
	</Card>
    )
}

export default VendorStatementList;
