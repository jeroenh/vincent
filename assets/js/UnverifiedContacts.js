import React, { useState, useEffect, useMemo } from 'react';
import {Card, Toast, Badge, DropdownButton, Dropdown, ListGroup, InputGroup, Form, Row, Col, Table, Accordion, Alert, Button} from 'react-bootstrap';
import CaseThreadAPI from './ThreadAPI';
import { format, formatDistance } from 'date-fns'
import ContactAPI from './ContactAPI';
import '../css/casethread.css';
import {Link, useLocation} from "react-router"
import SortingTable from "./SortingTable";
import ContactManageDropdown from './ContactManageDropdown';
import DeleteConfirmation from './DeleteConfirmation';

const contactapi = new ContactAPI();

const UnverifiedContacts = () => {

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [response, setResponse] = useState(null);
    const [sort, setSort] = useState({direction: 'none', accessor: 'none'});
    const [unverifiedContacts, setUnverifiedContacts] = useState([]);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState([]);
    
    const [showToast, setShowToast] = useState({
        show: false,
        msg: "",
        type: "",
    });


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

		    
    const unverified_columns =  useMemo(
        () => [
            {
                Header: 'name',
                accessor: 'contact.name',
                Cell: props => (
                    <Link to={`/cvdp/contact/${props.row.original.contact.uuid}/`}>{props.row.original.contact.name}</Link>
                )
            },
            {
                Header: 'email',
                accessor: 'contact.email'
            },
            {
                Header: 'user',
                accessor: 'contact.user_name'
            },
	    {
		Header: 'group',
		accessor: 'group',
		Cell: props => {
		    let g = props.row.original.contact.associations.find(x => x.group == props.row.original.group);
		    return (
			<Link to={g.url}>{g.group}</Link>
		    )
		}
		    
	    },
	    {
		Header: 'Requested',
		accessor: (d) =>
		d.created &&
		    format(new Date(d.created), "yyyy-MM-dd HH:mm"),
	    },
	    {
		Header: 'Group Admin?',
		accessor: 'has_admin',
		Cell: props => {
		    if (props.row.original.has_admin) {
			return (<i className="fas fa-check goodtext"></i>)
		    } else {
			return (<i className="fas fa-times warningtext"></i>)
		    }
		}
	    },
	    {
                Header: 'Action',
                accessor: 'action',
                Cell: props => (
                    <div className="text-nowrap d-flex gap-2">                  
                        <Button variant="primary" size="sm" title="Verify" onClick={() => verifyUser(props, )}>
                            Verify                                              
                        </Button>                                               
                        <Button variant="danger" size="sm" title="Remove Unverified User" onClick={() => removeUnverifiedUser(props)}>
                            Remove                                              
                        </Button>                                               
                    </div>
                )
            },
        ], []
    );


    const verifyUser = async (contact) => {
        let data = {'verified': true};
        setShowToast({show:false, type:"save"});
        contactapi.updateGroupContact(contact.row.original.id, data).then(response=> {
	    setShowToast({
                show: true,
                msg: "Got it! User has been verified.",
                type: "success",
            });
	    fetchInitialData();
        }).catch(err => {
            setError(`Error verifying user: ${err.response.data.detail}`);
        });
	};


    const removeUnverifiedUser = async (contact) => {
        const rmnames = [contact.row.original.contact.name];
        setShowToast({show:false, type:"save"});
        setRemoveID([contact.row.original.id]);
        setDeleteMessage(`Are you sure you want to remove the following contacts: ${rmnames}?`);
        setDisplayConfirmationModal(true);
    };
    

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    };

    function noSelect(row) {
	console.log("do something")
	
    }


    const submitRemoveContact = async () => {
	await contactapi.removeGroupContact(removeID).then((response) => {
	    hideConfirmationModal();
            fetchInitialData();
	    setShowToast({
                show: true,
                msg: "Got it! User has been removed.",
                type: "success",
            });
        }).catch(err => {
            setError(`Error removing contact: ${err.message}`);
	});
	
    }
    
    const fetchInitialData = async () => {
        try {
            await contactapi.getAllUnverified().then((response) => {
		setResponse(response);
		setUnverifiedContacts(response.results);
            });

	}catch (err) {
            console.log('Error: ', err)
	    if (err.response?.data) {
		setError(err.response.data.message);
	    } else{
		setError("Error fetching groups data.");
	    }
        }
    };

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

    
    const fetchData = () => {
        console.log("loading more...");
        if (response && response.next) {
	    fetchNextData();
        }
        setTimeout(() => {}, 1500);
    };
    
    return (
	<>
	    <Row>
		<Col lg={9} md={9} sm={12}>
		    <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Contacts /</span>
			<Link to="/cvdp/groups/">Search</Link> /Unverified Contacts</h4>
		</Col>
		<Col lg={3} md={3} sm={12} className="text-end mb-4">
		    <ContactManageDropdown />
		</Col>
	    </Row>
	    <Row>
		<Col lg={12}>
                    {error &&
                     <Alert variant="danger">{error}</Alert>
                    }
                    {success &&
                     <Alert variant="success"> {success}</Alert>
                    }
		</Col>
	    </Row>
	    <Card className="group-app">
		<Card.Header className="pb-0" as="h5">
		</Card.Header>
		<Card.Body>
                    <DeleteConfirmation
                        showModal={displayConfirmationModal}
                        confirmModal={submitRemoveContact}
                        hideModal={hideConfirmationModal}
                        id={removeID}
                        message={deleteMessage} /> 
		    <SortingTable
                        columns={unverified_columns}
                        data = {unverifiedContacts}
                        update = {fetchData}
			hasMore={response && response.next ? true : false}
			sort = {sort}
			onHeaderClick = {columnHeaderClick}
                        onClickFunction={noSelect}
			initialState={[]}
                        hidden={[]}

		    />
		    <div className="float-end">                 
                        <Toast
                            bg={showToast.type}
                            onClose={() =>
                                setShowToast({ show: false, type: "success" })
                            }
                            show={showToast.show}
                        >                                       
                            <Toast.Body>{showToast.msg}</Toast.Body>                                                                           
                        </Toast>                                
                    </div>   
		</Card.Body>
	    </Card>

	</>
    )
}

export default UnverifiedContacts;
